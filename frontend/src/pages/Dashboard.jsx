/**
 * Dashboard Page - Shows after login for Admin and Doctor
 * 
 * HOW IT WORKS:
 * ============
 * - Protected route (requires authentication)
 * - Shows user info from AuthContext
 * - Can fetch additional data from Django API if needed
 */

import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  User,
  Mail,
  Shield,
  FileCheck,
  Settings,
  Bell,
  ChevronRight,
  Lock,
  Activity,
} from 'lucide-react';
import { useState } from 'react';

export default function Dashboard() {
  const { user, userRole, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate(`/${userRole}/login`);
    } catch (error) {
      console.error('Logout error:', error);
      setLoggingOut(false);
    }
  };

  const isAdmin = userRole === 'admin';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-blue-50">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-20 bg-white shadow-xl flex flex-col items-center py-6 z-40">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center mb-8 shadow-lg">
          {isAdmin ? (
            <Shield className="w-6 h-6 text-white" />
          ) : (
            <Activity className="w-6 h-6 text-white" />
          )}
        </div>

        <nav className="flex-1 flex flex-col space-y-4">
          <button
            onClick={() => navigate(`/${userRole}/profile`)}
            className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center hover:bg-purple-100 transition-all shadow-sm"
          >
            <User className="w-6 h-6" />
          </button>
          <button
            onClick={() => navigate(`/${userRole}/dashboard`)}
            className="w-12 h-12 rounded-2xl text-gray-400 flex items-center justify-center hover:bg-gray-50 transition-all"
          >
            <Settings className="w-6 h-6" />
          </button> 
          {isAdmin && (
            <button
              onClick={() => navigate('/admin/doctors')}
              className="w-12 h-12 rounded-2xl text-gray-400 flex items-center justify-center hover:bg-gray-50 transition-all"
            >
              <FileCheck className="w-6 h-6" />
            </button>
          )}
        </nav>

        <div className="space-y-2">
          <button className="w-12 h-12 rounded-2xl text-gray-400 flex items-center justify-center hover:bg-gray-50 transition-all">
            <Bell className="w-6 h-6" />
          </button>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-12 h-12 rounded-2xl text-gray-400 flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-all disabled:opacity-50"
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
            <p className="text-purple-600 text-sm mb-1 font-medium">Welcome back,</p>
            <h1 className="text-4xl font-bold text-gray-900">
              {isAdmin ? 'Admin Portal' : 'Doctor Dashboard'}
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <button className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:shadow-xl transition-all">
              <Bell className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => navigate(`/${userRole}/profile`)}
              className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 shadow-lg flex items-center justify-center hover:shadow-xl transition-all"
            >
              <User className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero Card */}
            <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 rounded-3xl shadow-2xl p-8 text-white relative overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                <div className="w-64 h-64 bg-white rounded-full blur-3xl -top-10 -right-10 absolute" />
                <div className="w-48 h-48 bg-white rounded-full blur-3xl bottom-0 left-0 absolute" />
              </div>

              <div className="relative z-10">
                <p className="text-purple-100 mb-2 font-medium">Hello, {user?.first_name || user?.username}!</p>
                <h2 className="text-3xl font-bold mb-6 leading-tight">
                  {isAdmin
                    ? 'Manage & Verify Medical Professionals'
                    : 'Manage Your Medical Practice'}
                </h2>
                <p className="text-purple-100 mb-6 max-w-xl">
                  {isAdmin
                    ? 'Review doctor profiles, verify credentials, and maintain the integrity of our medical network.'
                    : 'Access your profile, manage patient connections, and view care spaces.'}
                </p>

                <div className="flex flex-wrap gap-3">
                  {isAdmin ? (
                    <>
                      <button
                        onClick={() => navigate('/admin/doctors')}
                        className="bg-white text-purple-600 px-6 py-3 rounded-xl font-semibold hover:shadow-xl transition-all flex items-center gap-2"
                      >
                        <FileCheck className="w-5 h-5" />
                        Review Submissions
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/${userRole}/profile`)}
                        className="bg-white/20 backdrop-blur-sm text-white px-6 py-3 rounded-xl font-semibold hover:bg-white/30 transition-all flex items-center gap-2"
                      >
                        <Settings className="w-5 h-5" />
                        Settings
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => navigate(`/${userRole}/profile`)}
                        className="bg-white text-purple-600 px-6 py-3 rounded-xl font-semibold hover:shadow-xl transition-all flex items-center gap-2"
                      >
                        <User className="w-5 h-5" />
                        View Profile
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/${userRole}/dashboard`)}
                        className="bg-white/20 backdrop-blur-sm text-white px-6 py-3 rounded-xl font-semibold hover:bg-white/30 transition-all flex items-center gap-2"
                      >
                        <Activity className="w-5 h-5" />
                        Dashboard
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Info Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* User Info Card */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Account</p>
                    <h3 className="text-lg font-bold text-gray-900">User Profile</h3>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Username</span>
                    <span className="font-semibold text-gray-900">{user?.username}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">First Name</span>
                    <span className="font-semibold text-gray-900">{user?.first_name || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Last Name</span>
                    <span className="font-semibold text-gray-900">{user?.last_name || '—'}</span>
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/${userRole}/profile`)}
                  className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Edit Profile
                </button>
              </div>

              {/* Contact Info Card */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                    <Mail className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Contact</p>
                    <h3 className="text-lg font-bold text-gray-900">Email Address</h3>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-100">
                    <p className="text-xs text-gray-500 mb-1">Primary Email</p>
                    <p className="text-gray-900 font-semibold break-all">{user?.email}</p>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full mt-4 px-4 py-3 bg-red-50 text-red-600 rounded-xl font-semibold hover:bg-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4" />
                  {loggingOut ? 'Logging out...' : 'Logout'}
                </button>
              </div>
            </div>

            {/* Role & Security Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Permissions</p>
                  <h3 className="text-lg font-bold text-gray-900">Account Role & Access</h3>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-5 h-5 text-indigo-600" />
                    <p className="text-sm font-semibold text-gray-900">Role</p>
                  </div>
                  <p className="text-2xl font-bold text-indigo-600 capitalize">{userRole}</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-5 h-5 text-emerald-600" />
                    <p className="text-sm font-semibold text-gray-900">Status</p>
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">Active</p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-semibold">Available Permissions:</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {isAdmin ? (
                    <>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        Doctor Verification
                      </span>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        Profile Management
                      </span>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        System Access
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        Patient Connections
                      </span>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        Profile Management
                      </span>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        Patient Workspace
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                {isAdmin ? (
                  <>
                    <button
                      onClick={() => navigate('/admin/doctors')}
                      className="w-full p-4 bg-gradient-to-br from-blue-50 to-indigo-50 hover:shadow-md transition-all rounded-xl border border-blue-100 text-left group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                            Doctor Management
                          </p>
                          <p className="text-sm text-gray-700 font-medium mt-1">Review Submissions</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                      </div>
                    </button>
                    <button
                      onClick={() => navigate(`/${userRole}/profile`)}
                      className="w-full p-4 bg-gradient-to-br from-purple-50 to-pink-50 hover:shadow-md transition-all rounded-xl border border-purple-100 text-left group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                            Account
                          </p>
                          <p className="text-sm text-gray-700 font-medium mt-1">Edit Profile</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
                      </div>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => navigate(`/${userRole}/profile`)}
                      className="w-full p-4 bg-gradient-to-br from-cyan-50 to-blue-50 hover:shadow-md transition-all rounded-xl border border-cyan-100 text-left group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                            Profile
                          </p>
                          <p className="text-sm text-gray-700 font-medium mt-1">View & Edit</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-cyan-600 transition-colors" />
                      </div>
                    </button>
                    <button
                      onClick={() => navigate(`/${userRole}/dashboard`)}
                      className="w-full p-4 bg-gradient-to-br from-emerald-50 to-teal-50 hover:shadow-md transition-all rounded-xl border border-emerald-100 text-left group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                            Patients
                          </p>
                          <p className="text-sm text-gray-700 font-medium mt-1">My Connections</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                      </div>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Account Info Card */}
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-lg p-6 text-white">
              <h3 className="text-sm font-semibold text-purple-100 mb-4 uppercase tracking-wide">
                Account Status
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-purple-100">Member Since</span>
                  <span className="font-semibold">Today</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-purple-100">Status</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="font-semibold">Active</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full mt-6 px-4 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 backdrop-blur-sm"
              >
                <LogOut className="w-4 h-4" />
                {loggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

