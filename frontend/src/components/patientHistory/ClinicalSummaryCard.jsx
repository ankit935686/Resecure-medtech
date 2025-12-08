import React from 'react';

const ClinicalSummaryCard = ({ summary, onRefresh }) => {
  if (!summary) return null;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getRiskColorClasses = (level) => {
    switch (level) {
      case 'high': return 'bg-red-500';
      case 'moderate': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
      <div className="flex justify-between items-start p-6 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">🩺 AI Clinical Summary</h2>
          <span className="text-sm text-gray-500">
            Last updated: {formatDate(summary.generated_at)}
          </span>
        </div>
        <button 
          onClick={onRefresh} 
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium transition-colors flex items-center gap-2"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Clinical Overview */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Clinical Overview</h3>
          <div className="bg-gray-50 rounded-lg p-4 text-gray-700 leading-relaxed">
            {summary.clinical_summary || 'No AI summary available yet. Click refresh to generate.'}
          </div>
        </section>

        {/* Risk Assessment */}
        {summary.risk_assessment && Object.keys(summary.risk_assessment).length > 0 && (
          <section>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">⚠️ Risk Assessment</h3>
            <div className="space-y-4">
              {summary.risk_assessment.high_risk && summary.risk_assessment.high_risk.length > 0 && (
                <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
                  <h4 className="font-semibold text-red-800 mb-2">High Risk</h4>
                  <ul className="space-y-2">
                    {summary.risk_assessment.high_risk.map((risk, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-red-700">
                        <span className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0"></span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {summary.risk_assessment.moderate_risk && summary.risk_assessment.moderate_risk.length > 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-800 mb-2">Moderate Risk</h4>
                  <ul className="space-y-2">
                    {summary.risk_assessment.moderate_risk.map((risk, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-yellow-700">
                        <span className="w-2 h-2 rounded-full bg-yellow-500 mt-2 flex-shrink-0"></span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Trends Detected */}
        {summary.trends_detected && summary.trends_detected.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">📈 Trends Detected</h3>
            <div className="space-y-3">
              {summary.trends_detected.map((trend, idx) => {
                const trendIcon = trend.direction === 'improving' ? '📉' : 
                                 trend.direction === 'worsening' ? '📈' : '➡️';
                const trendColors = trend.direction === 'improving' ? 'bg-green-50 border-green-200' : 
                                   trend.direction === 'worsening' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200';
                const badgeColors = trend.direction === 'improving' ? 'bg-green-100 text-green-700' : 
                                   trend.direction === 'worsening' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700';
                
                return (
                  <div key={idx} className={`border rounded-lg p-4 ${trendColors}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{trendIcon}</span>
                      <strong className="text-gray-800 flex-1">{trend.parameter}</strong>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeColors}`}>
                        {trend.direction}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 ml-9">{trend.note}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Focus Points for Doctor */}
        {summary.focus_points && summary.focus_points.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">🎯 Focus Points</h3>
            <div className="space-y-3">
              {summary.focus_points.map((point, idx) => (
                <div key={idx} className="flex gap-3 bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {idx + 1}
                  </span>
                  <p className="text-gray-700">{point}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quick Statistics Grid */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">📊 Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
              <div className="text-3xl">🏥</div>
              <div>
                <div className="text-xs text-blue-600 font-medium">Active Conditions</div>
                <div className="text-2xl font-bold text-blue-800">{summary.stats?.active_conditions || 0}</div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4 flex items-center gap-3">
              <div className="text-3xl">💊</div>
              <div>
                <div className="text-xs text-purple-600 font-medium">Current Medications</div>
                <div className="text-2xl font-bold text-purple-800">{summary.stats?.current_medications || 0}</div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-teal-50 to-teal-100 border border-teal-200 rounded-lg p-4 flex items-center gap-3">
              <div className="text-3xl">🧪</div>
              <div>
                <div className="text-xs text-teal-600 font-medium">Lab Results</div>
                <div className="text-2xl font-bold text-teal-800">{summary.stats?.total_lab_results || 0}</div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <div className="text-3xl">👨‍⚕️</div>
              <div>
                <div className="text-xs text-green-600 font-medium">Visits</div>
                <div className="text-2xl font-bold text-green-800">{summary.stats?.total_visits || 0}</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ClinicalSummaryCard;
