import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ConditionTrackerPanel = ({ workspaceId }) => {
  const [conditions, setConditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');

  useEffect(() => {
    loadConditions();
  }, [workspaceId, filter]);

  const loadConditions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `/api/patientHistory/workspace/${workspaceId}/category/condition/detailed/?status=${filter}`,
        { headers: { Authorization: `Token ${token}` } }
      );
      setConditions(response.data.entries || []);
      setLoading(false);
    } catch (err) {
      console.error('Error loading conditions:', err);
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
  };

  const getSeverityColor = (severity) => {
    const colors = {
      'critical': 'bg-red-100 text-red-800 border-red-300',
      'high': 'bg-orange-100 text-orange-800 border-orange-300',
      'moderate': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'low': 'bg-blue-100 text-blue-800 border-blue-300',
    };
    return colors[severity?.toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading conditions...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">🏥 Medical Conditions</h2>
        <div className="flex gap-2">
          <button 
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              filter === 'active' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setFilter('active')}
          >
            Active
          </button>
          <button 
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              filter === 'resolved' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setFilter('resolved')}
          >
            Resolved
          </button>
          <button 
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              filter === '' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setFilter('')}
          >
            All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {conditions.length === 0 ? (
          <div className="col-span-full bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-600">No conditions found</p>
          </div>
        ) : (
          conditions.map((condition) => (
            <div 
              key={condition.id} 
              className={`bg-white rounded-lg shadow-md border p-4 hover:shadow-lg transition-shadow ${
                condition.is_critical ? 'border-red-500 border-2' : 'border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-semibold text-gray-800 flex-1">{condition.title}</h3>
                <div className="flex flex-col gap-1">
                  {condition.is_chronic && (
                    <span className="px-2 py-1 text-xs font-bold bg-purple-100 text-purple-700 rounded">
                      Chronic
                    </span>
                  )}
                  {condition.is_critical && (
                    <span className="px-2 py-1 text-xs font-bold bg-red-100 text-red-700 rounded">
                      Critical
                    </span>
                  )}
                </div>
              </div>
              
              {condition.description && (
                <p className="text-sm text-gray-600 mb-3">{condition.description}</p>
              )}
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Severity:</span>
                  <span className={`px-2 py-0.5 text-xs font-semibold border rounded ${getSeverityColor(condition.severity)}`}>
                    {condition.severity_display || 'Unknown'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Since:</span>
                  <span className="text-gray-800">{formatDate(condition.start_date)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Status:</span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-800 text-xs rounded">
                    {condition.status_display}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Source:</span>
                  <span className="text-gray-800">{condition.source_display}</span>
                </div>
                
                {condition.trending_direction && condition.trending_direction !== 'unknown' && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Trend:</span>
                    <span className={`text-xs font-semibold ${
                      condition.trending_direction === 'improving' ? 'text-green-600' :
                      condition.trending_direction === 'worsening' ? 'text-red-600' :
                      'text-gray-600'
                    }`}>
                      {condition.trending_direction === 'improving' && '📉 Improving'}
                      {condition.trending_direction === 'worsening' && '📈 Worsening'}
                      {condition.trending_direction === 'stable' && '➡️ Stable'}
                    </span>
                  </div>
                )}
              </div>
              
              {condition.doctor_notes && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <strong className="text-sm text-gray-700">Doctor's Notes:</strong>
                  <p className="text-sm text-gray-600 mt-1">{condition.doctor_notes}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ConditionTrackerPanel;
