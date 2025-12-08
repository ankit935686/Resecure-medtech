import { useState, useEffect } from 'react';
import { 
  Activity, Pill, AlertTriangle, Stethoscope, ClipboardList, 
  TrendingUp, Calendar, Filter, Search, Plus, CheckCircle, 
  Clock, FileText, Microscope, Shield, ChevronDown, ChevronUp,
  Info, AlertCircle, XCircle, Edit, Trash2, Eye
} from 'lucide-react';
import api from '../services/api';

// Category configurations with icons and colors
const CATEGORY_CONFIG = {
  condition: {
    icon: Activity,
    label: 'Conditions',
    color: 'red',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-200'
  },
  medication: {
    icon: Pill,
    label: 'Medications',
    color: 'blue',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200'
  },
  allergy: {
    icon: AlertTriangle,
    label: 'Allergies',
    color: 'orange',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200'
  },
  surgery: {
    icon: Stethoscope,
    label: 'Surgeries',
    color: 'purple',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200'
  },
  visit: {
    icon: ClipboardList,
    label: 'Doctor Visits',
    color: 'green',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    borderColor: 'border-green-200'
  },
  lab_result: {
    icon: Microscope,
    label: 'Lab Results',
    color: 'indigo',
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-200'
  }
};

// Source badge configurations
const SOURCE_CONFIG = {
  INTAKE: { label: 'Intake Form', color: 'bg-blue-100 text-blue-800' },
  OCR: { label: 'OCR Report', color: 'bg-purple-100 text-purple-800' },
  DOCTOR: { label: 'Doctor Entry', color: 'bg-green-100 text-green-800' },
  MANUAL: { label: 'Patient Entry', color: 'bg-gray-100 text-gray-800' }
};

// Status configurations
const STATUS_CONFIG = {
  active: { label: 'Active', icon: CheckCircle, color: 'text-green-600' },
  resolved: { label: 'Resolved', icon: CheckCircle, color: 'text-gray-500' },
  historical: { label: 'Historical', icon: Clock, color: 'text-blue-600' },
  inactive: { label: 'Inactive', icon: XCircle, color: 'text-gray-400' }
};

