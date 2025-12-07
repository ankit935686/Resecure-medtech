"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../../contexts/AuthContext"
import { useNavigate } from "react-router-dom"
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
  Phone,
  Mail,
  Stethoscope,
  Loader2,
  Activity,
  Menu,
  Bell,
  LogOut,
  ChevronLeft,
  ArrowRight,
  FileText,
  ClipboardList,
  Sparkles,
  Send,
} from "lucide-react"
import api from "../../services/api"

function DoctorDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("overview")
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [connectedPatients, setConnectedPatients] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [qrTokens, setQRTokens] = useState([])
  const [generatingQR, setGeneratingQR] = useState(false)
  const [qrData, setQRData] = useState(null)
  const [showQRModal, setShowQRModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [hoveredSidebar, setHoveredSidebar] = useState(false)
  const [intakeForms, setIntakeForms] = useState([])

  const sidebarOpen = sidebarExpanded || hoveredSidebar

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const [profileRes, patientsRes, requestsRes, formsRes] = await Promise.all([
        api.doctor.getProfile(),
        api.doctor.getConnectedPatients(),
        api.doctor.getConnectionRequests(),
        api.doctor.getIntakeForms(),
      ])

      setProfile(profileRes)
      setConnectedPatients(patientsRes.connected_patients || [])
      setPendingRequests(requestsRes.pending_requests || [])
      setIntakeForms(formsRes.forms || [])
    } catch (error) {
      console.error("Error loading dashboard:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadQRTokens = async () => {
    try {
      const response = await api.doctor.getMyQRTokens()
      setQRTokens(response.tokens || [])
    } catch (error) {
      console.error("Error loading QR tokens:", error)
    }
  }

  const handleGenerateQR = async () => {
    try {
      setGeneratingQR(true)
      const response = await api.doctor.generateQRCode({
        expiry_hours: 24,
        max_uses: 1,
        frontend_url: window.location.origin,
      })
      setQRData(response)
      setShowQRModal(true)
      await loadQRTokens()
    } catch (error) {
      console.error("Error generating QR code:", error)
      alert(error.response?.data?.error || "Failed to generate QR code")
    } finally {
      setGeneratingQR(false)
    }
  }

  const handleAcceptRequest = async (connectionId) => {
    if (!confirm("Accept this connection request?")) return

    try {
      await api.doctor.acceptConnection(connectionId, "Welcome! Looking forward to helping you.")
      await loadDashboardData()
      alert("Connection accepted successfully!")
    } catch (error) {
      console.error("Error accepting connection:", error)
      alert("Failed to accept connection")
    }
  }

  const handleRejectRequest = async (connectionId) => {
    if (!confirm("Reject this connection request?")) return

    try {
      await api.doctor.rejectConnection(connectionId, "Currently not accepting new patients.")
      await loadDashboardData()
      alert("Connection rejected")
    } catch (error) {
      console.error("Error rejecting connection:", error)
      alert("Failed to reject connection")
    }
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      alert("✓ Link copied to clipboard!\nYou can now paste and share it with your patient.")
    } catch (err) {
      const textArea = document.createElement("textarea")
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand("copy")
        alert("✓ Link copied to clipboard!")
      } catch (e) {
        alert("Failed to copy. Please copy manually:\n" + text)
      }
      document.body.removeChild(textArea)
    }
  }

  const shareViaWhatsApp = (url) => {
    const message = `🏥 *MediStack 360 - Doctor Connection*\n\nHi! I'm inviting you to connect with me on MediStack 360.\n\n*Click the link below to connect instantly:*\n${url}\n\nThis link will expire in 24 hours and can only be used once.\n\nLooking forward to assisting you with your healthcare needs!`
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, "_blank")
  }

  const handleSearchPatients = async () => {
    if (!searchQuery.trim()) {
      alert("Please enter a search query")
      return
    }

    try {
      setSearching(true)
      const response = await api.doctor.searchPatients({ q: searchQuery })
      setSearchResults(response.patients || [])
    } catch (error) {
      console.error("Error searching patients:", error)
      alert(error.response?.data?.error || "Failed to search patients")
    } finally {
      setSearching(false)
    }
  }

  const handleConnectWithPatient = async (patientId) => {
    if (!confirm("Send connection request to this patient?")) return

    try {
      await api.doctor.connectWithPatient(patientId, "I would like to connect with you.")
      alert("Connection request sent successfully!")
      setShowSearchModal(false)
      setSearchQuery("")
      setSearchResults([])
      await loadDashboardData()
    } catch (error) {
      console.error("Error connecting with patient:", error)
      alert(error.response?.data?.error || "Failed to send connection request")
    }
  }

  const handleDeleteQRToken = async (token) => {
    if (!confirm("Delete this QR code? This action cannot be undone.")) return

    try {
      await api.doctor.deleteQRToken(token)
      alert("QR code deleted successfully")
      await loadQRTokens()
    } catch (error) {
      console.error("Error deleting QR token:", error)
      alert(error.response?.data?.error || "Failed to delete QR code")
    }
  }

  const handleViewQRCode = (token) => {
    const frontendUrl = window.location.origin
    const qrUrl = `${frontendUrl}/patient/scan-qr/${token.token}`

    setQRData({
      token: token.token,
      qr_url: qrUrl,
      expires_at: token.expires_at,
      max_uses: token.max_uses,
      qr_code_image: null,
      doctor_name: profile?.display_name || profile?.first_name,
      doctor_specialization: profile?.specialization,
    })
    setShowQRModal(true)
  }

  const downloadQRCode = () => {
    if (!qrData) return

    const link = document.createElement("a")
    link.download = `doctor-qr-${Date.now()}.png`
    link.href = qrData.qr_code_image
    link.click()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-cyan-500 mx-auto mb-4" />
          <p className="text-gray-600 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50 flex">
      <aside
        onMouseEnter={() => setHoveredSidebar(true)}
        onMouseLeave={() => setHoveredSidebar(false)}
        className={`hidden md:flex fixed inset-y-0 left-0 z-40 bg-white shadow-2xl transition-all duration-300 ${
          sidebarOpen ? "w-64" : "w-20"
        } flex-col border-r border-gray-100`}
      >
        <div className="flex items-center justify-between px-4 pt-6 pb-8">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            {sidebarOpen && (
              <div className="transition-opacity">
                <p className="text-xs text-gray-500 font-semibold">MediStack 360</p>
                <p className="text-sm font-bold text-gray-900 truncate">
                  Dr. {profile?.display_name || profile?.first_name}
                </p>
              </div>
            )}
          </div>
          {sidebarExpanded && (
            <button
              onClick={() => setSidebarExpanded(false)}
              className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors flex-shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 flex flex-col gap-1 px-2 mt-2">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === "overview"
                ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Activity className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span>Overview</span>}
          </button>

          <button
            onClick={() => setActiveTab("patients")}
            className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === "patients"
                ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Users className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span>My Patients</span>}
          </button>

          <button
            onClick={() => setActiveTab("requests")}
            className={`flex items-center justify-between px-3 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === "requests"
                ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <div className="flex items-center gap-3">
              <UserPlus className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span>Requests</span>}
            </div>
            {pendingRequests.length > 0 && (
              <span
                className={`flex items-center justify-center text-[10px] font-bold rounded-full flex-shrink-0 ${
                  sidebarOpen ? "w-6 h-6" : "w-5 h-5"
                } ${activeTab === "requests" ? "bg-white/30" : "bg-red-500 text-white"}`}
              >
                {pendingRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab("qr-codes")
              loadQRTokens()
            }}
            className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === "qr-codes"
                ? "bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <QrCode className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span>QR Codes</span>}
          </button>
        </nav>

        <div className="px-2 pb-6 space-y-2">
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-blue-200 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-blue-700" />
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <p className="text-xs text-gray-600 font-medium">Mode</p>
                <p className="text-sm font-bold text-gray-900 truncate">{profile?.consultation_mode || "Both"}</p>
              </div>
            )}
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex-1 min-h-screen transition-all duration-300 ${sidebarOpen ? "md:ml-64" : "md:ml-20"}`}>
        {/* Top header - sticky */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-4 sm:px-6 lg:px-8 py-4 md:py-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-xs sm:text-sm text-cyan-600 font-semibold mb-1">Welcome Back</p>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 flex items-center gap-2">
                Dr. {profile?.display_name || profile?.first_name}
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-cyan-500" />
                <span className="font-medium">{profile?.specialization || "Specialist"}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden sm:inline-flex px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-200">
                <CheckCircle className="w-3 h-3 mr-1.5" />
                Verified
              </span>
              <button className="w-10 h-10 rounded-xl bg-white shadow-md hover:shadow-lg flex items-center justify-center text-gray-600 transition-all">
                <Bell className="w-5 h-5" />
              </button>
              <button
                onClick={logout}
                className="hidden sm:inline-flex px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-lg shadow hover:bg-red-600 transition-all items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>

              <button
                onClick={() => setSidebarExpanded(!sidebarExpanded)}
                className="inline-flex md:hidden w-10 h-10 rounded-xl bg-white shadow-md items-center justify-center text-gray-700 hover:bg-gray-50 transition-all"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          {/* Stats cards grid */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all border border-gray-100 hover:border-cyan-200">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center">
                  <Users className="w-6 h-6 text-cyan-600" />
                </div>
                <span className="text-3xl font-bold text-gray-900">{connectedPatients.length}</span>
              </div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Connected Patients</p>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all border border-gray-100 hover:border-orange-200">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
                <span className="text-3xl font-bold text-gray-900">{pendingRequests.length}</span>
              </div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending Requests</p>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all border border-gray-100 hover:border-purple-200">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                  <QrCode className="w-6 h-6 text-purple-600" />
                </div>
                <span className="text-3xl font-bold text-gray-900">{qrTokens.filter((t) => t.is_valid).length}</span>
              </div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active QR Codes</p>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all border border-gray-100 hover:border-emerald-200">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-emerald-600" />
                </div>
                <span className="text-lg font-bold text-gray-900">{profile?.consultation_mode || "Both"}</span>
              </div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Consultation Mode</p>
            </div>
          </section>

          {activeTab === "overview" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Generate QR Card */}
                  <button
                    onClick={handleGenerateQR}
                    disabled={generatingQR}
                    className="group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-purple-500 to-indigo-600 text-white hover:shadow-2xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                  >
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
                    <div className="relative flex items-center gap-4">
                      <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                        {generatingQR ? <Loader2 className="w-7 h-7 animate-spin" /> : <QrCode className="w-7 h-7" />}
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-lg">Generate QR Code</p>
                        <p className="text-sm text-purple-100">Share for instant connections</p>
                      </div>
                    </div>
                  </button>

                  {/* Search Patient Card */}
                  <button
                    onClick={() => setShowSearchModal(true)}
                    className="group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-emerald-500 to-teal-600 text-white hover:shadow-2xl transition-all transform hover:scale-105"
                  >
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
                    <div className="relative flex items-center gap-4">
                      <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                        <User className="w-7 h-7" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-lg">Search Patient</p>
                        <p className="text-sm text-emerald-100">Find and connect</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Recent Activity Section */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
                  <button
                    onClick={() => setActiveTab("requests")}
                    className="text-cyan-600 hover:text-cyan-700 text-sm font-semibold flex items-center gap-1"
                  >
                    View All <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {pendingRequests.length > 0 ? (
                  <div className="space-y-3">
                    {pendingRequests.slice(0, 3).map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-cyan-200 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-cyan-700" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{request.patient_name}</p>
                            <p className="text-xs text-gray-500">Requested connection</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setActiveTab("requests")}
                          className="px-3 py-1 bg-cyan-500 text-white text-xs font-bold rounded-lg hover:bg-cyan-600 transition-colors"
                        >
                          Review
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">No pending requests</p>
                  </div>
                )}
              </div>

              {/* Intake Forms Activity Section */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-teal-600" />
                    Intake Forms
                  </h2>
                </div>

                {intakeForms.length > 0 ? (
                  <div className="space-y-3">
                    {intakeForms.slice(0, 5).map((form) => {
                      const statusConfig = {
                        draft: { color: 'bg-gray-100 text-gray-600', label: 'Draft' },
                        sent: { color: 'bg-yellow-100 text-yellow-700', label: 'Sent' },
                        in_progress: { color: 'bg-blue-100 text-blue-700', label: 'In Progress' },
                        submitted: { color: 'bg-green-100 text-green-700', label: 'Submitted' },
                        reviewed: { color: 'bg-purple-100 text-purple-700', label: 'Reviewed' },
                      };
                      const status = statusConfig[form.status] || statusConfig.draft;

                      return (
                        <div
                          key={form.id}
                          className={`flex items-center justify-between p-4 rounded-xl transition-colors ${
                            form.status === 'submitted' 
                              ? 'bg-green-50 border border-green-200 hover:bg-green-100' 
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              form.status === 'submitted' ? 'bg-green-200' : 'bg-teal-200'
                            }`}>
                              <FileText className={`w-5 h-5 ${
                                form.status === 'submitted' ? 'text-green-700' : 'text-teal-700'
                              }`} />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{form.title}</p>
                              <p className="text-xs text-gray-500">
                                Patient: {form.patient_name} • {' '}
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${status.color}`}>
                                  {status.label}
                                </span>
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => navigate(`/doctor/intake-form/${form.id}`)}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                              form.status === 'submitted'
                                ? 'bg-green-500 text-white hover:bg-green-600'
                                : 'bg-teal-500 text-white hover:bg-teal-600'
                            }`}
                          >
                            {form.status === 'submitted' ? 'Review' : 'View'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">No intake forms yet</p>
                    <p className="text-xs text-gray-400 mt-1">Create forms from patient workspaces</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "requests" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">Pending Connection Requests</h2>
              </div>

              <div className="p-6">
                {pendingRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <UserPlus className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">No pending requests</p>
                    <p className="text-gray-500 text-sm mt-1">New connection requests will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingRequests.map((request) => (
                      <div
                        key={request.id}
                        className="bg-gray-50 rounded-2xl p-6 border border-gray-200 hover:border-cyan-200 transition-all"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-cyan-200 rounded-full flex items-center justify-center flex-shrink-0">
                              <User className="w-7 h-7 text-cyan-700" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-gray-900">{request.patient_name}</h3>
                              <p className="text-sm text-gray-600">
                                {request.patient_gender} • {request.patient_age && `Age ${request.patient_age}`}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`px-3 py-1 text-xs font-bold rounded-full flex-shrink-0 ${
                              request.connection_type === "qr_code"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {request.connection_type === "qr_code" ? "QR Code" : "Manual"}
                          </span>
                        </div>

                        {request.patient_note && (
                          <div className="bg-white rounded-lg p-4 mb-4 border border-gray-100">
                            <p className="text-sm text-gray-700 italic">"{request.patient_note}"</p>
                          </div>
                        )}

                        {request.emergency_contact && (
                          <div className="mb-4 text-sm text-gray-600">
                            <p>
                              <strong>Emergency Contact:</strong> {request.emergency_contact}
                            </p>
                          </div>
                        )}

                        <div className="flex gap-3">
                          <button
                            onClick={() => handleAcceptRequest(request.id)}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:from-green-600 hover:to-emerald-700 transition-all transform hover:scale-105 flex items-center justify-center gap-2 shadow-md"
                          >
                            <CheckCircle className="w-5 h-5" />
                            Accept
                          </button>
                          <button
                            onClick={() => handleRejectRequest(request.id)}
                            className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-all flex items-center justify-center gap-2"
                          >
                            <XCircle className="w-5 h-5" />
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "patients" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">My Patients ({connectedPatients.length})</h2>
              </div>

              <div className="p-6">
                {connectedPatients.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">No connected patients yet</p>
                    <p className="text-gray-500 text-sm mt-1">
                      Start by searching for patients or generating a QR code
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {connectedPatients.map((patient) => (
                      <div
                        key={patient.connection_id}
                        className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border border-cyan-200 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-12 h-12 bg-cyan-300 rounded-full flex items-center justify-center flex-shrink-0">
                              <User className="w-6 h-6 text-cyan-700" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-bold text-gray-900 truncate">{patient.patient_name}</h3>
                              <p className="text-xs text-cyan-600 font-semibold">{patient.patient_id}</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm text-gray-700 mb-4">
                          {patient.patient_phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                              <span className="truncate">{patient.patient_phone}</span>
                            </div>
                          )}
                          {patient.patient_email && (
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                              <span className="truncate text-xs">{patient.patient_email}</span>
                            </div>
                          )}
                          {patient.blood_group && (
                            <div className="flex items-center gap-2">
                              <Activity className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                              <span>Blood: {patient.blood_group}</span>
                            </div>
                          )}
                        </div>

                        {(patient.allergies || patient.chronic_conditions) && (
                          <div className="pt-4 border-t border-cyan-200 space-y-1 text-xs">
                            {patient.allergies && (
                              <p className="text-red-600">
                                <strong>Allergies:</strong> {patient.allergies}
                              </p>
                            )}
                            {patient.chronic_conditions && (
                              <p className="text-orange-600">
                                <strong>Conditions:</strong> {patient.chronic_conditions}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="mt-4 pt-4 border-t border-cyan-200 flex items-center justify-between">
                          <p className="text-xs text-gray-500">
                            Connected {new Date(patient.connected_since).toLocaleDateString()}
                          </p>
                          <button
                            onClick={() => navigate(`/doctor/workspaces/${patient.connection_id}`)}
                            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                          >
                            <FileText className="w-4 h-4" />
                            View Workspace
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "qr-codes" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">My QR Codes</h2>
                <button
                  onClick={handleGenerateQR}
                  disabled={generatingQR}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg font-bold hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {generatingQR ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                  Generate New
                </button>
              </div>

              <div className="p-6">
                {qrTokens.length === 0 ? (
                  <div className="text-center py-12">
                    <QrCode className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium mb-4">No QR codes generated yet</p>
                    <button
                      onClick={handleGenerateQR}
                      className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg font-bold hover:shadow-lg transition-all"
                    >
                      Generate Your First QR Code
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {qrTokens.map((token) => (
                      <div
                        key={token.token}
                        className={`rounded-2xl p-6 border-2 transition-all ${
                          token.is_valid
                            ? "bg-gradient-to-br from-green-50 to-emerald-50 border-green-200"
                            : token.is_expired
                              ? "bg-gray-50 border-gray-200"
                              : "bg-red-50 border-red-200"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <span
                            className={`px-3 py-1 text-xs font-bold rounded-full ${
                              token.is_valid
                                ? "bg-green-200 text-green-800"
                                : token.is_expired
                                  ? "bg-gray-200 text-gray-800"
                                  : "bg-red-200 text-red-800"
                            }`}
                          >
                            {token.is_valid ? "Active" : token.is_expired ? "Expired" : "Used"}
                          </span>
                          {token.is_expired && (
                            <button
                              onClick={() => handleDeleteQRToken(token.token)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          )}
                        </div>

                        <div className="space-y-2 text-sm mb-4">
                          <div>
                            <p className="text-gray-600 text-xs font-medium">Created</p>
                            <p className="font-semibold text-gray-900">
                              {new Date(token.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 text-xs font-medium">Expires</p>
                            <p className="font-semibold text-gray-900">
                              {new Date(token.expires_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 text-xs font-medium">Usage</p>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                              <div
                                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full"
                                style={{ width: `${(token.use_count / token.max_uses) * 100}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              {token.use_count} / {token.max_uses}
                            </p>
                          </div>
                          {token.used_by && (
                            <div>
                              <p className="text-gray-600 text-xs font-medium">Used By</p>
                              <p className="font-semibold text-gray-900">{token.used_by}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {token.is_valid && (
                            <button
                              onClick={() => handleViewQRCode(token)}
                              className="flex-1 px-3 py-2 bg-cyan-500 text-white text-sm rounded-lg font-bold hover:bg-cyan-600 transition-colors flex items-center justify-center gap-1"
                            >
                              <QrCode className="w-4 h-4" />
                              View
                            </button>
                          )}
                          {!token.is_expired && (
                            <button
                              onClick={() => {
                                const url = `${window.location.origin}/patient/scan-qr/${token.token}`
                                copyToClipboard(url)
                              }}
                              className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg font-bold hover:bg-gray-300 transition-colors flex items-center justify-center gap-1"
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
            </div>
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRModal && qrData && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm"
          onClick={() => setShowQRModal(false)}
        >
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <XCircle className="w-5 h-5 text-gray-600" />
            </button>

            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Your Connection QR Code</h2>

            <div className="bg-gradient-to-br from-cyan-50 to-blue-50 p-6 rounded-xl border-4 border-cyan-200 mb-6">
              {qrData.qr_code_image ? (
                <img src={qrData.qr_code_image || "/placeholder.svg"} alt="QR Code" className="w-full h-auto" />
              ) : (
                <div className="text-center py-12">
                  <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 text-sm">Use the link below to share</p>
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4 mb-6 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-purple-600 flex-shrink-0" />
                <span className="text-gray-700">
                  <strong>Expires:</strong> {new Date(qrData.expires_at).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-purple-600 flex-shrink-0" />
                <span className="text-gray-700">
                  <strong>Max Uses:</strong> {qrData.max_uses}
                </span>
              </div>
              <div className="pt-2 border-t border-purple-200">
                <p className="text-xs text-gray-600 mb-2">
                  <strong>Connection Link:</strong>
                </p>
                <div className="bg-white rounded p-2 border border-purple-300">
                  <p className="text-xs text-gray-800 break-all font-mono">{qrData.qr_url}</p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <button
                onClick={() => shareViaWhatsApp(qrData.qr_url)}
                className="w-full px-4 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 shadow-md"
              >
                <Share2 className="w-5 h-5" />
                <span>Share via WhatsApp</span>
              </button>
              <p className="text-xs text-center text-gray-500 mt-2">⭐ Recommended - Send directly to your patient</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => copyToClipboard(qrData.qr_url)}
                className="px-4 py-3 bg-cyan-500 text-white rounded-xl font-bold hover:bg-cyan-600 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Copy className="w-4 h-4" />
                Copy Link
              </button>
              {qrData.qr_code_image && (
                <button
                  onClick={downloadQRCode}
                  className="px-4 py-3 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              )}
            </div>

            <button
              onClick={() => setShowQRModal(false)}
              className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Patient Search Modal */}
      {showSearchModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm"
          onClick={() => setShowSearchModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowSearchModal(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <XCircle className="w-5 h-5 text-gray-600" />
            </button>

            <h2 className="text-2xl font-bold text-gray-900 mb-6">Search Patients</h2>

            <div className="mb-6">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearchPatients()}
                  placeholder="Search by name or patient ID..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  onClick={handleSearchPatients}
                  disabled={searching}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : "Search"}
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Search for patients by name or patient ID to send connection requests
              </p>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-bold text-gray-900 mb-4">Search Results ({searchResults.length})</h3>
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:border-cyan-300 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-bold text-gray-900">{result.full_name}</h4>
                          {result.connection_status && (
                            <span
                              className={`px-2 py-1 text-xs font-bold rounded-full ${
                                result.connection_status === "accepted"
                                  ? "bg-green-100 text-green-700"
                                  : result.connection_status === "pending"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-red-100 text-red-700"
                              }`}
                            >
                              {result.connection_status === "accepted"
                                ? "✓ Connected"
                                : result.connection_status === "pending"
                                  ? "Pending"
                                  : "Rejected"}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>
                            <strong>Patient ID:</strong> {result.patient_id}
                          </p>
                          {result.age && (
                            <p>
                              <strong>Age:</strong> {new Date().getFullYear() - result.age} years
                            </p>
                          )}
                          {result.gender && (
                            <p>
                              <strong>Gender:</strong> {result.gender}
                            </p>
                          )}
                          {result.blood_group && (
                            <p>
                              <strong>Blood Group:</strong> {result.blood_group}
                            </p>
                          )}
                          {result.city && (
                            <p>
                              <strong>City:</strong> {result.city}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="ml-4">
                        {!result.connection_status ? (
                          <button
                            onClick={() => handleConnectWithPatient(result.id)}
                            className="px-4 py-2 bg-cyan-500 text-white rounded-lg font-bold hover:bg-cyan-600 transition-all text-sm"
                          >
                            Connect
                          </button>
                        ) : (
                          <span
                            className={`px-4 py-2 rounded-lg text-sm font-bold ${
                              result.connection_status === "accepted"
                                ? "bg-green-50 text-green-700 border border-green-200"
                                : result.connection_status === "pending"
                                  ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
                                  : "bg-gray-50 text-gray-600 border border-gray-200"
                            }`}
                          >
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
              <div className="text-center py-8 text-gray-500">No results found. Try a different search term.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default DoctorDashboard
