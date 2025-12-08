import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  User,
  Calendar,
  Clock,
  Heart,
  Activity,
  FileText,
  Plus,
  Edit2,
  Save,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  Bell,
  Pill,
  Stethoscope,
  ClipboardList,
  MessageSquare,
  Phone,
  Mail,
  Sparkles,
  Send,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  FileCheck,
  ScanText,
  Brain,
  Microscope,
  Thermometer,
  Droplet,
  Wind,
  Scale,
  Zap,
  ChevronRight,
  BarChart3,
  Shield,
  History,
  Users,
  Target,
  BellRing,
  Upload,
} from 'lucide-react';
import api from '../../services/api';
import MedicalReportsList from '../../components/MedicalReportsList';
import MedicalReportDetail from '../../components/MedicalReportDetail';
import PatientHistoryDashboard from '../../components/patientHistory/PatientHistoryDashboard';

export default function DoctorWorkspaceDetail() {
  const navigate = useNavigate();
  const { connectionId } = useParams();
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [editedWorkspace, setEditedWorkspace] = useState({});
  const [newEntry, setNewEntry] = useState({
    entry_type: 'update',
    title: '',
    summary: '',
    details: '',
    visibility: 'patient',
    is_critical: false,
  });
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportDetail, setShowReportDetail] = useState(false);

  useEffect(() => {
    loadWorkspaceData();
  }, [connectionId]);

  const loadWorkspaceData = async () => {
    try {
      setLoading(true);
      const workspaceRes = await api.doctor.getCareWorkspaceDetail(connectionId, {
        entries_limit: 20,
      });

      setWorkspace(workspaceRes);
      setEditedWorkspace({
        title: workspaceRes.title,
        summary: workspaceRes.summary,
        primary_diagnosis: workspaceRes.primary_diagnosis,
        treatment_plan: workspaceRes.treatment_plan,
        medication_overview: workspaceRes.medication_overview,
        lifestyle_guidelines: workspaceRes.lifestyle_guidelines,
        follow_up_instructions: workspaceRes.follow_up_instructions,
        status: workspaceRes.status,
        next_review_date: workspaceRes.next_review_date,
      });
    } catch (error) {
      console.error('Error loading workspace:', error);
      alert('Failed to load workspace details');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWorkspace = async () => {
    try {
      setSaving(true);
      await api.doctor.updateCareWorkspace(connectionId, editedWorkspace);
      await loadWorkspaceData();
      setEditMode(false);
      alert('Workspace updated successfully!');
    } catch (error) {
      console.error('Error saving workspace:', error);
      alert('Failed to save workspace');
    } finally {
      setSaving(false);
    }
  };

  const handleAddEntry = async () => {
    if (!newEntry.title.trim()) {
      alert('Please enter a title');
      return;
    }

    try {
      await api.doctor.addWorkspaceEntry(connectionId, newEntry);
      await loadWorkspaceData();
      setShowAddEntry(false);
      setNewEntry({
        entry_type: 'update',
        title: '',
        summary: '',
        details: '',
        visibility: 'patient',
        is_critical: false,
      });
      alert('Update added successfully!');
    } catch (error) {
      console.error('Error adding entry:', error);
      alert('Failed to add update');
    }
  };

  const getEntryTypeStyles = (type) => {
    const styles = {
      update: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: '🔄' },
      treatment: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: '💊' },
      medication: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: '💊' },
      diagnostic: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: '🔬' },
      guideline: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', icon: '📋' },
      appointment: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', icon: '📅' },
      alert: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: '🚨' },
    };
    return styles[type] || styles.update;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Workspace not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Modern Header */}
      <div className="bg-white shadow-lg border-b border-gray-100">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <button
                onClick={() => navigate('/doctor/dashboard')}
                className="group p-2.5 hover:bg-blue-50 rounded-xl transition-all duration-200"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600 group-hover:text-blue-600" />
              </button>
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  {workspace.patient_profile?.name.charAt(0)}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {workspace.patient_profile?.name}
                  </h1>
                  <div className="flex items-center space-x-3 mt-1">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                      ID: {workspace.patient_profile?.patient_id}
                    </span>
                    {workspace.patient_profile?.age && workspace.patient_profile?.gender && (
                      <span className="text-gray-600 text-sm">
                        {workspace.patient_profile.age} years • {workspace.patient_profile.gender}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Patient History Button */}
              <button
                onClick={() => navigate(`/doctor/workspaces/${connectionId}/history`)}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl hover:from-purple-600 hover:to-indigo-600 transition-all duration-200 flex items-center space-x-2 font-medium shadow-md"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Patient History</span>
              </button>

              <div className="hidden md:flex items-center space-x-3">
                <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-medium">
                  <span className="text-sm">Status:</span>
                  <span className="ml-2 font-semibold">{workspace.status || 'Active'}</span>
                </div>
                {workspace.next_review_date && (
                  <div className="px-4 py-2 bg-green-50 text-green-700 rounded-lg font-medium">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Next Review: {new Date(workspace.next_review_date).toLocaleDateString()}
                  </div>
                )}
              </div>
              
              {editMode ? (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setEditMode(false)}
                    className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveWorkspace}
                    disabled={saving}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 disabled:opacity-50 flex items-center space-x-2 font-medium shadow-md"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Save Changes</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditMode(true)}
                  className="px-5 py-2.5 bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-xl hover:from-gray-900 hover:to-black transition-all duration-200 flex items-center space-x-2 font-medium shadow-md"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit Workspace</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-[1920px] mx-auto px-6 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="flex space-x-1 bg-white rounded-xl p-1.5 shadow-sm border border-gray-200 w-fit">
            {['overview', 'medical-history', 'reports', 'forms', 'timeline'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 rounded-lg font-medium text-sm transition-all duration-200 ${
                  activeTab === tab
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {tab === 'medical-history' ? 'Medical History' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* LEFT SIDEBAR - Patient Profile */}
          <div className="lg:col-span-1 space-y-6">
            {/* Patient Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  {workspace.patient_profile?.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{workspace.patient_profile?.name}</h3>
                  <p className="text-sm text-gray-500">Patient ID: {workspace.patient_profile?.patient_id}</p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-4">
                {workspace.patient_profile?.phone_number && (
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors group">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Phone className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Phone</p>
                      <p className="text-sm font-semibold text-gray-900">{workspace.patient_profile.phone_number}</p>
                    </div>
                  </div>
                )}

                {workspace.patient_profile?.email && (
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl hover:bg-purple-50 transition-colors group">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Mail className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">{workspace.patient_profile.email}</p>
                    </div>
                  </div>
                )}

                {workspace.patient_profile?.blood_group && (
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl hover:bg-red-50 transition-colors group">
                    <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Heart className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Blood Group</p>
                      <p className="text-sm font-semibold text-gray-900">{workspace.patient_profile.blood_group}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Medical Quick Stats */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h4 className="font-bold text-gray-900 mb-4 flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  <span>Medical Stats</span>
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-xl">
                    <p className="text-2xl font-bold text-blue-700">
                      {workspace.intake_forms_summary?.filter(f => f.status === 'submitted').length || 0}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">Completed Forms</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-xl">
                    <p className="text-2xl font-bold text-green-700">
                      {workspace.intake_forms_summary?.filter(f => f.ocr_processed).length || 0}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">Reports Analyzed</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Medical Information */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h4 className="font-bold text-gray-900 mb-6 flex items-center space-x-2">
                <Shield className="w-5 h-5 text-red-600" />
                <span>Medical Information</span>
              </h4>

              {/* Allergies */}
              {workspace.patient_profile?.known_allergies && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700">Known Allergies</p>
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {workspace.patient_profile.known_allergies
                      .split(',')
                      .map((allergy, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 bg-red-50 text-red-700 text-xs font-semibold rounded-lg border border-red-200"
                        >
                          ⚠️ {allergy.trim()}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Chronic Conditions */}
              {workspace.patient_profile?.chronic_conditions && (
                <div className="mb-6">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Chronic Conditions</p>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-200">
                    {workspace.patient_profile.chronic_conditions}
                  </p>
                </div>
              )}

              {/* Emergency Contact */}
              {workspace.patient_profile?.emergency_contact_name && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-3">Emergency Contact</p>
                  <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-xl border border-orange-200">
                    <p className="font-bold text-gray-900">{workspace.patient_profile.emergency_contact_name}</p>
                    <p className="text-sm text-gray-700 flex items-center gap-2 mt-2">
                      <Phone className="w-4 h-4" />
                      {workspace.patient_profile.emergency_contact_phone}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="lg:col-span-2 space-y-8">
            {/* Medical History Tab */}
            {activeTab === 'medical-history' && (
              <div>
                <PatientHistoryDashboard
                  workspaceId={connectionId}
                />
              </div>
            )}

            {/* Medical Reports Tab */}
            {activeTab === 'reports' && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">Patient Medical Reports</h3>
                  <p className="text-gray-600 mt-1">View and review all medical reports uploaded by the patient</p>
                </div>
                
                <MedicalReportsList
                  workspaceId={connectionId}
                  onViewReport={(report) => {
                    setSelectedReport(report);
                    setShowReportDetail(true);
                  }}
                  onAddComment={(report) => {
                    setSelectedReport(report);
                    setShowReportDetail(true);
                  }}
                  userRole="doctor"
                />
              </div>
            )}

            {/* AI Analysis Dashboard */}
            {activeTab === 'overview' && workspace.latest_ai_analysis && workspace.latest_ai_analysis.analysis && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                        <Brain className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">AI Clinical Analysis</h3>
                        <p className="text-purple-100 text-sm">Generated {new Date(workspace.latest_ai_analysis.analyzed_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className={`px-4 py-2 rounded-full font-bold text-sm ${
                      workspace.latest_ai_analysis.analysis.urgency_level === 'critical' ? 'bg-red-500 text-white' :
                      workspace.latest_ai_analysis.analysis.urgency_level === 'urgent' ? 'bg-orange-500 text-white' :
                      workspace.latest_ai_analysis.analysis.urgency_level === 'moderate' ? 'bg-yellow-500 text-white' :
                      'bg-green-500 text-white'
                    }`}>
                      {workspace.latest_ai_analysis.analysis.urgency_level?.toUpperCase() || 'NORMAL'}
                    </div>
                  </div>
                </div>
                
                <div className="p-8">
                  {/* Summary Card */}
                  <div className="mb-8 p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl border border-blue-200">
                    <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <FileCheck className="w-5 h-5 text-blue-600" />
                      Clinical Summary
                    </h4>
                    <p className="text-gray-700 leading-relaxed">
                      {workspace.latest_ai_analysis.analysis.overall_summary}
                    </p>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Key Findings */}
                    {workspace.latest_ai_analysis.analysis.key_findings?.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Target className="w-5 h-5 text-blue-600" />
                          </div>
                          <h4 className="font-bold text-gray-900">Key Findings</h4>
                        </div>
                        <ul className="space-y-3">
                          {workspace.latest_ai_analysis.analysis.key_findings.map((finding, idx) => (
                            <li key={idx} className="flex items-start gap-3">
                              <div className="w-6 h-6 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span className="text-blue-600 text-sm font-bold">{idx + 1}</span>
                              </div>
                              <p className="text-gray-700 text-sm leading-relaxed">{finding}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Symptoms */}
                    {workspace.latest_ai_analysis.analysis.symptoms_identified?.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                            <Activity className="w-5 h-5 text-red-600" />
                          </div>
                          <h4 className="font-bold text-gray-900">Symptoms Identified</h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {workspace.latest_ai_analysis.analysis.symptoms_identified.map((symptom, idx) => (
                            <span key={idx} className="px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-200">
                              {symptom}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommended Actions */}
                    {workspace.latest_ai_analysis.analysis.suggested_actions?.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <Zap className="w-5 h-5 text-green-600" />
                          </div>
                          <h4 className="font-bold text-gray-900">Recommended Actions</h4>
                        </div>
                        <ul className="space-y-3">
                          {workspace.latest_ai_analysis.analysis.suggested_actions.map((action, idx) => (
                            <li key={idx} className="flex items-start gap-3">
                              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                              <p className="text-gray-700 text-sm leading-relaxed">{action}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Conditions */}
                    {workspace.latest_ai_analysis.analysis.conditions_mentioned?.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                            <Stethoscope className="w-5 h-5 text-orange-600" />
                          </div>
                          <h4 className="font-bold text-gray-900">Medical Conditions</h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {workspace.latest_ai_analysis.analysis.conditions_mentioned.map((condition, idx) => (
                            <span key={idx} className="px-3 py-2 bg-orange-50 text-orange-700 rounded-lg text-sm font-medium border border-orange-200">
                              {condition}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Red Flags Alert */}
                  {workspace.latest_ai_analysis.analysis.red_flags?.length > 0 && (
                    <div className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200 rounded-2xl p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                        <h4 className="font-bold text-red-900 text-lg">Critical Alerts</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {workspace.latest_ai_analysis.analysis.red_flags.map((flag, idx) => (
                          <div key={idx} className="bg-white/50 p-4 rounded-xl border border-red-300">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-red-500">⚠️</span>
                              <span className="font-semibold text-red-800">Alert {idx + 1}</span>
                            </div>
                            <p className="text-red-700 text-sm">{flag}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* OCR Reports Dashboard */}
            {workspace.latest_ocr_analysis && workspace.latest_ocr_analysis.ocr_data && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                      <ScanText className="w-7 h-7 text-emerald-600" />
                      <span>OCR Reports Dashboard</span>
                    </h3>
                    <p className="text-gray-600 mt-2">Analyzed medical documents and reports</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Last Processed</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(workspace.latest_ocr_analysis.processed_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Medications Section */}
                {workspace.latest_ocr_analysis.ocr_data.medications && workspace.latest_ocr_analysis.ocr_data.medications.length > 0 && (
                  <div className="mb-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                        <Pill className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-lg">Medications Prescribed</h4>
                        <p className="text-sm text-gray-600">{workspace.latest_ocr_analysis.ocr_data.medications.length} medications found</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {workspace.latest_ocr_analysis.ocr_data.medications.map((med, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-xl border border-blue-200 hover:shadow-md transition-shadow">
                          <div className="flex items-start gap-3">
                            <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0">
                              {idx + 1}
                            </span>
                            <p className="text-gray-900 font-medium leading-relaxed">{med}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Vital Signs Section */}
                {workspace.latest_ocr_analysis.ocr_data.vital_signs && Object.keys(workspace.latest_ocr_analysis.ocr_data.vital_signs).length > 0 && (
                  <div className="mb-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center">
                        <Activity className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-lg">Vital Signs</h4>
                        <p className="text-sm text-gray-600">Current health metrics</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(workspace.latest_ocr_analysis.ocr_data.vital_signs).map(([key, value]) => (
                        <div key={key} className="bg-gradient-to-br from-red-50 to-pink-50 p-5 rounded-xl border border-red-200 hover:shadow-lg transition-shadow">
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                            {key.replace(/_/g, ' ')}
                          </p>
                          <p className="text-2xl font-bold text-gray-900">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Diagnoses and Test Results Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {/* Diagnoses */}
                  {workspace.latest_ocr_analysis.ocr_data.diagnoses && workspace.latest_ocr_analysis.ocr_data.diagnoses.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <Microscope className="w-5 h-5 text-purple-600" />
                        </div>
                        <h4 className="font-bold text-gray-900">Diagnoses</h4>
                      </div>
                      <ul className="space-y-3">
                        {workspace.latest_ocr_analysis.ocr_data.diagnoses.map((diagnosis, idx) => (
                          <li key={idx} className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                            <span className="text-purple-600 mt-0.5">•</span>
                            <span className="text-gray-700 text-sm leading-relaxed">{diagnosis}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Test Results */}
                  {workspace.latest_ocr_analysis.ocr_data.test_results && workspace.latest_ocr_analysis.ocr_data.test_results.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-cyan-600" />
                        </div>
                        <h4 className="font-bold text-gray-900">Test Results</h4>
                      </div>
                      <ul className="space-y-3">
                        {workspace.latest_ocr_analysis.ocr_data.test_results.map((result, idx) => (
                          <li key={idx} className="flex items-start gap-3 p-3 bg-cyan-50 rounded-lg">
                            <span className="text-cyan-600 mt-0.5">•</span>
                            <span className="text-gray-700 text-sm leading-relaxed">{result}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Allergies and Procedures */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Allergies */}
                  {workspace.latest_ocr_analysis.ocr_data.allergies && workspace.latest_ocr_analysis.ocr_data.allergies.length > 0 && (
                    <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl p-6 border-2 border-red-200">
                      <div className="flex items-center gap-3 mb-4">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                        <h4 className="font-bold text-red-900">Known Allergies</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {workspace.latest_ocr_analysis.ocr_data.allergies.map((allergy, idx) => (
                          <span key={idx} className="px-4 py-2 bg-red-100 border border-red-300 rounded-lg text-sm text-red-800 font-semibold">
                            ⚠️ {allergy}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Procedures */}
                  {workspace.latest_ocr_analysis.ocr_data.procedures && workspace.latest_ocr_analysis.ocr_data.procedures.length > 0 && (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
                      <div className="flex items-center gap-3 mb-4">
                        <Stethoscope className="w-6 h-6 text-green-600" />
                        <h4 className="font-bold text-green-900">Procedures</h4>
                      </div>
                      <ul className="space-y-2">
                        {workspace.latest_ocr_analysis.ocr_data.procedures.map((procedure, idx) => (
                          <li key={idx} className="flex items-start gap-3 text-green-800">
                            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <span className="text-sm leading-relaxed">{procedure}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* View All Forms Link */}
                <div className="mt-8 text-center">
                  <button
                    onClick={() => setActiveTab('forms')}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg hover:shadow-xl font-semibold"
                  >
                    View All Intake Forms & Reports →
                  </button>
                </div>
              </div>
            )}

            {/* Care Plan Section */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Care Plan</h3>
                  <p className="text-gray-600 mt-1">Treatment overview and patient management</p>
                </div>
                {!editMode && workspace.next_review_date && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg">
                    <Calendar className="w-4 h-4" />
                    <span className="font-semibold">
                      Next Review: {new Date(workspace.next_review_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {editMode ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Workspace Title
                      </label>
                      <input
                        type="text"
                        value={editedWorkspace.title}
                        onChange={(e) =>
                          setEditedWorkspace({ ...editedWorkspace, title: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder="Enter workspace title"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Status
                      </label>
                      <select
                        value={editedWorkspace.status}
                        onChange={(e) =>
                          setEditedWorkspace({ ...editedWorkspace, status: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        <option value="active">Active</option>
                        <option value="on_hold">On Hold</option>
                        <option value="completed">Completed</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Summary
                    </label>
                    <textarea
                      value={editedWorkspace.summary}
                      onChange={(e) =>
                        setEditedWorkspace({ ...editedWorkspace, summary: e.target.value })
                      }
                      rows="3"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="Enter patient summary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Primary Diagnosis
                    </label>
                    <textarea
                      value={editedWorkspace.primary_diagnosis}
                      onChange={(e) =>
                        setEditedWorkspace({
                          ...editedWorkspace,
                          primary_diagnosis: e.target.value,
                        })
                      }
                      rows="3"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="Enter primary diagnosis"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Treatment Plan
                    </label>
                    <textarea
                      value={editedWorkspace.treatment_plan}
                      onChange={(e) =>
                        setEditedWorkspace({
                          ...editedWorkspace,
                          treatment_plan: e.target.value,
                        })
                      }
                      rows="4"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="Enter treatment plan details"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Medication Overview
                    </label>
                    <textarea
                      value={editedWorkspace.medication_overview}
                      onChange={(e) =>
                        setEditedWorkspace({
                          ...editedWorkspace,
                          medication_overview: e.target.value,
                        })
                      }
                      rows="3"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="Enter medication details"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Next Review Date
                    </label>
                    <input
                      type="date"
                      value={editedWorkspace.next_review_date || ''}
                      onChange={(e) =>
                        setEditedWorkspace({
                          ...editedWorkspace,
                          next_review_date: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {workspace.primary_diagnosis && (
                    <div className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl border border-blue-200">
                      <h4 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-3">
                        <ClipboardList className="w-5 h-5 text-blue-600" />
                        <span>Primary Diagnosis</span>
                      </h4>
                      <p className="text-gray-700 leading-relaxed">{workspace.primary_diagnosis}</p>
                    </div>
                  )}

                  {workspace.treatment_plan && (
                    <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-200">
                      <h4 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-3">
                        <Activity className="w-5 h-5 text-purple-600" />
                        <span>Treatment Plan</span>
                      </h4>
                      <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                        {workspace.treatment_plan}
                      </p>
                    </div>
                  )}

                  {workspace.medication_overview && (
                    <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-200">
                      <h4 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-3">
                        <Pill className="w-5 h-5 text-green-600" />
                        <span>Medications</span>
                      </h4>
                      <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                        {workspace.medication_overview}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDEBAR - Tools & Timeline */}
          <div className="lg:col-span-1 space-y-8">
            {/* Quick Actions */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h4 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-600" />
                <span>Quick Actions</span>
              </h4>
              
              <div className="space-y-3">
                <button
                  onClick={() =>
                    navigate(
                      `/doctor/intake-form/new?workspace=${connectionId}&patient=${encodeURIComponent(
                        workspace.patient_profile?.name || 'Patient'
                      )}`
                    )
                  }
                  className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 rounded-xl transition-all group border border-blue-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                      <Plus className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900">Create AI Form</p>
                      <p className="text-xs text-gray-600">Generate patient intake form</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                </button>

                <button
                  onClick={() => setActiveTab('forms')}
                  className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 rounded-xl transition-all group border border-purple-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900">Review Intake Forms</p>
                      <p className="text-xs text-gray-600">View patient submissions</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-500" />
                </button>

                <button
                  onClick={() => setActiveTab('analysis')}
                  className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 rounded-xl transition-all group border border-emerald-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                      <ScanText className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900">OCR Reports</p>
                      <p className="text-xs text-gray-600">View scanned documents</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-500" />
                </button>
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h4 className="font-bold text-gray-900 flex items-center gap-2">
                  <BellRing className="w-5 h-5 text-orange-500" />
                  <span>Notifications</span>
                </h4>
                <span className="w-8 h-8 bg-red-500 text-white text-sm font-bold rounded-full flex items-center justify-center">
                  {workspace.intake_forms_summary?.filter(f => f.status === 'submitted').length || 0}
                </span>
              </div>
              
              <div className="space-y-4">
                {workspace.intake_forms_summary?.filter(f => f.status === 'submitted').slice(0, 3).map((form) => (
                  <div key={form.id} className="p-4 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{form.title}</p>
                        <p className="text-xs text-gray-600 mt-1">Submitted by patient</p>
                        <div className="flex items-center gap-2 mt-2">
                          {form.ocr_processed && (
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">
                              OCR Complete
                            </span>
                          )}
                          {form.has_ai_analysis && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                              AI Analyzed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {(!workspace.intake_forms_summary || workspace.intake_forms_summary.filter(f => f.status === 'submitted').length === 0) && (
                  <div className="text-center py-6">
                    <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No new notifications</p>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline Preview */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h4 className="font-bold text-gray-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-gray-600" />
                  <span>Recent Updates</span>
                </h4>
                <button
                  onClick={() => setActiveTab('timeline')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  View All
                </button>
              </div>
              
              <div className="space-y-4">
                {workspace.timeline_entries && workspace.timeline_entries.length > 0 ? (
                  workspace.timeline_entries.slice(0, 3).map((entry) => {
                    const entryStyle = getEntryTypeStyles(entry.entry_type);
                    return (
                      <div
                        key={entry.id}
                        className={`p-4 rounded-xl border ${entryStyle.border} ${entryStyle.bg} hover:shadow-sm transition-shadow`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold ${entryStyle.text}`}>
                              {entry.entry_type}
                            </span>
                            {entry.is_critical && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-bold">
                                Critical
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {new Date(entry.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <h4 className="font-semibold text-gray-900 text-sm mb-1">{entry.title}</h4>
                        {entry.summary && (
                          <p className="text-xs text-gray-600 line-clamp-2">{entry.summary}</p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6">
                    <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No timeline entries yet</p>
                  </div>
                )}
                
                {showAddEntry && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <h5 className="font-semibold text-gray-900 mb-3">Add New Entry</h5>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={newEntry.title}
                        onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                        placeholder="Entry title"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleAddEntry}
                          className="flex-1 px-3 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setShowAddEntry(false)}
                          className="px-3 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report Detail Modal */}
      {showReportDetail && selectedReport && (
        <MedicalReportDetail
          report={selectedReport}
          workspaceId={connectionId}
          onClose={() => {
            setShowReportDetail(false);
            setSelectedReport(null);
          }}
          onUpdate={() => {
            // Trigger refresh
          }}
          userRole="doctor"
        />
      )}
    </div>
  );
}