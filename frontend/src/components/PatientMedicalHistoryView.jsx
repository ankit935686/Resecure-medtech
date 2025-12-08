import { useState, useEffect } from 'react';
import {
  Activity, Heart, TrendingUp, AlertCircle, Calendar,
  Pill, Shield, FileText, Plus, Info, ChevronRight
} from 'lucide-react';
import api from '../services/api';

export default function PatientMedicalHistoryView() {
  const [healthOverview, setHealthOverview] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadPatientData();
  }, []);

  const loadPatientData = async () => {
    setLoading(true);
    setError('');

    try {
      // Load health overview and dashboard data in parallel
      const [overview, dashboard] = await Promise.all([
        api.patient.getHealthOverview(),
        api.patient.getMedicalHistoryDashboard()
      ]);

      setHealthOverview(overview);
      setDashboardData(dashboard);
    } catch (err) {
      console.error('Error loading patient data:', err);
      setError('Failed to load medical history');
    } finally {
      setLoading(false);
    }
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

  const { active_conditions, current_medications, active_allergies, past_surgeries } = healthOverview || {};
  const { recent_entries, summary } = dashboardData || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Medical History</h1>
          <p className="text-gray-600 mt-1">View and manage your complete medical records</p>
        </div>
        
        <button
          onClick={() => {/* Navigate to add manual entry */}}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Manual Entry
        </button>
      </div>

      {/* Health Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Conditions */}
        <div className="bg-white border border-red-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-red-50 rounded-lg">
              <Activity className="w-6 h-6 text-red-600" />
            </div>
            <span className="text-3xl font-bold text-red-600">
              {active_conditions?.length || 0}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Active Conditions</h3>
          <p className="text-xs text-gray-600">Current health conditions</p>
        </div>

        {/* Current Medications */}
        <div className="bg-white border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Pill className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-3xl font-bold text-blue-600">
              {current_medications?.length || 0}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Current Medications</h3>
          <p className="text-xs text-gray-600">Active prescriptions</p>
        </div>

        {/* Allergies */}
        <div className="bg-white border border-orange-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Shield className="w-6 h-6 text-orange-600" />
            </div>
            <span className="text-3xl font-bold text-orange-600">
              {active_allergies?.length || 0}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Known Allergies</h3>
          <p className="text-xs text-gray-600">Critical to know</p>
        </div>

        {/* Surgeries */}
        <div className="bg-white border border-purple-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-50 rounded-lg">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-3xl font-bold text-purple-600">
              {past_surgeries?.length || 0}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Past Surgeries</h3>
          <p className="text-xs text-gray-600">Surgical history</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {['overview', 'conditions', 'medications', 'allergies', 'surgeries'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                activeTab === tab
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Content Based on Active Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {recent_entries && recent_entries.length > 0 ? (
                recent_entries.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{entry.title}</p>
                      <p className="text-sm text-gray-600 mt-1">{entry.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                          {entry.category}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(entry.recorded_date)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Info className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No recent activity</p>
                </div>
              )}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary Statistics</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Total Entries</span>
                <span className="text-xl font-bold text-gray-900">{summary?.total_entries || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Active Conditions</span>
                <span className="text-xl font-bold text-red-600">{summary?.active_conditions || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Current Medications</span>
                <span className="text-xl font-bold text-blue-600">{summary?.active_medications || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Known Allergies</span>
                <span className="text-xl font-bold text-orange-600">{summary?.active_allergies || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'conditions' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Conditions</h3>
          <div className="space-y-3">
            {active_conditions && active_conditions.length > 0 ? (
              active_conditions.map((condition) => (
                <div key={condition.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{condition.title}</h4>
                      {condition.description && (
                        <p className="text-sm text-gray-600 mt-1">{condition.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                          {condition.source}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(condition.recorded_date)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No active conditions recorded</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'medications' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Medications</h3>
          <div className="space-y-3">
            {current_medications && current_medications.length > 0 ? (
              current_medications.map((medication) => (
                <div key={medication.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{medication.title}</h4>
                      {medication.category_data?.dosage && (
                        <p className="text-sm text-gray-600 mt-1">
                          Dosage: {medication.category_data.dosage}
                        </p>
                      )}
                      {medication.category_data?.frequency && (
                        <p className="text-sm text-gray-600">
                          Frequency: {medication.category_data.frequency}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                          {medication.source}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(medication.recorded_date)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Pill className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No current medications</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'allergies' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Known Allergies</h3>
          <div className="space-y-3">
            {active_allergies && active_allergies.length > 0 ? (
              active_allergies.map((allergy) => (
                <div key={allergy.id} className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{allergy.title}</h4>
                      {allergy.description && (
                        <p className="text-sm text-gray-600 mt-1">{allergy.description}</p>
                      )}
                      {allergy.category_data?.severity && (
                        <p className="text-sm font-medium text-orange-700 mt-1">
                          Severity: {allergy.category_data.severity}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-2 py-0.5 bg-orange-200 text-orange-900 rounded">
                          {allergy.source}
                        </span>
                        <span className="text-xs text-gray-600 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(allergy.recorded_date)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No known allergies</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'surgeries' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Past Surgeries</h3>
          <div className="space-y-3">
            {past_surgeries && past_surgeries.length > 0 ? (
              past_surgeries.map((surgery) => (
                <div key={surgery.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{surgery.title}</h4>
                      {surgery.description && (
                        <p className="text-sm text-gray-600 mt-1">{surgery.description}</p>
                      )}
                      {surgery.category_data?.procedure_type && (
                        <p className="text-sm text-gray-600 mt-1">
                          Type: {surgery.category_data.procedure_type}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded">
                          {surgery.source}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(surgery.recorded_date)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No past surgeries recorded</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
