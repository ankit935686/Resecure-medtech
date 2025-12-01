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

export default function Dashboard() {
  const { user, userRole, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate(`/${userRole}/login`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              {userRole === 'admin' ? 'Admin Dashboard' : 'Doctor Dashboard'}
            </h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Welcome, {user?.username}!</h2>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Email:</p>
              <p className="text-lg">{user?.email}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Role:</p>
              <p className="text-lg capitalize">{userRole}</p>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="mt-8 space-x-4">
            <button
              onClick={() => navigate(`/${userRole}/profile`)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              View Profile
            </button>
            {userRole === 'admin' && (
              <button
                onClick={() => navigate('/admin/doctors')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Review Doctor Requests
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

