import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, FileText, Shield, RefreshCcw } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export default function DoctorVerification() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [pendingDoctors, setPendingDoctors] = useState([]);
  const [allDoctors, setAllDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [rejectReason, setRejectReason] = useState('');

  const selectedDoctor = useMemo(() => {
    const combined = [...pendingDoctors, ...allDoctors];
    return combined.find((doc) => doc.id === selectedDoctorId) || combined[0] || null;
  }, [pendingDoctors, allDoctors, selectedDoctorId]);

  useEffect(() => {
    loadDoctors();
  }, []);

  const loadDoctors = async () => {
    try {
      setLoading(true);
      setError('');
      const [pendingRes, allRes] = await Promise.all([
        api.admin.getPendingDoctors(),
        api.admin.getAllDoctors(),
      ]);
      setPendingDoctors(pendingRes.doctors || []);
      setAllDoctors(allRes.doctors || []);
      const firstDoctor = pendingRes.doctors?.[0] || allRes.doctors?.[0] || null;
      setSelectedDoctorId(firstDoctor ? firstDoctor.id : null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load doctor requests.');
    } finally {
      setLoading(false);
    }
  };

  const filteredDoctors = useMemo(() => {
    if (statusFilter === 'pending') {
      return pendingDoctors;
    }
    if (statusFilter === 'all') {
      return allDoctors;
    }
    return allDoctors.filter((doc) => doc.profile_status === statusFilter);
  }, [pendingDoctors, allDoctors, statusFilter]);

  const handleApprove = async () => {
    if (!selectedDoctor) return;
    try {
      setActionLoading(true);
      await api.admin.verifyDoctor(selectedDoctor.id);
      await loadDoctors();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to verify doctor.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedDoctor) return;
    if (!rejectReason.trim()) {
      setError('Please provide a rejection reason.');
      return;
    }
    try {
      setActionLoading(true);
      await api.admin.rejectDoctor(selectedDoctor.id, rejectReason.trim());
      setRejectReason('');
      await loadDoctors();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject doctor.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const statusBadge = (status) => {
    const map = {
      pending: 'bg-yellow-100 text-yellow-800',
      verified: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      draft: 'bg-gray-100 text-gray-800',
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Doctor Verification Center</h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadDoctors}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Doctor list */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Doctor Requests</h2>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="pending">Pending Only</option>
                  <option value="all">All Requests</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                  <option value="draft">Draft</option>
                </select>
              </div>

              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                {filteredDoctors.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-6">
                    No doctors found for this filter.
                  </p>
                )}
                {filteredDoctors.map((doctor) => (
                  <button
                    key={doctor.id}
                    onClick={() => setSelectedDoctorId(doctor.id)}
                    className={`w-full text-left border rounded-lg p-3 hover:border-blue-400 transition ${
                      doctor.id === selectedDoctorId ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-gray-900">{doctor.display_name || doctor.full_name}</p>
                      <span className={`text-xs px-2 py-1 rounded-full ${statusBadge(doctor.profile_status)}`}>
                        {doctor.profile_status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{doctor.specialization || 'Specialization not set'}</p>
                    <p className="text-xs text-gray-400">
                      Submitted: {doctor.submitted_at ? new Date(doctor.submitted_at).toLocaleString() : '—'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Detail view */}
            <div className="bg-white rounded-lg shadow-lg p-6 lg:col-span-2">
              {!selectedDoctor ? (
                <div className="text-center text-gray-500 py-20">
                  Select a doctor to view full details.
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        {selectedDoctor.display_name || selectedDoctor.full_name}
                      </h2>
                      <p className="text-gray-500">{selectedDoctor.specialization}</p>
                      <p className="text-sm text-gray-400">
                        Doctor ID: {selectedDoctor.doctor_id || 'Pending assignment'}
                      </p>
                    </div>
                    <span className={`text-sm px-3 py-1 rounded-full ${statusBadge(selectedDoctor.profile_status)}`}>
                      {selectedDoctor.profile_status}
                    </span>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-2">Professional Info</h3>
                      <p className="text-sm text-gray-600">Hospital: {selectedDoctor.primary_clinic_hospital || '—'}</p>
                      <p className="text-sm text-gray-600">
                        Location: {selectedDoctor.city || '—'}, {selectedDoctor.country || '—'}
                      </p>
                      <p className="text-sm text-gray-600">
                        Consultation Mode: {selectedDoctor.consultation_mode || 'Not set'}
                      </p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-2">Contact</h3>
                      <p className="text-sm text-gray-600">Email: {selectedDoctor.professional_email || selectedDoctor.email}</p>
                      <p className="text-sm text-gray-600">Phone: {selectedDoctor.phone_number || '—'}</p>
                      <p className="text-sm text-gray-600">Submitted On: {selectedDoctor.submitted_at ? new Date(selectedDoctor.submitted_at).toLocaleString() : '—'}</p>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">License Details</h3>
                    <p className="text-sm text-gray-600">License No: {selectedDoctor.license_number || 'Not provided'}</p>
                    {selectedDoctor.license_document_url ? (
                      <a
                        href={selectedDoctor.license_document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 mt-2 text-blue-600 hover:underline"
                      >
                        <FileText className="w-4 h-4" />
                        View Uploaded Document
                      </a>
                    ) : (
                      <p className="text-sm text-gray-400 mt-2">No document uploaded.</p>
                    )}
                  </div>

                  {selectedDoctor.bio && (
                    <div className="border rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-2">Short Bio</h3>
                      <p className="text-gray-700 whitespace-pre-wrap">{selectedDoctor.bio}</p>
                    </div>
                  )}

                  <div className="border rounded-lg p-4 space-y-4">
                    <h3 className="font-semibold text-gray-900">Admin Actions</h3>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handleApprove}
                        disabled={actionLoading || selectedDoctor.profile_status === 'verified'}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <CheckCircle className="w-5 h-5" />
                        Approve
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={actionLoading || selectedDoctor.profile_status === 'rejected'}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <XCircle className="w-5 h-5" />
                        Reject
                      </button>
                    </div>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Add rejection reason (visible to doctor)"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows="3"
                    />
                    {selectedDoctor.rejection_reason && (
                      <p className="text-sm text-gray-500">
                        Last rejection note: {selectedDoctor.rejection_reason}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}


