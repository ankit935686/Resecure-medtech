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
} from 'lucide-react';
import api from '../../services/api';

export default function DoctorWorkspaceDetail() {
  const navigate = useNavigate();
  const { connectionId } = useParams();
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState(null);
  const [patientProfile, setPatientProfile] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [editedWorkspace, setEditedWorkspace] = useState({});
  const [newEntry, setNewEntry] = useState({
    entry_type: 'update',
    title: '',
    summary: '',
    details: '',
    visibility: 'patient',
    is_critical: false,
  });

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

      // Load patient profile - we'll get the patient ID from the connection
      // The patient profile basic info is already in workspaceRes.patient_profile
      // For full details, we'd need the numeric patient ID from the backend
      // For now, we'll use what's available in the workspace response
      setPatientProfile(workspaceRes.patient_profile);
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
      update: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
      treatment: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
      medication: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
      diagnostic: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
      guideline: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
      appointment: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
      alert: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
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
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/doctor/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ChevronLeft className="w-6 h-6 text-gray-600" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {workspace.patient_profile?.name}
                </h1>
                <p className="text-gray-500 mt-1">
                  {workspace.patient_profile?.patient_id}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {editMode ? (
                <>
                  <button
                    onClick={() => setEditMode(false)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveWorkspace}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center space-x-2"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Save Changes</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditMode(true)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit Workspace</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar - Patient Profile */}
          <div className="lg:col-span-1 space-y-6">
            {/* Patient Info Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {workspace.patient_profile?.name.charAt(0)}
                </div>
              </div>
              <h3 className="text-xl font-bold text-center text-gray-900 mb-1">
                {workspace.patient_profile?.name}
              </h3>
              <p className="text-center text-gray-500 mb-6">
                {workspace.patient_profile?.patient_id}
              </p>

              <div className="space-y-4">
                {patientProfile && (
                  <>
                    <div className="flex items-start space-x-3">
                      <User className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">Age / Gender</p>
                        <p className="text-sm font-medium text-gray-900">
                          {patientProfile.age} years • {patientProfile.gender}
                        </p>
                      </div>
                    </div>

                    {patientProfile.phone_number && (
                      <div className="flex items-start space-x-3">
                        <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Phone</p>
                          <p className="text-sm font-medium text-gray-900">
                            {patientProfile.phone_number}
                          </p>
                        </div>
                      </div>
                    )}

                    {workspace.patient_profile?.blood_group && (
                      <div className="flex items-start space-x-3">
                        <Heart className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Blood Group</p>
                          <p className="text-sm font-medium text-gray-900">
                            {workspace.patient_profile.blood_group}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Medical Info Card */}
            {workspace.patient_profile && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h4 className="font-bold text-gray-900 mb-4 flex items-center space-x-2">
                  <Stethoscope className="w-5 h-5 text-blue-500" />
                  <span>Medical Information</span>
                </h4>

                {workspace.patient_profile.known_allergies && (
                  <div className="mb-4 pb-4 border-b border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Allergies</p>
                    <div className="flex flex-wrap gap-2">
                      {workspace.patient_profile.known_allergies
                        .split(',')
                        .map((allergy, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded-full border border-red-200"
                          >
                            {allergy.trim()}
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                {workspace.patient_profile.chronic_conditions && (
                  <div className="mb-4 pb-4 border-b border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Chronic Conditions</p>
                    <p className="text-sm text-gray-900">
                      {workspace.patient_profile.chronic_conditions}
                    </p>
                  </div>
                )}

                {patientProfile?.emergency_contact_name && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Emergency Contact</p>
                    <p className="text-sm font-medium text-gray-900">
                      {patientProfile.emergency_contact_name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {patientProfile.emergency_contact_phone}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h4 className="font-bold text-gray-900 mb-4 flex items-center space-x-2">
                <ClipboardList className="w-5 h-5 text-blue-500" />
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
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 rounded-xl transition-all group"
                >
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">AI Intake Form</p>
                    <p className="text-xs text-gray-500">Request info from patient</p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Workspace Details Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Care Plan</h3>

              {editMode ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Workspace Title
                    </label>
                    <input
                      type="text"
                      value={editedWorkspace.title}
                      onChange={(e) =>
                        setEditedWorkspace({ ...editedWorkspace, title: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Summary
                    </label>
                    <textarea
                      value={editedWorkspace.summary}
                      onChange={(e) =>
                        setEditedWorkspace({ ...editedWorkspace, summary: e.target.value })
                      }
                      rows="2"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Lifestyle Guidelines
                    </label>
                    <textarea
                      value={editedWorkspace.lifestyle_guidelines}
                      onChange={(e) =>
                        setEditedWorkspace({
                          ...editedWorkspace,
                          lifestyle_guidelines: e.target.value,
                        })
                      }
                      rows="3"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Follow-up Instructions
                    </label>
                    <textarea
                      value={editedWorkspace.follow_up_instructions}
                      onChange={(e) =>
                        setEditedWorkspace({
                          ...editedWorkspace,
                          follow_up_instructions: e.target.value,
                        })
                      }
                      rows="3"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status
                      </label>
                      <select
                        value={editedWorkspace.status}
                        onChange={(e) =>
                          setEditedWorkspace({ ...editedWorkspace, status: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        <option value="active">Active</option>
                        <option value="on_hold">On Hold</option>
                        <option value="completed">Completed</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {workspace.primary_diagnosis && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center space-x-2">
                        <ClipboardList className="w-4 h-4" />
                        <span>Primary Diagnosis</span>
                      </h4>
                      <p className="text-gray-900">{workspace.primary_diagnosis}</p>
                    </div>
                  )}

                  {workspace.treatment_plan && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center space-x-2">
                        <Activity className="w-4 h-4" />
                        <span>Treatment Plan</span>
                      </h4>
                      <p className="text-gray-900 whitespace-pre-line">
                        {workspace.treatment_plan}
                      </p>
                    </div>
                  )}

                  {workspace.medication_overview && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center space-x-2">
                        <Pill className="w-4 h-4" />
                        <span>Medications</span>
                      </h4>
                      <p className="text-gray-900 whitespace-pre-line">
                        {workspace.medication_overview}
                      </p>
                    </div>
                  )}

                  {workspace.lifestyle_guidelines && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center space-x-2">
                        <Heart className="w-4 h-4" />
                        <span>Lifestyle Guidelines</span>
                      </h4>
                      <p className="text-gray-900 whitespace-pre-line">
                        {workspace.lifestyle_guidelines}
                      </p>
                    </div>
                  )}

                  {workspace.follow_up_instructions && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center space-x-2">
                        <Calendar className="w-4 h-4" />
                        <span>Follow-up Instructions</span>
                      </h4>
                      <p className="text-gray-900 whitespace-pre-line">
                        {workspace.follow_up_instructions}
                      </p>
                    </div>
                  )}

                  {workspace.next_review_date && (
                    <div className="flex items-center space-x-2 text-blue-600 bg-blue-50 px-4 py-3 rounded-lg">
                      <Clock className="w-5 h-5" />
                      <span className="font-medium">
                        Next review: {new Date(workspace.next_review_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Timeline</h3>
                <button
                  onClick={() => setShowAddEntry(!showAddEntry)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Update</span>
                </button>
              </div>

              {/* Add Entry Form */}
              {showAddEntry && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-4">New Update</h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Entry Type
                        </label>
                        <select
                          value={newEntry.entry_type}
                          onChange={(e) =>
                            setNewEntry({ ...newEntry, entry_type: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="update">General Update</option>
                          <option value="treatment">Treatment Plan</option>
                          <option value="medication">Medication</option>
                          <option value="diagnostic">Diagnostic/Test</option>
                          <option value="guideline">Guideline</option>
                          <option value="appointment">Appointment</option>
                          <option value="alert">Alert</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Visibility
                        </label>
                        <select
                          value={newEntry.visibility}
                          onChange={(e) =>
                            setNewEntry({ ...newEntry, visibility: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="patient">Shared with Patient</option>
                          <option value="internal">Internal Note</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Title *
                      </label>
                      <input
                        type="text"
                        value={newEntry.title}
                        onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                        placeholder="Enter title"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Summary
                      </label>
                      <textarea
                        value={newEntry.summary}
                        onChange={(e) => setNewEntry({ ...newEntry, summary: e.target.value })}
                        placeholder="Brief summary"
                        rows="2"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Details
                      </label>
                      <textarea
                        value={newEntry.details}
                        onChange={(e) => setNewEntry({ ...newEntry, details: e.target.value })}
                        placeholder="Detailed information"
                        rows="4"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newEntry.is_critical}
                        onChange={(e) =>
                          setNewEntry({ ...newEntry, is_critical: e.target.checked })
                        }
                        className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <label className="text-sm text-gray-700">
                        Mark as critical/important
                      </label>
                    </div>

                    <div className="flex items-center space-x-3 pt-2">
                      <button
                        onClick={handleAddEntry}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        Add Entry
                      </button>
                      <button
                        onClick={() => setShowAddEntry(false)}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline Entries */}
              <div className="space-y-4">
                {workspace.timeline_entries && workspace.timeline_entries.length > 0 ? (
                  workspace.timeline_entries.map((entry) => {
                    const entryStyle = getEntryTypeStyles(entry.entry_type);
                    return (
                      <div
                        key={entry.id}
                        className={`p-4 rounded-lg border ${entryStyle.border} ${entryStyle.bg}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`px-2 py-1 ${entryStyle.text} text-xs font-semibold rounded-full`}
                            >
                              {entry.entry_type}
                            </span>
                            {entry.visibility === 'internal' && (
                              <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded-full">
                                Internal
                              </span>
                            )}
                            {entry.is_critical && (
                              <Bell className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {new Date(entry.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-1">{entry.title}</h4>
                        {entry.summary && (
                          <p className="text-sm text-gray-700 mb-2">{entry.summary}</p>
                        )}
                        {entry.details && (
                          <p className="text-sm text-gray-600 whitespace-pre-line">
                            {entry.details}
                          </p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p>No timeline entries yet</p>
                    <p className="text-sm">Add your first update to start the care timeline</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
