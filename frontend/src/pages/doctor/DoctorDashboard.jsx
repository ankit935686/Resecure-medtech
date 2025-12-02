import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  User,
  QrCode,
  Users,
  UserPlus,
  CheckCircle,
  XCircle,
  Clock,
  Share2,
  Copy,
  Download,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Stethoscope,
  AlertCircle,
  Loader2,
  FileText,
  Activity,
} from 'lucide-react';
import api from '../../services/api';

function DoctorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview'); // overview, patients, requests, qr-codes
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [connectedPatients, setConnectedPatients] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [qrTokens, setQRTokens] = useState([]);
  const [generatingQR, setGeneratingQR] = useState(false);
  const [qrData, setQRData] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [profileRes, patientsRes, requestsRes] = await Promise.all([
        api.doctor.getProfile(),
        api.doctor.getConnectedPatients(),
        api.doctor.getConnectionRequests(),
      ]);

      setProfile(profileRes);
      setConnectedPatients(patientsRes.connected_patients || []);
      setPendingRequests(requestsRes.pending_requests || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQRTokens = async () => {
    try {
      const response = await api.doctor.getMyQRTokens();
      setQRTokens(response.tokens || []);
    } catch (error) {
      console.error('Error loading QR tokens:', error);
    }
  };

  const handleGenerateQR = async () => {
    try {
      setGeneratingQR(true);
      const response = await api.doctor.generateQRCode({
        expiry_hours: 24,
        max_uses: 1,
        frontend_url: window.location.origin,
      });
      setQRData(response);
      setShowQRModal(true);
      await loadQRTokens(); // Refresh QR tokens list
    } catch (error) {
      console.error('Error generating QR code:', error);
      alert(error.response?.data?.error || 'Failed to generate QR code');
    } finally {
      setGeneratingQR(false);
    }
  };

  const handleAcceptRequest = async (connectionId) => {
    if (!confirm('Accept this connection request?')) return;
    
    try {
      await api.doctor.acceptConnection(connectionId, 'Welcome! Looking forward to helping you.');
      await loadDashboardData(); // Refresh data
      alert('Connection accepted successfully!');
    } catch (error) {
      console.error('Error accepting connection:', error);
      alert('Failed to accept connection');
    }
  };

  const handleRejectRequest = async (connectionId) => {
    if (!confirm('Reject this connection request?')) return;
    
    try {
      await api.doctor.rejectConnection(connectionId, 'Currently not accepting new patients.');
      await loadDashboardData(); // Refresh data
      alert('Connection rejected');
    } catch (error) {
      console.error('Error rejecting connection:', error);
      alert('Failed to reject connection');
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('✓ Link copied to clipboard!\nYou can now paste and share it with your patient.');
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        alert('✓ Link copied to clipboard!');
      } catch (e) {
        alert('Failed to copy. Please copy manually:\n' + text);
      }
      document.body.removeChild(textArea);
    }
  };

  const shareViaWhatsApp = (url) => {
    const message = `🏥 *MediStack 360 - Doctor Connection*\n\nHi! I'm inviting you to connect with me on MediStack 360.\n\n*Click the link below to connect instantly:*\n${url}\n\nThis link will expire in 24 hours and can only be used once.\n\nLooking forward to assisting you with your healthcare needs!`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleSearchPatients = async () => {
    if (!searchQuery.trim()) {
      alert('Please enter a search query');
      return;
    }

    try {
      setSearching(true);
      const response = await api.doctor.searchPatients({ q: searchQuery });
      setSearchResults(response.patients || []);
    } catch (error) {
      console.error('Error searching patients:', error);
      alert(error.response?.data?.error || 'Failed to search patients');
    } finally {
      setSearching(false);
    }
  };

  const handleConnectWithPatient = async (patientId) => {
    if (!confirm('Send connection request to this patient?')) return;
    
    try {
      await api.doctor.connectWithPatient(patientId, 'I would like to connect with you.');
      alert('Connection request sent successfully!');
      setShowSearchModal(false);
      setSearchQuery('');
      setSearchResults([]);
      await loadDashboardData(); // Refresh data
    } catch (error) {
      console.error('Error connecting with patient:', error);
      alert(error.response?.data?.error || 'Failed to send connection request');
    }
  };

  const handleDeleteQRToken = async (token) => {
    if (!confirm('Delete this QR code? This action cannot be undone.')) return;
    
    try {
      await api.doctor.deleteQRToken(token);
      alert('QR code deleted successfully');
      await loadQRTokens(); // Refresh QR tokens list
    } catch (error) {
      console.error('Error deleting QR token:', error);
      alert(error.response?.data?.error || 'Failed to delete QR code');
    }
  };

  const handleViewQRCode = (token) => {
    // Reconstruct QR data from token
    const frontendUrl = window.location.origin;
    const qrUrl = `${frontendUrl}/patient/scan-qr/${token.token}`;
    
    setQRData({
      token: token.token,
      qr_url: qrUrl,
      expires_at: token.expires_at,
      max_uses: token.max_uses,
      qr_code_image: null, // We don't store the image, but can regenerate if needed
      doctor_name: profile?.display_name || profile?.first_name,
      doctor_specialization: profile?.specialization
    });
    setShowQRModal(true);
  };

  const downloadQRCode = () => {
    if (!qrData) return;
    
    const link = document.createElement('a');
    link.download = `doctor-qr-${Date.now()}.png`;
    link.href = qrData.qr_code_image;
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Dr. {profile?.display_name || profile?.first_name}
              </h1>
              <p className="text-sm text-gray-600">{profile?.specialization}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                Verified
              </span>
              <button
                onClick={logout}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 text-blue-600" />
              <span className="text-3xl font-bold text-gray-800">{connectedPatients.length}</span>
            </div>
            <p className="text-sm text-gray-600 font-medium">Connected Patients</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-8 h-8 text-yellow-600" />
              <span className="text-3xl font-bold text-gray-800">{pendingRequests.length}</span>
            </div>
            <p className="text-sm text-gray-600 font-medium">Pending Requests</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <QrCode className="w-8 h-8 text-purple-600" />
              <span className="text-3xl font-bold text-gray-800">{qrTokens.filter(t => t.is_valid).length}</span>
            </div>
            <p className="text-sm text-gray-600 font-medium">Active QR Codes</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-8 h-8 text-green-600" />
              <span className="text-3xl font-bold text-gray-800">{profile?.consultation_mode || 'Both'}</span>
            </div>
            <p className="text-sm text-gray-600 font-medium">Consultation Mode</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-4 font-medium transition-colors ${
                  activeTab === 'overview'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`px-6 py-4 font-medium transition-colors relative ${
                  activeTab === 'requests'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Connection Requests
                {pendingRequests.length > 0 && (
                  <span className="absolute top-2 right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {pendingRequests.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setActiveTab('patients');
                }}
                className={`px-6 py-4 font-medium transition-colors ${
                  activeTab === 'patients'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                My Patients
              </button>
              <button
                onClick={() => {
                  setActiveTab('qr-codes');
                  loadQRTokens();
                }}
                className={`px-6 py-4 font-medium transition-colors ${
                  activeTab === 'qr-codes'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                QR Codes
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-6">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={handleGenerateQR}
                    disabled={generatingQR}
                    className="flex items-center gap-4 p-6 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl text-white hover:from-purple-600 hover:to-indigo-600 transition-all transform hover:scale-105 disabled:opacity-50"
                  >
                    {generatingQR ? (
                      <Loader2 className="w-8 h-8 animate-spin" />
                    ) : (
                      <QrCode className="w-8 h-8" />
                    )}
                    <div className="text-left">
                      <p className="font-bold text-lg">Generate QR Code</p>
                      <p className="text-sm text-purple-100">Share for instant patient connections</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setShowSearchModal(true)}
                    className="flex items-center gap-4 p-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl text-white hover:from-green-600 hover:to-emerald-600 transition-all transform hover:scale-105"
                  >
                    <User className="w-8 h-8" />
                    <div className="text-left">
                      <p className="font-bold text-lg">Search Patient</p>
                      <p className="text-sm text-green-100">Find and connect with patients</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('requests')}
                    className="flex items-center gap-4 p-6 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl text-white hover:from-blue-600 hover:to-cyan-600 transition-all transform hover:scale-105"
                  >
                    <UserPlus className="w-8 h-8" />
                    <div className="text-left">
                      <p className="font-bold text-lg">View Requests</p>
                      <p className="text-sm text-blue-100">{pendingRequests.length} pending connections</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'requests' && (
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-6">Pending Connection Requests</h2>
                {pendingRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <UserPlus className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">No pending requests</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingRequests.map((request) => (
                      <div key={request.id} className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center">
                              <User className="w-6 h-6 text-blue-700" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-gray-800">{request.patient_name}</h3>
                              <p className="text-sm text-gray-600">
                                {request.patient_gender} • {request.patient_age && `Born ${request.patient_age}`}
                              </p>
                            </div>
                          </div>
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                            request.connection_type === 'qr_code'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {request.connection_type === 'qr_code' ? 'QR Code' : 'Manual Request'}
                          </span>
                        </div>

                        {request.patient_note && (
                          <div className="bg-white rounded-lg p-4 mb-4">
                            <p className="text-sm text-gray-700 italic">"{request.patient_note}"</p>
                          </div>
                        )}

                        {request.emergency_contact && (
                          <div className="mb-4">
                            <p className="text-sm text-gray-600">
                              <strong>Emergency Contact:</strong> {request.emergency_contact}
                            </p>
                          </div>
                        )}

                        <div className="flex gap-3">
                          <button
                            onClick={() => handleAcceptRequest(request.id)}
                            className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Accept
                          </button>
                          <button
                            onClick={() => handleRejectRequest(request.id)}
                            className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'patients' && (
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-6">My Patients ({connectedPatients.length})</h2>
                {connectedPatients.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">No connected patients yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {connectedPatients.map((patient) => (
                      <div key={patient.connection_id} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-emerald-200 rounded-full flex items-center justify-center">
                              <User className="w-6 h-6 text-emerald-700" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-gray-800">{patient.patient_name}</h3>
                              <p className="text-sm text-emerald-600 font-medium">{patient.patient_id}</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm text-gray-700">
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span>{patient.patient_phone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span className="truncate">{patient.patient_email}</span>
                          </div>
                          {patient.blood_group && (
                            <div className="flex items-center gap-2">
                              <Activity className="w-4 h-4 text-gray-400" />
                              <span>Blood Group: {patient.blood_group}</span>
                            </div>
                          )}
                        </div>

                        {(patient.allergies || patient.chronic_conditions) && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            {patient.allergies && (
                              <p className="text-xs text-red-600 mb-1">
                                <strong>Allergies:</strong> {patient.allergies}
                              </p>
                            )}
                            {patient.chronic_conditions && (
                              <p className="text-xs text-orange-600">
                                <strong>Conditions:</strong> {patient.chronic_conditions}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-xs text-gray-500">
                            Connected since {new Date(patient.connected_since).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'qr-codes' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">My QR Codes</h2>
                  <button
                    onClick={handleGenerateQR}
                    disabled={generatingQR}
                    className="px-4 py-2 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {generatingQR ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <QrCode className="w-4 h-4" />
                    )}
                    Generate New QR
                  </button>
                </div>

                {qrTokens.length === 0 ? (
                  <div className="text-center py-12">
                    <QrCode className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">No QR codes generated yet</p>
                    <button
                      onClick={handleGenerateQR}
                      className="px-6 py-3 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors"
                    >
                      Generate Your First QR Code
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {qrTokens.map((token) => (
                      <div key={token.token} className={`rounded-xl p-6 border-2 ${
                        token.is_valid
                          ? 'bg-green-50 border-green-200'
                          : token.is_expired
                          ? 'bg-gray-50 border-gray-200'
                          : 'bg-red-50 border-red-200'
                      }`}>
                        <div className="flex items-center justify-between mb-4">
                          <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                            token.is_valid
                              ? 'bg-green-200 text-green-800'
                              : token.is_expired
                              ? 'bg-gray-200 text-gray-800'
                              : 'bg-red-200 text-red-800'
                          }`}>
                            {token.is_valid ? 'Active' : token.is_expired ? 'Expired' : 'Used'}
                          </span>
                          {token.is_expired && (
                            <button
                              onClick={() => handleDeleteQRToken(token.token)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              title="Delete expired QR code"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          )}
                        </div>

                        <div className="space-y-2 text-sm">
                          <div>
                            <p className="text-gray-600">Created</p>
                            <p className="font-medium">{new Date(token.created_at).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Expires</p>
                            <p className="font-medium">{new Date(token.expires_at).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Usage</p>
                            <p className="font-medium">{token.use_count} / {token.max_uses}</p>
                          </div>
                          {token.used_by && (
                            <div>
                              <p className="text-gray-600">Used By</p>
                              <p className="font-medium">{token.used_by}</p>
                            </div>
                          )}
                        </div>

                        {/* Action buttons for QR tokens */}
                        <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                          {token.is_valid && (
                            <button
                              onClick={() => handleViewQRCode(token)}
                              className="flex-1 px-3 py-2 bg-blue-500 text-white text-sm rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-1"
                            >
                              <QrCode className="w-4 h-4" />
                              View QR
                            </button>
                          )}
                          {!token.is_expired && (
                            <button
                              onClick={() => {
                                const url = `${window.location.origin}/patient/scan-qr/${token.token}`;
                                copyToClipboard(url);
                              }}
                              className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg font-medium hover:bg-gray-300 transition-colors flex items-center justify-center gap-1"
                            >
                              <Copy className="w-4 h-4" />
                              Copy
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRModal && qrData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowQRModal(false)}>
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full relative" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <XCircle className="w-5 h-5 text-gray-600" />
            </button>
            
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Your Connection QR Code</h2>
            
            {/* QR Code Image */}
            <div className="bg-white p-6 rounded-xl border-4 border-purple-200 mb-6">
              {qrData.qr_code_image ? (
                <img
                  src={qrData.qr_code_image}
                  alt="QR Code"
                  className="w-full h-auto"
                />
              ) : (
                <div className="text-center py-8">
                  <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 text-sm">QR code image not available</p>
                  <p className="text-gray-500 text-xs mt-2">Use the link below to share</p>
                </div>
              )}
            </div>

            {/* QR Info */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-purple-600" />
                <span className="text-gray-700">
                  <strong>Expires:</strong> {new Date(qrData.expires_at).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-purple-600" />
                <span className="text-gray-700">
                  <strong>Max Uses:</strong> {qrData.max_uses} {qrData.max_uses === 1 ? 'patient' : 'patients'}
                </span>
              </div>
              <div className="pt-2 border-t border-purple-200">
                <p className="text-xs text-gray-600 mb-2"><strong>Connection Link:</strong></p>
                <div className="bg-white rounded p-2 border border-purple-300">
                  <p className="text-xs text-gray-800 break-all font-mono">{qrData.qr_url}</p>
                </div>
              </div>
            </div>

            {/* Primary Actions - WhatsApp Share (Recommended) */}
            <div className="mb-4">
              <button
                onClick={() => shareViaWhatsApp(qrData.qr_url)}
                className="w-full px-4 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-bold hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <Share2 className="w-5 h-5" />
                <span>Share via WhatsApp</span>
              </button>
              <p className="text-xs text-center text-gray-500 mt-2">
                ⭐ Recommended - Send directly to your patient
              </p>
            </div>

            {/* Secondary Actions */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => copyToClipboard(qrData.qr_url)}
                className="px-4 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 shadow"
              >
                <Copy className="w-4 h-4" />
                Copy Link
              </button>
              {qrData.qr_code_image && (
                <button
                  onClick={downloadQRCode}
                  className="px-4 py-3 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2 shadow"
                >
                  <Download className="w-4 h-4" />
                  Download QR
                </button>
              )}
            </div>

            <button
              onClick={() => setShowQRModal(false)}
              className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Patient Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowSearchModal(false)}>
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto relative" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button
              onClick={() => setShowSearchModal(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <XCircle className="w-5 h-5 text-gray-600" />
            </button>

            <h2 className="text-2xl font-bold text-gray-800 mb-6">Search Patients</h2>

            {/* Search Input */}
            <div className="mb-6">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchPatients()}
                  placeholder="Search by name or patient ID..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSearchPatients}
                  disabled={searching}
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Search for patients by name or patient ID to send connection requests
              </p>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-bold text-gray-800 mb-4">Search Results ({searchResults.length})</h3>
                {searchResults.map((result) => (
                  <div key={result.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-bold text-gray-800">{result.full_name}</h4>
                          {result.connection_status && (
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              result.connection_status === 'accepted' 
                                ? 'bg-green-100 text-green-700'
                                : result.connection_status === 'pending'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {result.connection_status === 'accepted' ? '✓ Connected' : 
                               result.connection_status === 'pending' ? 'Pending' : 
                               'Rejected'}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p><strong>Patient ID:</strong> {result.patient_id}</p>
                          {result.age && <p><strong>Age:</strong> {new Date().getFullYear() - result.age} years</p>}
                          {result.gender && <p><strong>Gender:</strong> {result.gender}</p>}
                          {result.blood_group && <p><strong>Blood Group:</strong> {result.blood_group}</p>}
                          {result.city && <p><strong>City:</strong> {result.city}</p>}
                        </div>
                      </div>
                      <div className="ml-4">
                        {!result.connection_status ? (
                          <button
                            onClick={() => handleConnectWithPatient(result.id)}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors text-sm"
                          >
                            Connect
                          </button>
                        ) : (
                          <span className={`px-4 py-2 rounded-lg text-sm font-medium ${
                            result.connection_status === 'accepted'
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : result.connection_status === 'pending'
                              ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                              : 'bg-gray-50 text-gray-600 border border-gray-200'
                          }`}>
                            {result.connection_status.charAt(0).toUpperCase() + result.connection_status.slice(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchResults.length === 0 && searchQuery && !searching && (
              <div className="text-center py-8 text-gray-500">
                No results found. Try a different search term.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DoctorDashboard;
