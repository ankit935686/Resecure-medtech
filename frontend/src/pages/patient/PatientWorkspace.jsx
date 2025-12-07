import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Stethoscope,
  Calendar,
  Activity,
  CheckCircle2,
  AlertCircle,
  Pill,
  ClipboardList,
  Sparkles,
  ChevronRight,
  FileText,
  Clock,
  CheckCircle,
  Send,
} from 'lucide-react';
import api from '../../services/api';

const entryIcons = {
  treatment: ClipboardList,
  medication: Pill,
  diagnostic: Activity,
  guideline: Sparkles,
  appointment: Calendar,
  alert: AlertCircle,
  update: CheckCircle2,
};

const infoSections = [
  { key: 'primary_diagnosis', label: 'Primary Diagnosis', gradient: 'from-rose-500 to-pink-500' },
  { key: 'treatment_plan', label: 'Treatment Plan', gradient: 'from-blue-500 to-indigo-500' },
  { key: 'medication_overview', label: 'Medication Overview', gradient: 'from-emerald-500 to-teal-500' },
  { key: 'lifestyle_guidelines', label: 'Lifestyle Guidelines', gradient: 'from-yellow-500 to-amber-500' },
  { key: 'follow_up_instructions', label: 'Follow-up Instructions', gradient: 'from-purple-500 to-violet-500' },
];

