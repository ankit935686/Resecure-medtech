import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, Plus, AlertCircle, Loader, FileText, Download } from 'lucide-react';
import MedicalHistoryDashboard from '../../components/MedicalHistoryDashboard';
import api from '../../services/api';

export default function DoctorMedicalHistory() {
  const { workspaceId } = useParams();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);

  useEffect(() => {
    loadWorkspace();
  }, [workspaceId]);

  const loadWorkspace = async () => {
    if (!workspaceId) return;
    
    try {
      const data = await api.doctor.getCareWorkspaceDetail(workspaceId);
      setWorkspace(data);
    } catch (err) {
      console.error('Error loading workspace:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = () => {
    setShowAddModal(true);
  };

  const handleEditEntry = (entry) => {
    setSelectedEntry(entry);
    setShowEditModal(true);
  };

  const handleDeleteEntry = async (entry) => {
    if (!confirm(`Are you sure you want to delete "${entry.title}"?`)) {
      return;
    }

    try {
      await api.doctor.deleteMedicalHistoryEntry(entry.id);
      alert('Entry deleted successfully');
      window.location.reload(); // Refresh the page
    } catch (err) {
      console.error('Error deleting entry:', err);
      alert('Failed to delete entry');
    }
  };

  const handleVerifyEntry = async (entry) => {
    try {
      await api.doctor.verifyMedicalHistoryEntry(entry.id);
      alert('Entry verified successfully');
      window.location.reload(); // Refresh the page
    } catch (err) {
      console.error('Error verifying entry:', err);
      alert('Failed to verify entry');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Workspace Header */}
        {workspace && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Medical History - {workspace.patient?.full_name}
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Patient ID: {workspace.patient?.patient_id}
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {/* Export functionality */}}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Medical History Dashboard */}
        <MedicalHistoryDashboard
          workspaceId={workspaceId}
          userRole="doctor"
          onAddEntry={handleAddEntry}
          onEditEntry={handleEditEntry}
          onDeleteEntry={handleDeleteEntry}
          onVerifyEntry={handleVerifyEntry}
        />

        {/* Integration Actions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900">Auto-Import Available</h3>
              <p className="text-sm text-blue-700 mt-1">
                Medical history entries are automatically imported from completed Intake Forms and OCR-processed Medical Reports.
                You can also manually trigger imports from the respective sections.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Entry Modal - Placeholder */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Add Medical History Entry</h2>
            {/* Add your form here */}
            <button
              onClick={() => setShowAddModal(false)}
              className="mt-4 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
