import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Calendar,
  Clock,
  ArrowRight,
  Search,
  Filter,
  Heart,
  Activity,
  FileText,
  AlertCircle,
  TrendingUp,
  Loader2,
  ChevronLeft,
} from 'lucide-react';
import api from '../../services/api';

export default function DoctorPatientWorkspaces() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState([]);
  const [filteredWorkspaces, setFilteredWorkspaces] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterWorkspaces();
  }, [searchQuery, statusFilter, workspaces]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [workspacesRes, summaryRes] = await Promise.all([
        api.doctor.getCareWorkspaces(),
        api.doctor.getDashboardSummary(),
      ]);

      setWorkspaces(workspacesRes.workspaces || []);
      setSummary(summaryRes);
    } catch (error) {
      console.error('Error loading workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterWorkspaces = () => {
    let filtered = [...workspaces];

    // Search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (w) =>
          w.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          w.patient_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          w.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((w) => w.status === statusFilter);
    }

    setFilteredWorkspaces(filtered);
  };

  const getStatusStyles = (status) => {
    const styles = {
      active: {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
        badge: 'bg-green-100',
      },
      on_hold: {
        bg: 'bg-yellow-50',
        text: 'text-yellow-700',
        border: 'border-yellow-200',
        badge: 'bg-yellow-100',
      },
      completed: {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        badge: 'bg-blue-100',
      },
      archived: {
        bg: 'bg-gray-50',
        text: 'text-gray-500',
        border: 'border-gray-200',
        badge: 'bg-gray-100',
      },
    };
    return styles[status] || styles.active;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading patient workspaces...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/doctor/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ChevronLeft className="w-6 h-6 text-gray-600" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Patient Workspaces</h1>
                <p className="text-gray-500 mt-1">
                  {filteredWorkspaces.length} of {workspaces.length} patient
                  {workspaces.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Patients</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {summary.summary.total_patients}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Active Workspaces</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {summary.summary.active_workspaces}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Activity className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Recent Updates</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {summary.summary.recent_updates_count}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <FileText className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pending Requests</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {summary.summary.pending_requests}
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by patient name or ID..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div className="flex items-center space-x-3">
              <Filter className="w-5 h-5 text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </div>

        {/* Workspaces Grid */}
        {filteredWorkspaces.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchQuery || statusFilter !== 'all'
                ? 'No workspaces match your filters'
                : 'No patient workspaces yet'}
            </h3>
            <p className="text-gray-500">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Connect with patients to create dedicated care workspaces'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWorkspaces.map((workspace) => {
              const statusStyle = getStatusStyles(workspace.status);
              return (
                <div
                  key={workspace.id}
                  className={`bg-white rounded-xl shadow-sm border ${statusStyle.border} hover:shadow-lg transition-all cursor-pointer overflow-hidden`}
                  onClick={() =>
                    navigate(`/doctor/workspaces/${workspace.connection_id}`)
                  }
                >
                  {/* Header */}
                  <div className={`${statusStyle.bg} px-6 py-4 border-b ${statusStyle.border}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 text-lg">
                          {workspace.patient_name}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {workspace.patient_id}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 ${statusStyle.badge} ${statusStyle.text} text-xs font-semibold rounded-full`}
                      >
                        {workspace.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-6">
                    <h4 className="font-semibold text-gray-900 mb-2">
                      {workspace.title}
                    </h4>
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {workspace.summary || 'No summary available'}
                    </p>

                    {/* Latest Entry */}
                    {workspace.latest_entry && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-4">
                        <div className="flex items-center space-x-2 mb-1">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <p className="text-xs text-gray-500">Latest Update</p>
                        </div>
                        <p className="text-sm font-medium text-gray-900">
                          {workspace.latest_entry.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(workspace.latest_entry.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    )}

                    {/* Next Review */}
                    {workspace.next_review_date && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Next review:{' '}
                          {new Date(workspace.next_review_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <p className="text-xs text-gray-500">
                        Updated {new Date(workspace.updated_at).toLocaleDateString()}
                      </p>
                      <ArrowRight className="w-5 h-5 text-blue-500" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