export default function PatientWorkspace() {
  const { connectionId } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [intakeForms, setIntakeForms] = useState([]);

  useEffect(() => {
    const fetchWorkspace = async () => {
      try {
        setLoading(true);
        const [workspaceData, formsData] = await Promise.all([
          api.patient.getCareWorkspaceDetail(connectionId, { limit: 50 }),
          api.patient.getIntakeForms()
        ]);
        setWorkspace(workspaceData);
        // Filter forms for this workspace's doctor
        const doctorForms = (formsData.forms || []).filter(
          f => f.workspace_id === parseInt(connectionId) || f.connection_id === parseInt(connectionId)
        );
        setIntakeForms(doctorForms);
        setError('');
      } catch (err) {
        console.error('Error loading workspace:', err);
        setError(err.response?.data?.error || 'Failed to load care space. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspace();
  }, [connectionId]);

  const renderSectionContent = (content) =>
    content ? (
      <p className="text-sm text-gray-100/90 leading-relaxed whitespace-pre-line">{content}</p>
    ) : (
      <p className="text-sm text-gray-100/70 italic">No details shared yet.</p>
    );

  const renderTimelineEntry = (entry) => {
    const Icon = entryIcons[entry.entry_type] || CheckCircle2;
    const isCritical = entry.is_critical || entry.entry_type === 'alert';
    return (
      <div
        key={entry.id}
        className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-lg transition-all ${
          isCritical ? 'ring-2 ring-red-100' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                isCritical ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
              }`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">
                {entry.entry_type.replace('_', ' ')}
              </p>
              <h4 className="text-lg font-semibold text-gray-900">{entry.title}</h4>
            </div>
          </div>
          <div className="text-right text-xs text-gray-500">
            <p>{new Date(entry.created_at).toLocaleDateString()}</p>
            <p>{new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
        {entry.summary && <p className="mt-3 text-sm text-gray-600">{entry.summary}</p>}
        {entry.follow_up_actions && (
          <div className="mt-4 bg-gray-50 rounded-xl p-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Next steps</p>
            <p className="text-sm text-gray-600 whitespace-pre-line">{entry.follow_up_actions}</p>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-lg text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-900">Care space unavailable</h2>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => navigate('/patient/dashboard')}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full font-semibold shadow hover:shadow-lg transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <button
            onClick={() => navigate('/patient/dashboard')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-gray-700 font-semibold shadow hover:shadow-lg transition-all border border-gray-100"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to overview
          </button>
          <div className="text-right">
            <p className="text-sm text-gray-500">Patient ID: {workspace.patient_profile?.patient_id || 'N/A'}</p>
            <p className="text-xs text-gray-400">Updated {new Date(workspace.updated_at).toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-8 text-white shadow-2xl mb-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="w-64 h-64 bg-white rounded-full blur-3xl -top-10 -right-10 absolute" />
            <div className="w-48 h-48 bg-white rounded-full blur-3xl bottom-0 left-0 absolute" />
          </div>
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-widest text-white/70 mb-2">Doctor Care Space</p>
              <h1 className="text-3xl lg:text-4xl font-extrabold leading-tight">
                {workspace.title || 'Personalized Care Journey'}
              </h1>
              <p className="mt-3 text-white/80 max-w-2xl">
                {workspace.summary || 'Your doctor shares treatment plans, updates, and key milestones here.'}
              </p>
            </div>
            <div className="bg-white/15 rounded-2xl p-5 backdrop-blur-md min-w-[230px]">
              <p className="text-xs uppercase tracking-wide text-white/70">Current status</p>
              <p className="text-lg font-semibold">
                {(workspace.status || 'active').replace('_', ' ')}
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <p className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Next review:{' '}
                  <span className="font-semibold">
                    {workspace.next_review_date
                      ? new Date(workspace.next_review_date).toLocaleDateString()
                      : 'Awaiting schedule'}
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4" />
                  Doctor:{' '}
                  <span className="font-semibold">{workspace.doctor_profile?.name || 'N/A'}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              {infoSections.map((section) => (
                <div
                  key={section.key}
                  className={`rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br ${section.gradient}`}
                >
                  <p className="text-xs uppercase tracking-wide text-white/70 mb-2">{section.label}</p>
                  {renderSectionContent(workspace[section.key])}
                </div>
              ))}
            </div>

            <div className="bg-white rounded-3xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Timeline & Updates</h3>
                  <p className="text-sm text-gray-500">
                    {workspace.timeline_entries?.length
                      ? `${workspace.timeline_entries.length} shared update${
                          workspace.timeline_entries.length > 1 ? 's' : ''
                        }`
                      : 'No updates shared yet'}
                  </p>
                </div>
                {workspace.timeline_entries?.length > 0 && (
                  <span className="text-xs text-gray-500">
                    Most recent: {new Date(workspace.timeline_entries[0].created_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {workspace.timeline_entries?.length ? (
                  workspace.timeline_entries.map(renderTimelineEntry)
                ) : (
                  <div className="text-center py-10 bg-gray-50 rounded-2xl">
                    <Activity className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">No updates yet</p>
                    <p className="text-sm text-gray-500">
                      Once your doctor shares treatment updates, they will appear here.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Pending Intake Forms Section */}
            {intakeForms.length > 0 && (
              <div className="bg-white rounded-3xl shadow-xl p-6 border-2 border-teal-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-teal-100 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-teal-600 font-semibold">Action Required</p>
                    <h4 className="text-lg font-bold text-gray-900">Intake Forms</h4>
                  </div>
                </div>
                <div className="space-y-3">
                  {intakeForms.map((form) => {
                    const statusConfig = {
                      sent: { color: 'bg-yellow-100 text-yellow-700', label: 'Pending', icon: Clock },
                      in_progress: { color: 'bg-blue-100 text-blue-700', label: 'In Progress', icon: Activity },
                      submitted: { color: 'bg-green-100 text-green-700', label: 'Submitted', icon: CheckCircle },
                      reviewed: { color: 'bg-purple-100 text-purple-700', label: 'Reviewed', icon: CheckCircle },
                    };
                    const status = statusConfig[form.status] || statusConfig.sent;
                    const StatusIcon = status.icon;
                    const canFill = form.status === 'sent' || form.status === 'in_progress';

                    return (
                      <div
                        key={form.id}
                        className={`p-4 rounded-xl border ${canFill ? 'border-teal-200 bg-teal-50' : 'border-gray-200 bg-gray-50'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                                <StatusIcon className="w-3 h-3" />
                                {status.label}
                              </span>
                            </div>
                            <h5 className="font-semibold text-gray-900 text-sm">{form.title}</h5>
                            {form.description && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{form.description}</p>
                            )}
                          </div>
                          {canFill && (
                            <button
                              onClick={() => navigate(`/patient/forms/${form.id}`)}
                              className="px-3 py-2 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-1"
                            >
                              <Send className="w-3 h-3" />
                              Fill Form
                            </button>
                          )}
                          {!canFill && (
                            <button
                              onClick={() => navigate(`/patient/forms/${form.id}`)}
                              className="px-3 py-2 bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                            >
                              View
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-white rounded-3xl shadow-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <Stethoscope className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Primary Doctor</p>
                  <h4 className="text-lg font-bold text-gray-900">{workspace.doctor_profile?.name}</h4>
                  <p className="text-sm text-gray-600">{workspace.doctor_profile?.specialization}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <p className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {workspace.doctor_profile?.primary_clinic_hospital || 'Clinic details not shared'}
                </p>
                <p className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-gray-400" />
                  {workspace.doctor_profile?.consultation_mode
                    ? `${workspace.doctor_profile.consultation_mode} consultation`
                    : 'Consultation mode not set'}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-lg p-6">
              <h4 className="text-lg font-bold text-gray-900 mb-3">Patient Snapshot</h4>
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  <span className="text-gray-500">Blood Group:</span>{' '}
                  {workspace.patient_profile?.blood_group || '—'}
                </p>
                <p>
                  <span className="text-gray-500">Allergies:</span>{' '}
                  {workspace.patient_profile?.known_allergies || 'Not documented'}
                </p>
                <p>
                  <span className="text-gray-500">Conditions:</span>{' '}
                  {workspace.patient_profile?.chronic_conditions || 'Not documented'}
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl text-white p-6 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/70">Upcoming Checkpoint</p>
                  <h4 className="text-2xl font-bold">
                    {workspace.next_review_date
                      ? new Date(workspace.next_review_date).toLocaleDateString()
                      : 'Awaiting plan'}
                  </h4>
                  <p className="text-sm text-white/80 mt-2">
                    Follow the plan shared here to stay aligned with your doctor’s guidance.
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/patient/dashboard')}
                className="mt-6 inline-flex items-center gap-2 px-5 py-3 bg-white text-indigo-600 rounded-full font-semibold shadow hover:shadow-lg transition-all"
              >
                View overall dashboard
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


