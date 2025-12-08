import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ClinicalSummaryCard from './ClinicalSummaryCard';
import UnifiedTimeline from './UnifiedTimeline';
import ConditionTrackerPanel from './ConditionTrackerPanel';
import MedicationPanel from './MedicationPanel';
import LabResultsPanel from './LabResultsPanel';
import AllergyBanner from './AllergyBanner';

const PatientHistoryDashboard = ({ workspaceId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Data states
  const [clinicalSummary, setClinicalSummary] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [summaryStats, setSummaryStats] = useState(null);
  
  // UI states
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);

  useEffect(() => {
    loadPatientHistory();
  }, [workspaceId]);

  const loadPatientHistory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const config = {
        headers: { Authorization: `Token ${token}` }
      };

      // Load clinical summary
      const summaryResponse = await axios.get(
        `/api/patientHistory/workspace/${workspaceId}/clinical-summary/`,
        config
      );
      setClinicalSummary(summaryResponse.data);
      setSummaryStats(summaryResponse.data.stats);

      // Load unified timeline
      const timelineResponse = await axios.get(
        `/api/patientHistory/workspace/${workspaceId}/unified-timeline/`,
        config
      );
      setTimeline(timelineResponse.data.timeline_items || []);

      setLoading(false);
    } catch (err) {
      console.error('Error loading patient history:', err);
      setError('Failed to load patient history. Please try again.');
      setLoading(false);
    }
  };

  const handleRefreshAI = async () => {
    setRefreshing(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `/api/patientHistory/workspace/${workspaceId}/regenerate-ai-summary/`,
        {},
        { headers: { Authorization: `Token ${token}` } }
      );
      
      // Reload data
      await loadPatientHistory();
      alert('AI summary regenerated successfully!');
    } catch (err) {
      console.error('Error refreshing AI summary:', err);
      alert('Failed to regenerate AI summary');
    }
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600"></div>
        <p className="mt-4 text-gray-600 text-lg">Loading patient history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <p className="text-red-800 mb-4">{error}</p>
          <button 
            onClick={loadPatientHistory}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors w-full"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Patient Medical History</h1>
            <p className="text-gray-600">
              {clinicalSummary?.patient_name} • 
              Age {clinicalSummary?.patient_age || 'N/A'} • 
              {clinicalSummary?.patient_gender}
            </p>
          </div>
          <div className="flex gap-4 items-center">
            <button 
              onClick={handleRefreshAI} 
              disabled={refreshing}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                refreshing 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700'
              } text-white flex items-center gap-2`}
            >
              {refreshing ? 'Regenerating...' : '🔄 Refresh AI Summary'}
            </button>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2">
              <div className="text-xs text-indigo-600 font-medium">Completeness</div>
              <div className="text-2xl font-bold text-indigo-700">{summaryStats?.completeness_score || 0}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Critical Allergy Banner */}
      {clinicalSummary?.stats?.has_critical_allergies && (
        <AllergyBanner allergies={clinicalSummary.allergies} />
      )}

      {/* Alert Summary Bar */}
      {(summaryStats?.critical_alerts > 0 || summaryStats?.unverified_entries > 0) && (
        <div className="flex gap-4 mb-6">
          {summaryStats.critical_alerts > 0 && (
            <div className="flex-1 bg-red-100 border border-red-300 rounded-lg p-4 text-red-800 font-semibold">
              ⚠️ {summaryStats.critical_alerts} Critical Alert{summaryStats.critical_alerts > 1 ? 's' : ''}
            </div>
          )}
          {summaryStats.unverified_entries > 0 && (
            <div className="flex-1 bg-yellow-100 border border-yellow-300 rounded-lg p-4 text-yellow-800 font-semibold">
              📋 {summaryStats.unverified_entries} Unverified Entr{summaryStats.unverified_entries > 1 ? 'ies' : 'y'}
            </div>
          )}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button 
          className={`px-6 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'overview' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-gray-600 hover:text-gray-800'
          }`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button 
          className={`px-6 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'timeline' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-gray-600 hover:text-gray-800'
          }`}
          onClick={() => setActiveTab('timeline')}
        >
          📅 Timeline
        </button>
        <button 
          className={`px-6 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'conditions' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-gray-600 hover:text-gray-800'
          }`}
          onClick={() => setActiveTab('conditions')}
        >
          🏥 Conditions ({summaryStats?.active_conditions || 0})
        </button>
        <button 
          className={`px-6 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'medications' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-gray-600 hover:text-gray-800'
          }`}
          onClick={() => setActiveTab('medications')}
        >
          💊 Medications ({summaryStats?.current_medications || 0})
        </button>
        <button 
          className={`px-6 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'labs' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-gray-600 hover:text-gray-800'
          }`}
          onClick={() => setActiveTab('labs')}
        >
          🧪 Lab Results
        </button>
      </div>

      {/* Main Content Area */}
      <div>
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - AI Summary */}
            <div className="lg:col-span-2 space-y-6">
              <ClinicalSummaryCard 
                summary={clinicalSummary}
                onRefresh={handleRefreshAI}
              />
              
              {/* Recent Activity Timeline */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Recent Activity</h2>
                <UnifiedTimeline 
                  items={timeline.slice(0, 10)}
                  compact={true}
                />
              </div>
            </div>

            {/* Right Sidebar - Quick Stats */}
            <div className="space-y-6">
              {/* Conditions Card */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Active Conditions</h3>
                <div className="text-4xl font-bold text-indigo-600 mb-4">{summaryStats?.active_conditions || 0}</div>
                <ul className="space-y-2">
                  {clinicalSummary?.active_conditions?.slice(0, 5).map((condition, idx) => (
                    <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-indigo-500">•</span>
                      <span>{condition}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Medications Card */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Current Medications</h3>
                <div className="text-4xl font-bold text-purple-600 mb-4">{summaryStats?.current_medications || 0}</div>
                <ul className="space-y-2">
                  {clinicalSummary?.current_medications?.slice(0, 5).map((med, idx) => (
                    <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-purple-500">•</span>
                      <span>{med}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Allergies Card */}
              {clinicalSummary?.allergies?.length > 0 && (
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-red-800 mb-3">⚠️ Allergies</h3>
                  <ul className="space-y-2">
                    {clinicalSummary.allergies.map((allergy, idx) => (
                      <li key={idx} className="text-sm text-red-700 font-medium flex items-start gap-2">
                        <span className="text-red-500">•</span>
                        <span>{allergy}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <UnifiedTimeline 
            items={timeline}
            workspaceId={workspaceId}
            showFilters={true}
          />
        )}

        {activeTab === 'conditions' && (
          <ConditionTrackerPanel 
            workspaceId={workspaceId}
            conditions={clinicalSummary?.active_conditions}
          />
        )}

        {activeTab === 'medications' && (
          <MedicationPanel 
            workspaceId={workspaceId}
            medications={clinicalSummary?.current_medications}
          />
        )}

        {activeTab === 'labs' && (
          <LabResultsPanel 
            workspaceId={workspaceId}
          />
        )}
      </div>
    </div>
  );
};

export default PatientHistoryDashboard;