export default function MedicalHistoryDashboard({ 
  workspaceId, 
  userRole = 'doctor',
  onAddEntry,
  onEditEntry,
  onDeleteEntry 
}) {
  const [summary, setSummary] = useState(null);
  const [entries, setEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedEntry, setExpandedEntry] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    category: 'all',
    source: 'all',
    status: 'all',
    search: '',
    criticalOnly: false,
    unverifiedOnly: false
  });

  // View mode
  const [viewMode, setViewMode] = useState('summary'); // 'summary' or 'detailed'

  useEffect(() => {
    loadMedicalHistory();
  }, [workspaceId, userRole]);

  useEffect(() => {
    applyFilters();
  }, [entries, filters]);

  const loadMedicalHistory = async () => {
    setLoading(true);
    setError('');

    try {
      // Load summary
      const summaryData = userRole === 'doctor'
        ? await api.doctor.getMedicalHistorySummary(workspaceId)
        : await api.patient.getMedicalHistorySummary();
      
      setSummary(summaryData);

      // Load all entries
      const historyData = userRole === 'doctor'
        ? await api.doctor.getMedicalHistory(workspaceId)
        : await api.patient.getMedicalHistory();
      
      setEntries(historyData.results || historyData.entries || []);
    } catch (err) {
      console.error('Error loading medical history:', err);
      setError('Failed to load medical history');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...entries];

    if (filters.category !== 'all') {
      filtered = filtered.filter(entry => entry.category === filters.category);
    }

    if (filters.source !== 'all') {
      filtered = filtered.filter(entry => entry.source === filters.source);
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter(entry => entry.status === filters.status);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.title.toLowerCase().includes(searchLower) ||
        entry.description?.toLowerCase().includes(searchLower)
      );
    }

    if (filters.criticalOnly) {
      filtered = filtered.filter(entry => entry.is_critical);
    }

    if (filters.unverifiedOnly && userRole === 'doctor') {
      filtered = filtered.filter(entry => !entry.verified_by_doctor);
    }

    setFilteredEntries(filtered);
  };

  const getCategoryStats = () => {
    const stats = {};
    Object.keys(CATEGORY_CONFIG).forEach(category => {
      stats[category] = entries.filter(e => 
        e.category === category && e.status === 'active'
      ).length;
    });
    return stats;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const categoryStats = getCategoryStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Medical History</h2>
          <p className="text-sm text-gray-600 mt-1">
            Complete medical history from all sources
          </p>
        </div>
        
        {userRole === 'doctor' && (
          <button
            onClick={() => onAddEntry?.()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Entry
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
          const Icon = config.icon;
          const count = categoryStats[key] || 0;
          
          return (
            <div
              key={key}
              className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow`}
              onClick={() => setFilters({ ...filters, category: key })}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-5 h-5 ${config.textColor}`} />
                <span className={`text-2xl font-bold ${config.textColor}`}>
                  {count}
                </span>
              </div>
              <p className={`text-sm font-medium ${config.textColor}`}>
                {config.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search history..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Category Filter */}
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>

          {/* Source Filter */}
          <select
            value={filters.source}
            onChange={(e) => setFilters({ ...filters, source: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Sources</option>
            {Object.entries(SOURCE_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>

        {/* Quick Filters */}
        <div className="flex items-center gap-4 mt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.criticalOnly}
              onChange={(e) => setFilters({ ...filters, criticalOnly: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Critical Only</span>
          </label>

          {userRole === 'doctor' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.unverifiedOnly}
                onChange={(e) => setFilters({ ...filters, unverifiedOnly: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">Unverified Only</span>
            </label>
          )}

          <button
            onClick={() => setFilters({
              category: 'all',
              source: 'all',
              status: 'all',
              search: '',
              criticalOnly: false,
              unverifiedOnly: false
            })}
            className="ml-auto text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing {filteredEntries.length} of {entries.length} entries
        </p>
      </div>

      {/* Entries List */}
      <div className="space-y-3">
        {filteredEntries.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <Info className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No medical history entries found</p>
            <p className="text-sm text-gray-500 mt-1">
              {filters.search || filters.category !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Medical history will appear here as data is collected'}
            </p>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const categoryConfig = CATEGORY_CONFIG[entry.category];
            const CategoryIcon = categoryConfig?.icon || FileText;
            const sourceConfig = SOURCE_CONFIG[entry.source];
            const statusConfig = STATUS_CONFIG[entry.status];
            const StatusIcon = statusConfig?.icon || Clock;
            const isExpanded = expandedEntry === entry.id;

            return (
              <div
                key={entry.id}
                className={`bg-white border ${categoryConfig?.borderColor} rounded-lg p-4 hover:shadow-md transition-shadow`}
              >
                {/* Entry Header */}
                <div className="flex items-start gap-3">
                  <div className={`${categoryConfig?.bgColor} p-2 rounded-lg`}>
                    <CategoryIcon className={`w-5 h-5 ${categoryConfig?.textColor}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900">{entry.title}</h3>
                          
                          {entry.is_critical && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 text-xs font-medium rounded">
                              <AlertTriangle className="w-3 h-3" />
                              Critical
                            </span>
                          )}

                          {userRole === 'doctor' && !entry.verified_by_doctor && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                              <AlertCircle className="w-3 h-3" />
                              Unverified
                            </span>
                          )}
                        </div>

                        {entry.description && (
                          <p className="text-sm text-gray-600 mt-1">{entry.description}</p>
                        )}

                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 ${sourceConfig?.color} text-xs font-medium rounded`}>
                            {sourceConfig?.label}
                          </span>

                          <span className={`inline-flex items-center gap-1 text-xs ${statusConfig?.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig?.label}
                          </span>

                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Calendar className="w-3 h-3" />
                            {formatDate(entry.recorded_date)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>

                        {userRole === 'doctor' && (
                          <>
                            <button
                              onClick={() => onEditEntry?.(entry)}
                              className="p-1 text-indigo-400 hover:text-indigo-600 transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onDeleteEntry?.(entry)}
                              className="p-1 text-red-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {userRole === 'patient' && entry.source === 'MANUAL' && (
                          <>
                            <button
                              onClick={() => onEditEntry?.(entry)}
                              className="p-1 text-indigo-400 hover:text-indigo-600 transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onDeleteEntry?.(entry)}
                              className="p-1 text-red-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {entry.category_data && Object.keys(entry.category_data).length > 0 && (
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Details</h4>
                          <dl className="space-y-1">
                            {Object.entries(entry.category_data).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <dt className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}:</dt>
                                <dd className="text-gray-900 font-medium">{String(value)}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      )}

                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Metadata</h4>
                        <dl className="space-y-1">
                          <div className="flex justify-between">
                            <dt className="text-gray-600">Added:</dt>
                            <dd className="text-gray-900">{formatDate(entry.created_at)}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-600">Last Updated:</dt>
                            <dd className="text-gray-900">{formatDate(entry.updated_at)}</dd>
                          </div>
                          {entry.verified_at && (
                            <div className="flex justify-between">
                              <dt className="text-gray-600">Verified:</dt>
                              <dd className="text-gray-900">{formatDate(entry.verified_at)}</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
