/**
 * Patient Dashboard
 * Shows patient ID, profile status, connected doctors, and search functionality
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  User,
  Search,
  Users,
  Calendar,
  Shield,
  QrCode,
  Copy,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  LogOut,
  ChevronRight,
  FileText,
  Phone,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [connections, setConnections] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrLink, setQrLink] = useState('');
  const [validatingQR, setValidatingQR] = useState(false);
  const [qrDoctorInfo, setQrDoctorInfo] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [profileData, connectionsData] = await Promise.all([
        api.patient.getProfileSetupStatus(),
        api.patient.getMyConnections(),
      ]);

      setProfile(profileData.profile);
      setConnections(connectionsData.connections || []);

      // If profile not complete, redirect to setup
      if (!profileData.profile_completed) {
        navigate('/patient/profile-setup');
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchDoctors = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setError('');

    try {
      const response = await api.patient.searchDoctors({ q: searchQuery });
      setSearchResults(response.doctors || []);
      if (response.doctors.length === 0) {
        setError('No doctors found matching your search');
      }
    } catch (err) {
      setError('Failed to search doctors');
    } finally {
      setSearching(false);
    }
  };

  const handleConnectDoctor = async (doctorId) => {
    try {
      await api.patient.createConnection({ doctor_profile_id: doctorId });
      setSuccess('Connection request sent successfully!');
      setTimeout(() => {
        setSuccess('');
        loadDashboardData();
        setShowSearch(false);
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send connection request');
    }
  };

  const handleRemoveConnection = async (connectionId) => {
    if (!confirm('Are you sure you want to remove this connection?')) return;

    try {
      await api.patient.removeConnection(connectionId);
      setSuccess('Connection removed successfully');
      setTimeout(() => {
        setSuccess('');
        loadDashboardData();
      }, 2000);
    } catch (err) {
      setError('Failed to remove connection');
    }
  };

  const handleAcceptRequest = async (connectionId) => {
    if (!confirm('Accept this connection request from the doctor?')) return;

    try {
      await api.patient.acceptConnection(connectionId, 'Thank you for connecting!');
      setSuccess('Connection accepted successfully!');
      setTimeout(() => {
        setSuccess('');
        loadDashboardData();
      }, 2000);
    } catch (err) {
      setError('Failed to accept connection');
    }
  };

  const handleRejectRequest = async (connectionId) => {
    if (!confirm('Reject this connection request?')) return;

    try {
      await api.patient.rejectConnection(connectionId);
      setSuccess('Connection rejected');
      setTimeout(() => {
        setSuccess('');
        loadDashboardData();
      }, 2000);
    } catch (err) {
      setError('Failed to reject connection');
    }
  };

  const copyPatientId = () => {
    if (profile?.patient_id) {
      navigator.clipboard.writeText(profile.patient_id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleQRLinkPaste = async () => {
    if (!qrLink.trim()) {
      setError('Please enter a QR link');
      return;
    }

    setValidatingQR(true);
    setError('');
    
    try {
      // Extract token from URL - handle various formats
      let token = '';
      
      // Check if it's a full URL or just a token
      if (qrLink.includes('/scan-qr/')) {
        const parts = qrLink.split('/scan-qr/');
        token = parts[1] ? parts[1].replace(/\/$/, '') : ''; // Remove trailing slash
      } else if (qrLink.includes('/patient/scan-qr/')) {
        const parts = qrLink.split('/patient/scan-qr/');
        token = parts[1] ? parts[1].replace(/\/$/, '') : '';
      } else {
        // Assume it's just the token
        token = qrLink.trim();
      }
      
      if (!token || token.length < 20) {
        setError('Invalid QR link format. Please paste the complete link shared by your doctor.');
        setValidatingQR(false);
        return;
      }

      // Validate QR token first
      const validateResponse = await api.patient.validateQRToken(token);
      
      if (!validateResponse.valid) {
        setError(validateResponse.message || 'QR code is invalid or expired');
        setValidatingQR(false);
        return;
      }

      // Show doctor info
      setQrDoctorInfo(validateResponse.doctor);
      
      // Auto-connect
      const scanResponse = await api.patient.scanQRCode(token);
      
      setSuccess(`Successfully connected with Dr. ${validateResponse.doctor.name}!`);
      setShowQRModal(false);
      setQrLink('');
      setQrDoctorInfo(null);
      
      setTimeout(() => {
        setSuccess('');
        loadDashboardData();
      }, 2000);
      
    } catch (err) {
      console.error('Error scanning QR:', err);
      const errorMsg = err.response?.data?.error || 'Failed to connect using QR code';
      
      // Handle specific error cases
      if (errorMsg.includes('already connected')) {
        setError('You are already connected with this doctor');
      } else if (errorMsg.includes('complete your profile')) {
        setError('Please complete your profile first');
      } else {
        setError(errorMsg);
      }
    } finally {
      setValidatingQR(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/patient/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const connectedDoctors = connections.filter((c) => c.status === 'accepted');
  const pendingConnections = connections.filter((c) => c.status === 'pending');

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-cyan-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-teal-500 rounded-xl flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">MediStack 360</h1>
                <p className="text-sm text-gray-500">Patient Dashboard</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-red-600 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-700 px-6 py-4 rounded-xl mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-6 h-6" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')}>
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border-2 border-green-200 text-green-700 px-6 py-4 rounded-xl mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-6 h-6" />
              <span>{success}</span>
            </div>
            <button onClick={() => setSuccess('')}>
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Welcome Section with Patient ID */}
        <div className="bg-gradient-to-r from-green-600 via-teal-600 to-cyan-600 rounded-2xl shadow-xl p-8 text-white mb-8">
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-2">
                Welcome back, {profile?.first_name || 'Patient'}!
              </h2>
              <p className="text-green-100">Your health journey dashboard</p>
            </div>

            {/* Patient ID Card */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-green-100">Your Patient ID</span>
                <QrCode className="w-5 h-5 text-green-100" />
              </div>
              <div className="font-mono text-3xl font-bold mb-3">{profile?.patient_id || 'N/A'}</div>
              <div className="flex gap-2">
                <button
                  onClick={copyPatientId}
                  className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm py-2 px-4 rounded-lg transition-all flex items-center justify-center space-x-2"
                >
                  {copiedId ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span className="text-sm">{copiedId ? 'Copied!' : 'Copy ID'}</span>
                </button>
                <button className="bg-white/20 hover:bg-white/30 backdrop-blur-sm py-2 px-4 rounded-lg transition-all">
                  <QrCode className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{connectedDoctors.length}</span>
            </div>
            <h3 className="text-gray-600 font-medium">Connected Doctors</h3>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{pendingConnections.length}</span>
            </div>
            <h3 className="text-gray-600 font-medium">Pending Requests</h3>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                {profile?.profile_completed ? (
                  <CheckCircle className="w-6 h-6 text-blue-600" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-blue-600" />
                )}
              </div>
              <span className="text-sm font-semibold px-3 py-1 bg-green-100 text-green-700 rounded-full">
                {profile?.profile_completed ? 'Complete' : 'Incomplete'}
              </span>
            </div>
            <h3 className="text-gray-600 font-medium">Profile Status</h3>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Connected Doctors */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search & Connect Options */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Connect with Doctors</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setShowSearch(!showSearch)}
                  className="bg-gradient-to-r from-green-600 to-teal-600 text-white py-4 rounded-xl hover:shadow-xl transition-all font-semibold flex items-center justify-center space-x-2"
                >
                  <Search className="w-5 h-5" />
                  <span>Search Doctors</span>
                </button>
                <button
                  onClick={() => setShowQRModal(true)}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl hover:shadow-xl transition-all font-semibold flex items-center justify-center space-x-2"
                >
                  <QrCode className="w-5 h-5" />
                  <span>Scan QR Code</span>
                </button>
              </div>

              {/* Search Panel */}
              {showSearch && (
                <div className="mt-6 border-t pt-6">
                  <form onSubmit={handleSearchDoctors} className="mb-6">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name, specialty, or doctor ID..."
                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                      <button
                        type="submit"
                        disabled={searching}
                        className="bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition-all disabled:opacity-50"
                      >
                        {searching ? 'Searching...' : 'Search'}
                      </button>
                    </div>
                  </form>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Search Results ({searchResults.length})</h4>
                      {searchResults.map((doctor) => (
                        <div
                          key={doctor.id}
                          className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:border-green-500 transition-all"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h5 className="font-bold text-gray-900">{doctor.display_name}</h5>
                              <p className="text-sm text-gray-600">{doctor.specialization}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {doctor.primary_clinic_hospital} • {doctor.city}
                              </p>
                              <span className="inline-block mt-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                {doctor.doctor_id}
                              </span>
                            </div>
                            <button
                              onClick={() => handleConnectDoctor(doctor.id)}
                              className="ml-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all text-sm font-semibold"
                            >
                              Connect
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Pending Connection Requests */}
            {pendingConnections.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6 border border-yellow-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <Clock className="w-6 h-6 mr-2 text-yellow-600" />
                  Pending Requests ({pendingConnections.length})
                </h3>
                <div className="space-y-4">
                  {pendingConnections.map((connection) => (
                    <div
                      key={connection.id}
                      className="bg-yellow-50 rounded-xl p-4 border-2 border-yellow-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="font-bold text-gray-900">{connection.doctor_name}</h4>
                            <Clock className="w-5 h-5 text-yellow-600" />
                          </div>
                          <p className="text-sm text-gray-600 mb-1">{connection.doctor_specialization}</p>
                          <span className="text-xs bg-white px-2 py-1 rounded-full text-gray-600 mr-2">
                            {connection.doctor_id}
                          </span>
                          {connection.doctor_note && (
                            <p className="text-sm text-gray-600 mt-2 italic">
                              "{connection.doctor_note}"
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 ml-4">
                          <button
                            onClick={() => handleAcceptRequest(connection.id)}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all text-sm font-semibold flex items-center space-x-1"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>Accept</span>
                          </button>
                          <button
                            onClick={() => handleRejectRequest(connection.id)}
                            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-all text-sm font-semibold flex items-center space-x-1"
                          >
                            <X className="w-4 h-4" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Connected Doctors List */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <Users className="w-6 h-6 mr-2 text-green-600" />
                My Doctors ({connectedDoctors.length})
              </h3>

              {connectedDoctors.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>No connected doctors yet</p>
                  <p className="text-sm mt-1">Search and connect with doctors to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {connectedDoctors.map((connection) => (
                    <div
                      key={connection.id}
                      className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl p-4 border-2 border-green-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="font-bold text-gray-900">{connection.doctor_name}</h4>
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          </div>
                          <p className="text-sm text-gray-600 mb-1">{connection.doctor_specialization}</p>
                          <span className="text-xs bg-white px-2 py-1 rounded-full text-gray-600">
                            {connection.doctor_id}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveConnection(connection.id)}
                          className="text-red-600 hover:text-red-700 p-2"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Connections */}
            {pendingConnections.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <Clock className="w-6 h-6 mr-2 text-yellow-600" />
                  Pending Requests ({pendingConnections.length})
                </h3>

                <div className="space-y-3">
                  {pendingConnections.map((connection) => (
                    <div key={connection.id} className="bg-yellow-50 rounded-xl p-4 border-2 border-yellow-200">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-gray-900">{connection.doctor_name}</h4>
                          <p className="text-sm text-gray-600">{connection.doctor_specialization}</p>
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full mt-2 inline-block">
                            Awaiting approval
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Profile Info */}
          <div className="space-y-6">
            {/* Profile Summary */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{profile?.full_name}</h3>
                  <p className="text-sm text-gray-500">{profile?.email}</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Patient ID</span>
                  <span className="font-semibold text-gray-900">{profile?.patient_id}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Phone</span>
                  <span className="font-semibold text-gray-900">{profile?.phone_number || 'Not set'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Date of Birth</span>
                  <span className="font-semibold text-gray-900">{profile?.date_of_birth || 'Not set'}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-600">Gender</span>
                  <span className="font-semibold text-gray-900 capitalize">{profile?.gender || 'Not set'}</span>
                </div>
              </div>

              <button
                onClick={() => navigate('/patient/profile')}
                className="w-full mt-4 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg transition-all font-semibold flex items-center justify-center space-x-2"
              >
                <span>View Full Profile</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Emergency Contact */}
            {profile?.emergency_contact_name && (
              <div className="bg-red-50 rounded-xl shadow-lg p-6 border-2 border-red-200">
                <h3 className="font-bold text-red-900 mb-4 flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  Emergency Contact
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-700">
                    <User className="w-4 h-4 mr-2" />
                    <span>{profile.emergency_contact_name}</span>
                  </div>
                  <div className="flex items-center text-gray-700">
                    <Phone className="w-4 h-4 mr-2" />
                    <span>{profile.emergency_contact_phone}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl shadow-lg p-6 border border-blue-200">
              <h3 className="font-bold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button className="w-full bg-white hover:bg-gray-50 text-gray-700 py-3 px-4 rounded-lg transition-all font-medium flex items-center space-x-2 border border-gray-200">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <span>Book Appointment</span>
                </button>
                <button className="w-full bg-white hover:bg-gray-50 text-gray-700 py-3 px-4 rounded-lg transition-all font-medium flex items-center space-x-2 border border-gray-200">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span>View Medical Records</span>
                </button>
                <button
                  onClick={() => navigate('/patient/profile-setup')}
                  className="w-full bg-white hover:bg-gray-50 text-gray-700 py-3 px-4 rounded-lg transition-all font-medium flex items-center space-x-2 border border-gray-200"
                >
                  <User className="w-5 h-5 text-blue-600" />
                  <span>Update Profile</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Scanning Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowQRModal(false)}>
          <div className="bg-white rounded-2xl p-8 max-w-md w-full relative" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>

            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <QrCode className="w-7 h-7 text-purple-600" />
              Connect via QR Code
            </h2>

            <div className="space-y-5">
              <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
                <p className="text-sm text-gray-700">
                  <strong>How to connect:</strong><br/>
                  1. Get the QR link from your doctor (via WhatsApp, SMS, etc.)<br/>
                  2. Paste the complete link below<br/>
                  3. Click "Connect Now" to establish connection
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  QR Code Link <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={qrLink}
                    onChange={(e) => setQrLink(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleQRLinkPaste()}
                    placeholder="http://localhost:5174/patient/scan-qr/abc123..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10"
                  />
                  {qrLink && (
                    <button
                      onClick={() => setQrLink('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Paste the complete URL starting with http:// or https://
                </p>
              </div>

              {qrDoctorInfo && (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-lg p-4 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {qrDoctorInfo.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-600">Connecting with:</p>
                      <p className="text-lg font-bold text-gray-900">Dr. {qrDoctorInfo.name}</p>
                      <p className="text-sm text-purple-700">{qrDoctorInfo.specialization}</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                </div>
              )}

              <button
                onClick={handleQRLinkPaste}
                disabled={validatingQR || !qrLink.trim()}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-lg font-bold hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
              >
                {validatingQR ? (
                  <>
                    <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <QrCode className="w-6 h-6" />
                    <span>Connect with Doctor</span>
                  </>
                )}
              </button>

              <div className="text-center pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  <strong>Note:</strong> Make sure you trust the doctor before connecting. 
                  The QR link is unique and can only be used once.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
