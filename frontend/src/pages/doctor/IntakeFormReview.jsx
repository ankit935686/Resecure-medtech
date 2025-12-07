import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Activity,
  Pill,
  Stethoscope,
  Heart,
  FileCheck,
  Download,
  Eye,
  Brain,
  Scan,
  BarChart3,
} from 'lucide-react';
import api from '../../services/api';

export default function IntakeFormReview() {
  const navigate = useNavigate();
  const { formId } = useParams();

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [activeTab, setActiveTab] = useState('responses'); // 'responses' | 'ai-analysis' | 'documents'

  useEffect(() => {
    loadForm();
  }, [formId]);

  const loadForm = async () => {
    try {
      setLoading(true);
      const data = await api.doctor.getIntakeFormDetail(formId);
      setForm(data);
    } catch (error) {
      console.error('Error loading form:', error);
      alert('Failed to load form');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const markAsReviewed = async () => {
    if (!confirm('Mark this form as reviewed?')) return;

    try {
      await api.doctor.updateIntakeForm(formId, { status: 'reviewed' });
      setForm((prev) => ({ ...prev, status: 'reviewed' }));
      alert('Form marked as reviewed');
    } catch (error) {
      console.error('Error updating form:', error);
      alert('Failed to update form status');
    }
  };

  const getStatusBadge = () => {
    if (!form) return null;

    const statusConfig = {
      draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
      sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700', icon: Clock },
      in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700', icon: Activity },
      submitted: { label: 'Submitted', color: 'bg-green-100 text-green-700', icon: CheckCircle },
      reviewed: { label: 'Reviewed', color: 'bg-purple-100 text-purple-700', icon: FileCheck },
    };

    const config = statusConfig[form.status] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${config.color}`}>
        <Icon className="w-4 h-4" />
        {config.label}
      </div>
    );
  };

  const getUrgencyBadge = (urgencyLevel) => {
    const urgencyConfig = {
      routine: { label: 'Routine', color: 'bg-gray-100 text-gray-700', icon: Clock },
      moderate: { label: 'Moderate', color: 'bg-blue-100 text-blue-700', icon: Activity },
      urgent: { label: 'Urgent', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
      critical: { label: 'Critical', color: 'bg-red-100 text-red-700', icon: AlertCircle },
    };

    const config = urgencyConfig[urgencyLevel] || urgencyConfig.routine;
    const Icon = config.icon;

    return (
      <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${config.color}`}>
        <Icon className="w-4 h-4" />
        {config.label}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-600">Form not found</p>
        </div>
      </div>
    );
  }

  const hasResponse = form.response && form.response.response_data;
  const hasAIAnalysis = form.ai_analysis && Object.keys(form.ai_analysis).length > 0;
  const hasOCRResults = form.ocr_results && form.ocr_results.total_documents > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-gray-900">{form.title}</h1>
                <p className="text-sm text-gray-500">
                  Patient: {form.patient_name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge()}
              {form.status === 'submitted' && (
                <button
                  onClick={markAsReviewed}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                >
                  Mark as Reviewed
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Form not submitted yet */}
        {!hasResponse && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <Clock className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-900 mb-1">Waiting for Patient Response</h3>
                <p className="text-sm text-yellow-700">
                  This form has been sent to the patient but hasn't been submitted yet.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* AI Analysis Banner (if urgent/critical) */}
        {hasAIAnalysis && form.ai_analysis.urgency_level && ['urgent', 'critical'].includes(form.ai_analysis.urgency_level) && (
          <div className={`${
            form.ai_analysis.urgency_level === 'critical' ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'
          } border rounded-xl p-6 mb-6`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className={`w-6 h-6 ${
                form.ai_analysis.urgency_level === 'critical' ? 'text-red-600' : 'text-orange-600'
              } flex-shrink-0 mt-0.5`} />
              <div className="flex-1">
                <h3 className={`font-semibold mb-2 ${
                  form.ai_analysis.urgency_level === 'critical' ? 'text-red-900' : 'text-orange-900'
                }`}>
                  {form.ai_analysis.urgency_level === 'critical' ? '🚨 Critical Attention Required' : '⚠️ Urgent Review Needed'}
                </h3>
                <p className={`text-sm ${
                  form.ai_analysis.urgency_level === 'critical' ? 'text-red-700' : 'text-orange-700'
                }`}>
                  {form.ai_analysis.overall_summary}
                </p>
                {form.ai_analysis.suggested_actions && form.ai_analysis.suggested_actions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium mb-1">Suggested Actions:</p>
                    <ul className="text-sm space-y-1">
                      {form.ai_analysis.suggested_actions.map((action, idx) => (
                        <li key={idx}>• {action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-t-3xl shadow-sm border-b border-gray-200">
          <div className="flex gap-1 p-2">
            <button
              onClick={() => setActiveTab('responses')}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                activeTab === 'responses'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FileText className="w-5 h-5 inline-block mr-2" />
              Patient Responses
            </button>
            {hasAIAnalysis && (
              <button
                onClick={() => setActiveTab('ai-analysis')}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                  activeTab === 'ai-analysis'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Brain className="w-5 h-5 inline-block mr-2" />
                AI Analysis
                {form.ai_analysis.urgency_level && ['urgent', 'critical'].includes(form.ai_analysis.urgency_level) && (
                  <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">!</span>
                )}
              </button>
            )}
            {hasOCRResults && (
              <button
                onClick={() => setActiveTab('documents')}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                  activeTab === 'documents'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Scan className="w-5 h-5 inline-block mr-2" />
                Documents & OCR
                <span className="ml-2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                  {form.ocr_results.processed_documents}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-b-3xl shadow-xl p-8">
          {/* Patient Responses Tab */}
          {activeTab === 'responses' && (
            <div className="space-y-6">
              {!hasResponse ? (
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No responses yet</p>
                </div>
              ) : (
                <>
                  {form.form_schema.fields?.map((field, index) => (
                    <div key={field.id} className="border-b border-gray-100 pb-6 last:border-b-0">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{field.label}</p>
                          {field.helpText && (
                            <p className="text-sm text-gray-500 mt-1">{field.helpText}</p>
                          )}
                        </div>
                        {field.required && (
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">Required</span>
                        )}
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4">
                        {form.response.response_data[field.id] ? (
                          <p className="text-gray-900 whitespace-pre-wrap">
                            {Array.isArray(form.response.response_data[field.id])
                              ? form.response.response_data[field.id].join(', ')
                              : form.response.response_data[field.id]}
                          </p>
                        ) : (
                          <p className="text-gray-400 italic">Not answered</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Uploaded Documents */}
                  {form.uploads && form.uploads.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-gray-200">
                      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        Uploaded Documents ({form.uploads.length})
                      </h3>
                      <div className="grid gap-3">
                        {form.uploads.map((upload) => (
                          <div
                            key={upload.id}
                            className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-blue-300 transition-colors"
                          >
                            <FileText className="w-5 h-5 text-blue-500" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">{upload.field_label}</p>
                              <p className="text-sm text-gray-500">
                                {upload.file_name} • {(upload.file_size / 1024).toFixed(1)} KB
                              </p>
                              {upload.ocr_processed && (
                                <span className="inline-flex items-center gap-1 text-xs text-green-600 mt-1">
                                  <CheckCircle className="w-3 h-3" />
                                  OCR Processed
                                </span>
                              )}
                            </div>
                            <a
                              href={upload.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Download className="w-5 h-5" />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* AI Analysis Tab */}
          {activeTab === 'ai-analysis' && hasAIAnalysis && (
            <div className="space-y-6">
              {/* Overall Summary */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-2">AI Analysis Summary</h3>
                    <p className="text-gray-700 mb-4">{form.ai_analysis.overall_summary}</p>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Urgency Level</p>
                        {getUrgencyBadge(form.ai_analysis.urgency_level)}
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Analyzed</p>
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(form.ai_analysis.analyzed_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Findings Grid */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Symptoms */}
                {form.ai_analysis.symptoms_identified && form.ai_analysis.symptoms_identified.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-red-600" />
                      </div>
                      <h4 className="font-semibold text-gray-900">Symptoms Identified</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {form.ai_analysis.symptoms_identified.map((symptom, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium"
                        >
                          {symptom}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conditions */}
                {form.ai_analysis.conditions_mentioned && form.ai_analysis.conditions_mentioned.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                        <Stethoscope className="w-5 h-5 text-purple-600" />
                      </div>
                      <h4 className="font-semibold text-gray-900">Conditions Mentioned</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {form.ai_analysis.conditions_mentioned.map((condition, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium"
                        >
                          {condition}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Red Flags */}
              {form.ai_analysis.red_flags && form.ai_analysis.red_flags.length > 0 && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                    <h4 className="font-semibold text-red-900">Red Flags Detected</h4>
                  </div>
                  <div className="space-y-2">
                    {form.ai_analysis.red_flags.map((flag, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-red-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                        <span className="font-medium">{flag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Actions */}
              {form.ai_analysis.suggested_actions && form.ai_analysis.suggested_actions.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Recommended Actions</h4>
                  </div>
                  <ul className="space-y-2">
                    {form.ai_analysis.suggested_actions.map((action, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Detailed Field Analysis */}
              {form.ai_analysis.detailed_analysis && Object.keys(form.ai_analysis.detailed_analysis).length > 0 && (
                <div className="mt-8">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    Detailed Field Analysis
                  </h4>
                  <div className="space-y-4">
                    {Object.entries(form.ai_analysis.detailed_analysis).map(([fieldId, analysis]) => {
                      if (analysis.sentiment === 'neutral' && !analysis.notes) return null;
                      
                      const sentimentColors = {
                        neutral: 'border-gray-200 bg-gray-50',
                        concerning: 'border-yellow-200 bg-yellow-50',
                        critical: 'border-red-200 bg-red-50',
                      };

                      return (
                        <div
                          key={fieldId}
                          className={`border rounded-xl p-4 ${sentimentColors[analysis.sentiment] || sentimentColors.neutral}`}
                        >
                          <p className="font-medium text-gray-900 mb-2">{analysis.question}</p>
                          <p className="text-sm text-gray-700 mb-3 italic">"{analysis.answer}"</p>
                          {analysis.notes && (
                            <p className="text-sm text-gray-600 bg-white rounded-lg p-2">{analysis.notes}</p>
                          )}
                          {analysis.keywords && analysis.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {analysis.keywords.slice(0, 5).map((keyword, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs px-2 py-1 bg-white border border-gray-200 rounded-full text-gray-600"
                                >
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Documents & OCR Tab */}
          {activeTab === 'documents' && hasOCRResults && (
            <div className="space-y-6">
              {/* OCR Overview */}
              <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-2xl p-6 border border-green-200">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-600 flex items-center justify-center flex-shrink-0">
                    <Scan className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-2">OCR Analysis Complete</h3>
                    <p className="text-gray-700 mb-4">
                      Processed {form.ocr_results.processed_documents} of {form.ocr_results.total_documents} uploaded documents
                    </p>
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Success Rate:</span>
                        <span className="ml-2 font-semibold text-gray-900">
                          {Math.round((form.ocr_results.processed_documents / form.ocr_results.total_documents) * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Extracted Medical Data Grid */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Medications */}
                {form.ocr_results.all_medications && form.ocr_results.all_medications.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Pill className="w-5 h-5 text-blue-600" />
                      </div>
                      <h4 className="font-semibold text-gray-900">Medications Found</h4>
                    </div>
                    <ul className="space-y-2">
                      {form.ocr_results.all_medications.map((med, idx) => (
                        <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 flex-shrink-0"></span>
                          <span>{med}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Diagnoses */}
                {form.ocr_results.all_diagnoses && form.ocr_results.all_diagnoses.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                        <Stethoscope className="w-5 h-5 text-purple-600" />
                      </div>
                      <h4 className="font-semibold text-gray-900">Diagnoses Found</h4>
                    </div>
                    <ul className="space-y-2">
                      {form.ocr_results.all_diagnoses.map((diagnosis, idx) => (
                        <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-600 mt-1.5 flex-shrink-0"></span>
                          <span>{diagnosis}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Test Results */}
                {form.ocr_results.all_test_results && form.ocr_results.all_test_results.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-teal-600" />
                      </div>
                      <h4 className="font-semibold text-gray-900">Test Results</h4>
                    </div>
                    <ul className="space-y-2">
                      {form.ocr_results.all_test_results.map((test, idx) => (
                        <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 flex-shrink-0"></span>
                          <span>{test}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Vital Signs */}
                {form.ocr_results.vital_signs && Object.keys(form.ocr_results.vital_signs).length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                        <Heart className="w-5 h-5 text-red-600" />
                      </div>
                      <h4 className="font-semibold text-gray-900">Vital Signs</h4>
                    </div>
                    <div className="space-y-3">
                      {Object.entries(form.ocr_results.vital_signs).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-600 capitalize">
                            {key.replace('_', ' ')}
                          </span>
                          <span className="text-sm text-gray-900">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Allergies */}
              {form.ocr_results.all_allergies && form.ocr_results.all_allergies.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-6 h-6 text-yellow-600" />
                    <h4 className="font-semibold text-gray-900">Allergies Detected</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.ocr_results.all_allergies.map((allergy, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-lg text-sm font-medium"
                      >
                        {allergy}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted Texts Preview */}
              {form.ocr_results.extracted_texts && form.ocr_results.extracted_texts.length > 0 && (
                <div className="mt-8">
                  <h4 className="font-semibold text-gray-900 mb-4">Extracted Text Previews</h4>
                  <div className="space-y-4">
                    {form.ocr_results.extracted_texts.map((extract, idx) => (
                      <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <p className="font-medium text-gray-900 mb-2">{extract.file_name}</p>
                        <p className="text-sm text-gray-600 font-mono whitespace-pre-wrap">
                          {extract.text_preview}...
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
