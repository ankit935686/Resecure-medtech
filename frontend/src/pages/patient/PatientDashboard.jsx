import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  User,
  Search,
  Users,
  Calendar,
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
  Activity,
  Droplet,
  Wind,
  TrendingUp,
  ChevronLeft,
  Bell,
  Settings,
  Menu,
  Loader2,
  ClipboardList,
  Sparkles,
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
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [careSpaces, setCareSpaces] = useState([]);
  const [careSpacesLoading, setCareSpacesLoading] = useState(true);
  const [intakeForms, setIntakeForms] = useState([]);
  const [intakeFormsLoading, setIntakeFormsLoading] = useState(true);

  useEffect(() => {
    const initDashboard = async () => {
      try {
        await loadDashboardData();
        await loadCareSpaces();
        await loadIntakeForms();
      } catch (err) {
        console.error('Dashboard initialization error:', err);
        setError('Failed to load dashboard. Please refresh the page.');
        setLoading(false);
      }
    };
    
    initDashboard();
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

  const loadCareSpaces = async () => {
    try {
      setCareSpacesLoading(true);
      const response = await api.patient.getCareWorkspaces();
      setCareSpaces(response.workspaces || []);
    } catch (err) {
      console.error('Error loading care spaces:', err);
    } finally {
      setCareSpacesLoading(false);
    }
  };

  const loadIntakeForms = async () => {
    try {
      setIntakeFormsLoading(true);
      const response = await api.patient.getIntakeForms();
      setIntakeForms(response.forms || []);
    } catch (err) {
      console.error('Error loading intake forms:', err);
    } finally {
      setIntakeFormsLoading(false);
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
      let token = '';

      if (qrLink.includes('/scan-qr/')) {
        const parts = qrLink.split('/scan-qr/');
        token = parts[1] ? parts[1].replace(/\/$/, '') : '';
      } else if (qrLink.includes('/patient/scan-qr/')) {
        const parts = qrLink.split('/patient/scan-qr/');
        token = parts[1] ? parts[1].replace(/\/$/, '') : '';
      } else {
        token = qrLink.trim();
      }

      if (!token || token.length < 20) {
        setError('Invalid QR link format. Please paste the complete link shared by your doctor.');
        setValidatingQR(false);
        return;
      }

      const validateResponse = await api.patient.validateQRToken(token);

      if (!validateResponse.valid) {
        setError(validateResponse.message || 'QR code is invalid or expired');
        setValidatingQR(false);
        return;
      }

      setQrDoctorInfo(validateResponse.doctor);

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

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const renderCalendar = () => {
    const { firstDay, daysInMonth } = getDaysInMonth(currentMonth);
    const today = new Date().getDate();
    const currentMonthNum = new Date().getMonth();
    const isCurrentMonth = currentMonth.getMonth() === currentMonthNum;

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-8"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = isCurrentMonth && day === today;
      days.push(
        <div
          key={day}
          className={`h-8 flex items-center justify-center text-sm rounded-lg cursor-pointer transition-colors ${
            isToday
              ? 'bg-blue-500 text-white font-semibold'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          {day}
        </div>
      );
    }

    return days;
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];

  const workspaceStatusStyles = {
    active: {
      badge: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
      gradient: 'from-emerald-500 to-teal-500',
    },
    on_hold: {
      badge: 'bg-amber-50 text-amber-700 border border-amber-100',
      gradient: 'from-amber-500 to-orange-500',
    },
    completed: {
      badge: 'bg-blue-50 text-blue-700 border border-blue-100',
      gradient: 'from-blue-500 to-indigo-500',
    },
    archived: {
      badge: 'bg-slate-100 text-slate-500 border border-slate-200',
      gradient: 'from-slate-400 to-slate-500',
    },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const connectedDoctors = connections.filter((c) => c.status === 'accepted');
  const pendingConnections = connections.filter((c) => c.status === 'pending');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full bg-white shadow-2xl w-20 flex flex-col items-center py-6 z-40 transition-all ${sidebarOpen ? 'translate-x-0' : ''}`}>
        <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-2xl flex items-center justify-center mb-8 shadow-lg">
          <Heart className="w-6 h-6 text-white" />
        </div>

        <nav className="flex-1 flex flex-col space-y-4">
          <button className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-all shadow-sm">
            <Activity className="w-6 h-6" />
          </button>
          <button className="w-12 h-12 rounded-2xl text-gray-400 flex items-center justify-center hover:bg-gray-50 transition-all">
            <Calendar className="w-6 h-6" />
          </button>
          <button className="w-12 h-12 rounded-2xl text-gray-400 flex items-center justify-center hover:bg-gray-50 transition-all">
            <FileText className="w-6 h-6" />
          </button>
          <button className="w-12 h-12 rounded-2xl text-gray-400 flex items-center justify-center hover:bg-gray-50 transition-all">
            <Users className="w-6 h-6" />
          </button>
          <button className="w-12 h-12 rounded-2xl text-gray-400 flex items-center justify-center hover:bg-gray-50 transition-all">
            <Clock className="w-6 h-6" />
          </button>
        </nav>

        <div className="space-y-4">
          <button className="w-12 h-12 rounded-2xl text-gray-400 flex items-center justify-center hover:bg-gray-50 transition-all">
            <Settings className="w-6 h-6" />
          </button>
          <button
            onClick={handleLogout}
            className="w-12 h-12 rounded-2xl text-gray-400 flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-20 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-gray-500 text-sm mb-1">Hi {profile?.first_name || 'Patient'},</p>
            <h1 className="text-3xl font-bold text-gray-800">Welcome Back!</h1>
          </div>

          <div className="flex items-center space-x-4">
            <button className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:shadow-xl transition-all">
              <Bell className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => setShowSearch(true)}
              className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 shadow-lg flex items-center justify-center hover:shadow-xl transition-all"
            >
              <Search className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl mb-6 flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')}>
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-2xl mb-6 flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5" />
              <span>{success}</span>
            </div>
            <button onClick={() => setSuccess('')}>
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero Card with Doctor Image */}
            <div className="bg-gradient-to-br from-cyan-400 via-blue-400 to-blue-500 rounded-3xl shadow-2xl p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24"></div>

              <div className="relative z-10 flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-cyan-100 mb-2 font-medium">Reminder</p>
                  <h2 className="text-3xl font-bold mb-6 leading-tight">
                    Have You Had a<br />Routine Health Check<br />this Month?
                  </h2>
                  <div className="flex space-x-3">
                    <button className="bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold hover:shadow-xl transition-all">
                      Check Now
                    </button>
                    <button className="bg-white/20 backdrop-blur-sm text-white px-6 py-3 rounded-xl font-semibold hover:bg-white/30 transition-all">
                      View Report
                    </button>
                  </div>
                </div>

                <div className="hidden md:block">
                  <img
                    src="https://images.pexels.com/photos/5215024/pexels-photo-5215024.jpeg?auto=compress&cs=tinysrgb&w=400"
                    alt="Doctor"
                    className="w-64 h-80 object-cover rounded-2xl shadow-2xl"
                  />
                </div>
              </div>
            </div>

            {/* Health Metrics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center">
                    <Heart className="w-5 h-5 text-pink-500" />
                  </div>
                  <div className="text-sm text-gray-500">Heart Rate</div>
                </div>
                <div className="text-3xl font-bold text-gray-800">80 <span className="text-base text-gray-500">beats / min</span></div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Droplet className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="text-sm text-gray-500">Blood Group</div>
                </div>
                <div className="text-3xl font-bold text-gray-800">4.75 <span className="text-base text-gray-500">liters</span></div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
                    <Wind className="w-5 h-5 text-cyan-500" />
                  </div>
                  <div className="text-sm text-gray-500">Glucose</div>
                </div>
                <div className="text-3xl font-bold text-gray-800">5 <span className="text-base text-gray-500">million / ml</span></div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Body Fluid Composition */}
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-800">Body Fluid Composition</h3>
                  <span className="text-sm text-green-500 font-semibold">+15%</span>
                </div>
                <p className="text-xs text-gray-400 mb-4">60% of the total</p>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Extracellular</span>
                      <span className="font-semibold">20%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-300 to-cyan-400" style={{width: '20%'}}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Intracellular</span>
                      <span className="font-semibold">30%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-400 to-blue-500" style={{width: '30%'}}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Mineral</span>
                      <span className="font-semibold">10%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-200 to-cyan-300" style={{width: '10%'}}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Protein</span>
                      <span className="font-semibold">16.4%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-purple-400 to-purple-500" style={{width: '16.4%'}}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Carbohydrates</span>
                      <span className="font-semibold">0.1%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-pink-400 to-pink-500" style={{width: '0.1%'}}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Fat Mass</span>
                      <span className="font-semibold">8.7%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-orange-400 to-orange-500" style={{width: '8.7%'}}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Composition of Solids */}
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-800">Composition of Solids</h3>
                  <button className="text-sm text-blue-500 font-semibold hover:text-blue-600">View Report</button>
                </div>
                <p className="text-xs text-gray-400 mb-6">Atomic and molecular</p>

                <div className="relative w-48 h-48 mx-auto mb-6">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="96" cy="96" r="80" fill="none" stroke="#E5E7EB" strokeWidth="24"></circle>
                    <circle cx="96" cy="96" r="80" fill="none" stroke="#60A5FA" strokeWidth="24" strokeDasharray="502" strokeDashoffset="125"></circle>
                    <circle cx="96" cy="96" r="80" fill="none" stroke="#34D399" strokeWidth="24" strokeDasharray="502" strokeDashoffset="250"></circle>
                    <circle cx="96" cy="96" r="80" fill="none" stroke="#A78BFA" strokeWidth="24" strokeDasharray="502" strokeDashoffset="375"></circle>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-gray-800">40%</div>
                      <div className="text-xs text-gray-500">Total</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                      <span className="text-sm text-gray-600">Protein</span>
                    </div>
                    <span className="text-sm font-semibold">16.4%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                      <span className="text-sm text-gray-600">Carbohydrates</span>
                    </div>
                    <span className="text-sm font-semibold">0.1%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                      <span className="text-sm text-gray-600">Fat Mass</span>
                    </div>
                    <span className="text-sm font-semibold">8.7%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Connected Doctors Section */}
            {connectedDoctors.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center">
                    <Users className="w-6 h-6 mr-2 text-blue-500" />
                    My Doctors ({connectedDoctors.length})
                  </h3>
                  <button
                    onClick={() => setShowSearch(true)}
                    className="text-sm text-blue-500 font-semibold hover:text-blue-600 flex items-center"
                  >
                    Add More <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {connectedDoctors.map((connection) => (
                    <div
                      key={connection.id}
                      className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3 flex-1">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
                            {connection.doctor_name.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-800">{connection.doctor_name}</h4>
                            <p className="text-sm text-gray-600">{connection.doctor_specialization}</p>
                            <span className="inline-block mt-1 text-xs bg-white px-2 py-1 rounded-full text-gray-600">
                              {connection.doctor_id}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveConnection(connection.id)}
                          className="text-red-500 hover:text-red-600 p-2"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Requests */}
            {pendingConnections.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                  <Clock className="w-6 h-6 mr-2 text-yellow-500" />
                  Pending Requests ({pendingConnections.length})
                </h3>
                <div className="space-y-4">
                  {pendingConnections.map((connection) => (
                    <div
                      key={connection.id}
                      className="bg-yellow-50 rounded-xl p-4 border border-yellow-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="font-bold text-gray-800">{connection.doctor_name}</h4>
                            <Clock className="w-5 h-5 text-yellow-600" />
                          </div>
                          <p className="text-sm text-gray-600 mb-1">{connection.doctor_specialization}</p>
                          <span className="text-xs bg-white px-2 py-1 rounded-full text-gray-600">
                            {connection.doctor_id}
                          </span>
                          {connection.doctor_note && (
                            <p className="text-sm text-gray-600 mt-2 italic">"{connection.doctor_note}"</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 ml-4">
                          <button
                            onClick={() => handleAcceptRequest(connection.id)}
                            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-all text-sm font-semibold flex items-center space-x-1"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>Accept</span>
                          </button>
                          <button
                            onClick={() => handleRejectRequest(connection.id)}
                            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-all text-sm font-semibold flex items-center space-x-1"
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

            {/* Doctor-Specific Care Spaces */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-purple-500" />
                    My Care Spaces
                  </h3>
                  <p className="text-sm text-gray-500">Doctor-specific updates & treatment plans</p>
                </div>
                <button
                  onClick={() => navigate('/patient/workspaces/' + (careSpaces[0]?.connection_id || ''))}
                  disabled={!careSpaces.length}
                  className="text-sm font-semibold text-purple-600 hover:text-purple-700 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  Explore
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {careSpacesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                </div>
              ) : careSpaces.length === 0 ? (
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100 rounded-2xl p-6 text-center">
                  <p className="text-gray-600 font-medium mb-2">No care spaces yet</p>
                  <p className="text-sm text-gray-500 mb-4">
                    Connect with a verified doctor to unlock personalized treatment spaces.
                  </p>
                  <button
                    onClick={() => setShowSearch(true)}
                    className="px-5 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-full text-sm font-semibold shadow hover:shadow-lg transition-all"
                  >
                    Find Doctors
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {careSpaces.map((space) => {
                    const styles = workspaceStatusStyles[space.status] || workspaceStatusStyles.active;
                    return (
                      <div
                        key={space.id}
                        className="rounded-2xl border border-gray-100 p-5 bg-gradient-to-br from-white to-purple-50 shadow-sm hover:shadow-lg transition-all flex flex-col"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                              Dr. {space.doctor_name}
                            </p>
                            <h4 className="text-lg font-bold text-gray-900">{space.title}</h4>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles.badge}`}>
                            {space.status.replace('_', ' ')}
                          </span>
                        </div>

                        <p className="text-sm text-gray-600 flex-1 overflow-hidden">
                          {space.summary || 'No overview shared yet.'}
                        </p>

                        {space.latest_entry && (
                          <div className="mt-4 bg-white/70 rounded-xl p-3 border border-purple-100">
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                              Latest update
                            </p>
                            <p className="text-sm font-semibold text-gray-800">
                              {space.latest_entry.title}
                            </p>
                            {space.latest_entry.summary && (
                              <p className="text-xs text-gray-500 mt-1 overflow-hidden">
                                {space.latest_entry.summary}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="mt-5 flex items-center justify-between">
                          <div className="text-xs text-gray-500">
                            <p>Patient ID: {space.patient_id}</p>
                            <p>
                              Next review:{' '}
                              {space.next_review_date
                                ? new Date(space.next_review_date).toLocaleDateString()
                                : 'TBD'}
                            </p>
                          </div>
                          <button
                            onClick={() => navigate(`/patient/workspaces/${space.connection_id}`)}
                            className={`px-4 py-2 text-sm font-semibold text-white rounded-xl shadow flex items-center gap-1 bg-gradient-to-r ${styles.gradient} hover:opacity-90 transition`}
                          >
                            View Space
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Intake Forms Section */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-teal-500" />
                    Forms & Requests
                  </h3>
                  <p className="text-sm text-gray-500">Doctor intake forms requiring your input</p>
                </div>
              </div>

              {intakeFormsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
                </div>
              ) : intakeForms.length === 0 ? (
                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-100 rounded-2xl p-6 text-center">
                  <ClipboardList className="w-10 h-10 text-teal-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium mb-2">No pending forms</p>
                  <p className="text-sm text-gray-500">When your doctors send intake forms, they'll appear here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {intakeForms.slice(0, 3).map((form) => {
                    const statusConfig = {
                      sent: { color: 'bg-yellow-100 text-yellow-700', label: 'Pending', icon: Clock },
                      in_progress: { color: 'bg-blue-100 text-blue-700', label: 'In Progress', icon: Activity },
                      submitted: { color: 'bg-green-100 text-green-700', label: 'Submitted', icon: CheckCircle },
                      reviewed: { color: 'bg-purple-100 text-purple-700', label: 'Reviewed', icon: CheckCircle },
                    };
                    const status = statusConfig[form.status] || statusConfig.sent;
                    const StatusIcon = status.icon;

                    return (
                      <div
                        key={form.id}
                        className="rounded-2xl border border-gray-100 p-5 bg-gradient-to-br from-white to-teal-50 shadow-sm hover:shadow-lg transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                                <StatusIcon className="w-3 h-3" />
                                {status.label}
                              </span>
                              {form.status === 'sent' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                  <Sparkles className="w-3 h-3" />
                                  New
                                </span>
                              )}
                            </div>
                            <h4 className="font-bold text-gray-900">{form.title}</h4>
                            <p className="text-sm text-gray-500 mt-1">
                              From: Dr. {form.doctor_name}
                            </p>
                            {form.description && (
                              <p className="text-sm text-gray-600 mt-2 line-clamp-2">{form.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => navigate(`/patient/forms/${form.id}`)}
                            className="px-4 py-2 text-sm font-semibold text-white rounded-xl shadow flex items-center gap-1 bg-gradient-to-r from-teal-500 to-cyan-500 hover:opacity-90 transition"
                          >
                            {form.status === 'sent' ? 'Fill Form' : 'View'}
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {intakeForms.length > 3 && (
                    <button
                      onClick={() => {}}
                      className="w-full py-3 text-center text-teal-600 font-semibold hover:bg-teal-50 rounded-xl transition-colors"
                    >
                      View all {intakeForms.length} forms
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Upcoming Check-Up Calendar */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-500">Upcoming Check-Up</h3>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                    className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                    className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>

              <div className="text-center mb-4">
                <h4 className="text-lg font-bold text-gray-800">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h4>
              </div>

              <div className="grid grid-cols-7 gap-2 mb-2">
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
                  <div key={day} className="text-xs text-gray-400 text-center font-medium">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {renderCalendar()}
              </div>
            </div>

            {/* Last Health Check */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-sm font-semibold text-gray-500 mb-4">Your Last Health Check</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-xl">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Activity className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800 text-sm">Dental Health</h4>
                    <p className="text-xs text-gray-500">November 21, 2021</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-xl">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Activity className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800 text-sm">Brain IQ Test</h4>
                    <p className="text-xs text-gray-500">November 12, 2021</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-3 bg-orange-50 rounded-xl">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Activity className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800 text-sm">Regular Kidney Check</h4>
                    <p className="text-xs text-gray-500">August 12, 2021</p>
                  </div>
                </div>

                <button className="w-full text-blue-500 font-semibold text-sm hover:text-blue-600 flex items-center justify-center space-x-1 mt-3">
                  <span>View all</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Insurance Balance */}
            <div className="bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl shadow-lg p-6 text-white">
              <h3 className="text-sm font-semibold text-blue-100 mb-4">Insurance Balance</h3>
              <div className="mb-4">
                <div className="text-4xl font-bold mb-2">$24,000</div>
                <div className="flex items-center space-x-2 text-sm text-blue-100">
                  <div className="w-2 h-2 bg-blue-300 rounded-full"></div>
                  <span>Your Card</span>
                </div>
              </div>
            </div>

            {/* Patient ID Card */}
            <div className="bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-purple-100">Your Patient ID</span>
                <QrCode className="w-5 h-5 text-purple-100" />
              </div>
              <div className="font-mono text-2xl font-bold mb-4">{profile?.patient_id || 'N/A'}</div>
              <div className="flex gap-2">
                <button
                  onClick={copyPatientId}
                  className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm py-2 px-4 rounded-xl transition-all flex items-center justify-center space-x-2"
                >
                  {copiedId ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span className="text-sm">{copiedId ? 'Copied!' : 'Copy ID'}</span>
                </button>
                <button
                  onClick={() => setShowQRModal(true)}
                  className="bg-white/20 hover:bg-white/30 backdrop-blur-sm py-2 px-4 rounded-xl transition-all"
                >
                  <QrCode className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Modal */}
      {showSearch && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowSearch(false)}>
          <div className="bg-white rounded-3xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Search Doctors</h2>
              <button
                onClick={() => setShowSearch(false)}
                className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSearchDoctors} className="mb-6">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, specialty, or doctor ID..."
                  className="flex-1 px-6 py-4 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-8 py-4 rounded-2xl hover:shadow-lg transition-all disabled:opacity-50 font-semibold"
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </div>
            </form>

            {searchResults.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-800 mb-4">Results ({searchResults.length})</h4>
                {searchResults.map((doctor) => (
                  <div
                    key={doctor.id}
                    className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl p-5 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full flex items-center justify-center text-white font-bold text-xl">
                          {doctor.display_name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <h5 className="font-bold text-gray-900 text-lg">{doctor.display_name}</h5>
                          <p className="text-sm text-gray-600">{doctor.specialization}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {doctor.primary_clinic_hospital} • {doctor.city}
                          </p>
                          <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">
                            {doctor.doctor_id}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleConnectDoctor(doctor.id)}
                        className="ml-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all text-sm font-semibold"
                      >
                        Connect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowQRModal(false)}>
          <div className="bg-white rounded-3xl p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute top-4 right-4 w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>

            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
              <QrCode className="w-8 h-8 text-purple-600" />
              Connect via QR Code
            </h2>

            <div className="space-y-5">
              <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>How to connect:</strong><br/>
                  1. Get the QR link from your doctor<br/>
                  2. Paste the complete link below<br/>
                  3. Click "Connect" to establish connection
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  QR Code Link <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={qrLink}
                  onChange={(e) => setQrLink(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleQRLinkPaste()}
                  placeholder="Paste QR link here..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                />
              </div>

              {qrDoctorInfo && (
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl p-4">
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
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-bold hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {validatingQR ? (
                  <>
                    <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <QrCode className="w-5 h-5" />
                    <span>Connect with Doctor</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
