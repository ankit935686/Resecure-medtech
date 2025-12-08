import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const LabResultsPanel = ({ workspaceId }) => {
  const [labResults, setLabResults] = useState([]);
  const [selectedParameter, setSelectedParameter] = useState(null);
  const [trendData, setTrendData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingTrend, setLoadingTrend] = useState(false);

  useEffect(() => {
    loadLabResults();
  }, [workspaceId]);

  const loadLabResults = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `/api/patientHistory/workspace/${workspaceId}/category/lab_result/detailed/`,
        { headers: { Authorization: `Token ${token}` } }
      );
      setLabResults(response.data.entries || []);
      setLoading(false);
    } catch (err) {
      console.error('Error loading lab results:', err);
      setLoading(false);
    }
  };

  const loadTrendData = async (parameterName) => {
    setLoadingTrend(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `/api/patientHistory/workspace/${workspaceId}/trends/${encodeURIComponent(parameterName)}/`,
        { headers: { Authorization: `Token ${token}` } }
      );
      setTrendData(response.data);
      setSelectedParameter(parameterName);
      setLoadingTrend(false);
    } catch (err) {
      console.error('Error loading trend data:', err);
      setLoadingTrend(false);
    }
  };

  // Group lab results by test name
  const groupedResults = {};
  labResults.forEach(result => {
    const testName = result.title;
    if (!groupedResults[testName]) {
      groupedResults[testName] = [];
    }
    groupedResults[testName].push(result);
  });

  const renderChart = () => {
    if (!trendData || !trendData.chart_data) return null;

    const chartData = {
      labels: trendData.chart_data.labels,
      datasets: [
        {
          label: trendData.parameter_name,
          data: trendData.chart_data.values,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1,
          pointBackgroundColor: trendData.chart_data.abnormal_flags.map(
            abnormal => abnormal ? 'red' : 'rgb(75, 192, 192)'
          ),
          pointRadius: 6,
          pointHoverRadius: 8
        }
      ]
    };

    const options = {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: `${trendData.parameter_name} Trend`
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.parsed.y} ${trendData.parameter_unit || ''}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          title: {
            display: true,
            text: trendData.parameter_unit || 'Value'
          }
        }
      }
    };

    return <Line data={chartData} options={options} />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading lab results...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">🧪 Lab Results & Trends</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left side - List of lab tests */}
        <div className="lg:col-span-1">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Available Tests ({Object.keys(groupedResults).length})
          </h3>
          {Object.keys(groupedResults).length === 0 ? (
            <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
              <p className="text-gray-600">No lab results found</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {Object.entries(groupedResults).map(([testName, results]) => {
                const latestResult = results[0];
                const isAbnormal = latestResult.category_data?.is_abnormal;
                
                return (
                  <div 
                    key={testName}
                    className={`bg-white rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md ${
                      selectedParameter === testName 
                        ? 'border-indigo-500 shadow-md' 
                        : isAbnormal 
                          ? 'border-red-300' 
                          : 'border-gray-200'
                    }`}
                    onClick={() => loadTrendData(testName)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-sm font-semibold text-gray-800">{testName}</h4>
                      {isAbnormal && <span className="text-red-500 text-lg">⚠️</span>}
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Latest:</span>
                        <span className={`font-medium ${isAbnormal ? 'text-red-600' : 'text-gray-800'}`}>
                          {latestResult.last_value || latestResult.category_data?.value || 'N/A'}
                          {latestResult.category_data?.unit && ` ${latestResult.category_data.unit}`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Results:</span>
                        <span className="text-gray-800">{results.length}</span>
                      </div>
                    </div>
                    {latestResult.category_data?.reference_range && (
                      <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                        Normal: {latestResult.category_data.reference_range}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right side - Trend visualization */}
        <div className="lg:col-span-2">
          {loadingTrend ? (
            <div className="flex items-center justify-center p-12 bg-gray-50 rounded-lg">
              <div className="text-gray-600">Loading trend data...</div>
            </div>
          ) : trendData ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-semibold text-gray-800">{trendData.parameter_name} Trend Analysis</h3>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  trendData.trend_direction === 'improving' ? 'bg-green-100 text-green-700' :
                  trendData.trend_direction === 'worsening' ? 'bg-red-100 text-red-700' :
                  trendData.trend_direction === 'stable' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {trendData.trend_direction === 'improving' && '📉 Improving'}
                  {trendData.trend_direction === 'worsening' && '📈 Worsening'}
                  {trendData.trend_direction === 'stable' && '➡️ Stable'}
                  {trendData.trend_direction === 'fluctuating' && '📊 Fluctuating'}
                </span>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                {renderChart()}
              </div>

              {trendData.ai_interpretation && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-indigo-800 mb-2">🤖 AI Interpretation</h4>
                  <p className="text-sm text-indigo-700">{trendData.ai_interpretation}</p>
                </div>
              )}

              {trendData.clinical_significance && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-800 mb-2">Clinical Significance</h4>
                  <p className="text-sm text-blue-700">{trendData.clinical_significance}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-xs text-gray-600 mb-1">Latest Value</div>
                  <div className={`text-lg font-bold ${trendData.is_abnormal ? 'text-red-600' : 'text-gray-800'}`}>
                    {trendData.latest_value} {trendData.parameter_unit}
                    {trendData.is_abnormal && ' ⚠️'}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-xs text-gray-600 mb-1">Latest Date</div>
                  <div className="text-lg font-bold text-gray-800">
                    {new Date(trendData.latest_date).toLocaleDateString()}
                  </div>
                </div>
                {trendData.reference_range && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-xs text-gray-600 mb-1">Normal Range</div>
                    <div className="text-sm font-semibold text-gray-800">{trendData.reference_range}</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center p-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-600 text-center">
                Select a lab test from the list to view trend analysis
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LabResultsPanel;
