import { useState, useEffect } from 'react';
import { X, FileText, Calendar, User, Activity, AlertTriangle, CheckCircle, MessageSquare, Send, Loader, Download, Eye } from 'lucide-react';
import api from '../services/api';

export default function MedicalReportDetail({ report, workspaceId, onClose, onUpdate, userRole = 'patient' }) {
  const [reportData, setReportData] = useState(report);
  const [loading, setLoading] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'ocr', label: 'OCR Results' },
    { id: 'ai_analysis', label: 'AI Analysis' },
    { id: 'comments', label: 'Comments' }
  ];

  const loadFullReport = async () => {
    setLoading(true);
    try {
      const data = userRole === 'doctor'
        ? await api.doctor.getMedicalReportDetail(workspaceId, report.id)
        : await api.patient.getMedicalReportDetail(workspaceId, report.id);
      
      setReportData(data);
    } catch (err) {
      console.error('Error loading report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFullReport();
  }, [report.id]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setCommenting(true);
    try {
      if (userRole === 'doctor') {
        await api.doctor.addReportComment(workspaceId, report.id, newComment);
      } else {
        await api.patient.addReportComment(workspaceId, report.id, newComment);
      }
      
      setNewComment('');
      await loadFullReport();
    } catch (err) {
      console.error('Error adding comment:', err);
    } finally {
      setCommenting(false);
    }
  };

  const handleMarkAsReviewed = async () => {
    if (userRole !== 'doctor') return;

    try {
      await api.doctor.updateMedicalReport(workspaceId, report.id, { reviewed_by_doctor: true });
      await loadFullReport();
      onUpdate();
    } catch (err) {
      console.error('Error marking as reviewed:', err);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-t-2xl flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <h2 className="text-2xl font-bold">{reportData.title}</h2>
              {reportData.is_critical && (
                <span className="px-3 py-1 bg-red-500 text-white text-sm font-medium rounded-full flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  Critical
                </span>
              )}
              {reportData.status === 'reviewed' && (
                <span className="px-3 py-1 bg-green-500 text-white text-sm font-medium rounded-full flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Reviewed
                </span>
              )}
            </div>
            <p className="text-blue-100 mt-2">{reportData.description}</p>
            <div className="flex items-center space-x-4 mt-3 text-sm text-blue-100">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                Report Date: {formatDate(reportData.report_date)}
              </div>
              <div className="flex items-center">
                <User className="w-4 h-4 mr-1" />
                Uploaded: {formatDate(reportData.uploaded_at)}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors ml-4"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6 bg-gray-50">
          <div className="flex space-x-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 font-medium transition-all ${
                  activeTab === tab.id
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Report Info */}
                    <div className="bg-gray-50 rounded-xl p-6">
                      <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                        <FileText className="w-5 h-5 mr-2 text-blue-600" />
                        Report Information
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600">Type</p>
                          <p className="font-medium text-gray-900">{reportData.report_type_display}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Status</p>
                          <p className="font-medium text-gray-900">{reportData.status}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Report Date</p>
                          <p className="font-medium text-gray-900">{formatDate(reportData.report_date)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Uploaded At</p>
                          <p className="font-medium text-gray-900">{formatDate(reportData.uploaded_at)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Processing Status */}
                    <div className="bg-gray-50 rounded-xl p-6">
                      <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                        <Activity className="w-5 h-5 mr-2 text-purple-600" />
                        Processing Status
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">OCR Processing</span>
                          {reportData.ocr_processed ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <Loader className="w-5 h-5 text-gray-400 animate-spin" />
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">AI Analysis</span>
                          {reportData.ai_processed ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <Loader className="w-5 h-5 text-gray-400 animate-spin" />
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Doctor Review</span>
                          {reportData.reviewed_by_doctor ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <span className="text-yellow-600 text-sm">Pending</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* File Preview */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="font-semibold text-gray-900 mb-4">Document</h3>
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{reportData.file_name || 'Medical Report'}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            {reportData.file_size ? `${(reportData.file_size / 1024 / 1024).toFixed(2)} MB` : ''} • 
                            {reportData.file_extension || 'PDF'}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          {reportData.file_url && (
                            <>
                              <a
                                href={reportData.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                              >
                                <Download className="w-4 h-4" />
                                <span>Download</span>
                              </a>
                              <a
                                href={reportData.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors flex items-center space-x-2"
                              >
                                <Eye className="w-4 h-4" />
                                <span>View</span>
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* OCR Results Tab */}
              {activeTab === 'ocr' && (
                <div className="space-y-6">
                  {reportData.ocr_processed ? (
                    <>
                      {/* Extracted Text */}
                      <div className="bg-gray-50 rounded-xl p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Extracted Text</h3>
                        <div className="bg-white rounded-lg p-4 max-h-96 overflow-y-auto">
                          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                            {reportData.ocr_text || 'No text extracted'}
                          </pre>
                        </div>
                      </div>

                      {/* Extracted Medical Data */}
                      {(reportData.extracted_medications || reportData.extracted_diagnoses || reportData.extracted_vitals || reportData.extracted_test_results) && (
                        <div className="bg-gray-50 rounded-xl p-6">
                          <h3 className="font-semibold text-gray-900 mb-4">Extracted Medical Data</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {reportData.extracted_medications && Array.isArray(reportData.extracted_medications) && reportData.extracted_medications.length > 0 && (
                              <div className="bg-white rounded-lg p-4">
                                <p className="text-sm font-semibold text-gray-700 mb-2">Medications</p>
                                <ul className="list-disc list-inside space-y-1">
                                  {reportData.extracted_medications.map((med, idx) => (
                                    <li key={idx} className="text-sm text-gray-600">{med}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {reportData.extracted_diagnoses && Array.isArray(reportData.extracted_diagnoses) && reportData.extracted_diagnoses.length > 0 && (
                              <div className="bg-white rounded-lg p-4">
                                <p className="text-sm font-semibold text-gray-700 mb-2">Diagnoses</p>
                                <ul className="list-disc list-inside space-y-1">
                                  {reportData.extracted_diagnoses.map((diag, idx) => (
                                    <li key={idx} className="text-sm text-gray-600">{diag}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {reportData.extracted_vitals && typeof reportData.extracted_vitals === 'object' && Object.keys(reportData.extracted_vitals).length > 0 && (
                              <div className="bg-white rounded-lg p-4">
                                <p className="text-sm font-semibold text-gray-700 mb-2">Vital Signs</p>
                                <div className="space-y-1">
                                  {Object.entries(reportData.extracted_vitals).map(([key, value]) => (
                                    <p key={key} className="text-sm text-gray-600">
                                      <span className="font-medium">{key.replace(/_/g, ' ')}:</span> {value}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                            {reportData.extracted_test_results && Array.isArray(reportData.extracted_test_results) && reportData.extracted_test_results.length > 0 && (
                              <div className="bg-white rounded-lg p-4">
                                <p className="text-sm font-semibold text-gray-700 mb-2">Test Results</p>
                                <ul className="list-disc list-inside space-y-1">
                                  {reportData.extracted_test_results.map((test, idx) => (
                                    <li key={idx} className="text-sm text-gray-600">{JSON.stringify(test)}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <Loader className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                      <p className="text-gray-600">OCR processing in progress...</p>
                    </div>
                  )}
                </div>
              )}

              {/* AI Analysis Tab */}
              {activeTab === 'ai_analysis' && (
                <div className="space-y-6">
                  {reportData.ai_processed ? (
                    <>
                      {/* AI Summary */}
                      {reportData.ai_summary && (
                        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border-2 border-purple-200">
                          <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                            <Activity className="w-5 h-5 mr-2 text-purple-600" />
                            AI Analysis Summary
                          </h3>
                          <p className="text-gray-700 leading-relaxed">{reportData.ai_summary}</p>
                        </div>
                      )}

                      {/* Key Findings */}
                      {reportData.ai_key_findings && Array.isArray(reportData.ai_key_findings) && reportData.ai_key_findings.length > 0 && (
                        <div className="bg-blue-50 rounded-xl p-6">
                          <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                            <CheckCircle className="w-5 h-5 mr-2 text-blue-600" />
                            Key Findings
                          </h3>
                          <ul className="space-y-3">
                            {reportData.ai_key_findings.map((finding, index) => (
                              <li key={index} className="flex items-start bg-white rounded-lg p-3">
                                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5">
                                  {index + 1}
                                </span>
                                <span className="text-gray-700 flex-1">{typeof finding === 'string' ? finding : JSON.stringify(finding)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Recommendations */}
                      {reportData.ai_recommendations && (
                        <div className="bg-green-50 rounded-xl p-6">
                          <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                            <AlertTriangle className="w-5 h-5 mr-2 text-green-600" />
                            Recommendations
                          </h3>
                          <div className="bg-white rounded-lg p-4">
                            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{reportData.ai_recommendations}</p>
                          </div>
                        </div>
                      )}

                      {/* Raw AI Response (for debugging/full data) */}
                      {reportData.ai_raw_response && typeof reportData.ai_raw_response === 'object' && (
                        <details className="bg-gray-50 rounded-xl p-6">
                          <summary className="font-semibold text-gray-900 cursor-pointer hover:text-blue-600">View Full AI Analysis</summary>
                          <div className="mt-4 bg-white rounded-lg p-4 max-h-96 overflow-y-auto">
                            <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                              {JSON.stringify(reportData.ai_raw_response, null, 2)}
                            </pre>
                          </div>
                        </details>
                      )}

                      {/* Clinical Significance */}
                      {reportData.ai_analysis.clinical_significance && (
                        <div className="bg-purple-50 rounded-xl p-6">
                          <h3 className="font-semibold text-gray-900 mb-4">Clinical Significance</h3>
                          <p className="text-gray-700 leading-relaxed">{reportData.ai_analysis.clinical_significance}</p>
                        </div>
                      )}

                      {/* Risk Assessment */}
                      {reportData.ai_analysis.risk_assessment && (
                        <div className="bg-yellow-50 rounded-xl p-6">
                          <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                            <AlertTriangle className="w-5 h-5 mr-2 text-yellow-600" />
                            Risk Assessment
                          </h3>
                          <p className="text-gray-700 leading-relaxed">{reportData.ai_analysis.risk_assessment}</p>
                        </div>
                      )}

                      {/* Recommendations */}
                      {reportData.ai_analysis.recommendations && (
                        <div className="bg-green-50 rounded-xl p-6">
                          <h3 className="font-semibold text-gray-900 mb-4">Recommendations</h3>
                          <ul className="space-y-2">
                            {reportData.ai_analysis.recommendations.map((rec, index) => (
                              <li key={index} className="flex items-start">
                                <CheckCircle className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                                <span className="text-gray-700">{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Summary */}
                      {reportData.ai_analysis.summary && (
                        <div className="bg-gray-50 rounded-xl p-6">
                          <h3 className="font-semibold text-gray-900 mb-4">Summary</h3>
                          <p className="text-gray-700 leading-relaxed">{reportData.ai_analysis.summary}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <Loader className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
                      <p className="text-gray-600">AI analysis in progress...</p>
                    </div>
                  )}
                </div>
              )}

              {/* Comments Tab */}
              {activeTab === 'comments' && (
                <div className="space-y-6">
                  {/* Add Comment */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="font-semibold text-gray-900 mb-4">Add Comment</h3>
                    <div className="flex space-x-3">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Write your comment or question..."
                        rows={3}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                      <button
                        onClick={handleAddComment}
                        disabled={commenting || !newComment.trim()}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        {commenting ? (
                          <Loader className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <Send className="w-5 h-5" />
                            <span>Send</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Comments List */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Discussion ({reportData.comments?.length || 0})</h3>
                    {reportData.comments && reportData.comments.length > 0 ? (
                      reportData.comments.map((comment) => {
                        const isDoctor = comment.author_type === 'doctor';
                        const isPatient = comment.author_type === 'patient';
                        const isInternal = comment.is_internal;
                        
                        return (
                          <div 
                            key={comment.id} 
                            className={`rounded-lg border-2 p-4 ${
                              isDoctor ? 'bg-blue-50 border-blue-200' : 
                              isPatient ? 'bg-green-50 border-green-200' : 
                              'bg-gray-50 border-gray-200'
                            } ${isInternal ? 'opacity-75' : ''}`}
                          >
                            <div className="flex items-start space-x-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                isDoctor ? 'bg-blue-600' : 
                                isPatient ? 'bg-green-600' : 
                                'bg-gray-600'
                              }`}>
                                <User className="w-5 h-5 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center space-x-2">
                                    <p className="font-semibold text-gray-900">
                                      {comment.author_name || (isDoctor ? 'Doctor' : 'Patient')}
                                    </p>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                      isDoctor ? 'bg-blue-100 text-blue-700' : 
                                      isPatient ? 'bg-green-100 text-green-700' : 
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {isDoctor ? 'Doctor' : isPatient ? 'Patient' : 'System'}
                                    </span>
                                    {isInternal && (
                                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                                        Internal Note
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    {formatDate(comment.created_at)}
                                  </p>
                                </div>
                                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                                  {comment.comment}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
                        <MessageSquare className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-600 font-medium">No comments yet</p>
                        <p className="text-gray-500 text-sm mt-1">Start the discussion by adding a comment above</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 rounded-b-2xl">
          <div className="flex justify-between items-center">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
            {userRole === 'doctor' && !reportData.reviewed_by_doctor && (
              <button
                onClick={handleMarkAsReviewed}
                className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all flex items-center space-x-2"
              >
                <CheckCircle className="w-5 h-5" />
                <span>Mark as Reviewed</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
