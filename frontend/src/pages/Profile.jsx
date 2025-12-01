/**
 * Profile Page - Shows user profile and allows editing
 * 
 * HOW IT CONNECTS TO DJANGO:
 * =========================
 * 1. On load, we call api.doctor/getProfile() (or admin/patient)
 * 2. Django returns profile data
 * 3. User can update profile
 * 4. We call api.doctor/updateProfile() with new data
 * 5. Django updates and returns updated profile
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function Profile() {
  const { user, userRole, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Fetch profile on component mount
  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      let profileData;
      switch (userRole) {
        case 'doctor':
          profileData = await api.doctor.getProfile();
          break;
        case 'admin':
          profileData = await api.admin.getProfile();
          break;
        case 'patient':
          profileData = await api.patient.getProfile();
          break;
      }
      setProfile(profileData);
      setFormData(profileData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');

    try {
      // Remove read-only fields before sending
      const { id, username, email, created_at, updated_at, profile_completed, ...updateData } = formData;
      
      let result;
      switch (userRole) {
        case 'doctor':
          result = await api.doctor.updateProfile(updateData);
          break;
        case 'admin':
          result = await api.admin.updateProfile(updateData);
          break;
        case 'patient':
          result = await api.patient.updateProfile(updateData);
          break;
      }

      setProfile(result.profile);
      setFormData(result.profile);
      setEditing(false);
      setMessage('Profile updated successfully!');
    } catch (error) {
      setMessage('Error updating profile. Please try again.');
      console.error('Error updating profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
            <div className="space-x-4">
              {userRole !== 'patient' && (
                <button
                  onClick={() => navigate(`/${userRole}/dashboard`)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Dashboard
                </button>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">Profile Information</h2>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Edit Profile
              </button>
            )}
          </div>

          {message && (
            <div className={`mb-4 p-4 rounded-lg ${
              message.includes('Error') 
                ? 'bg-red-50 text-red-700 border border-red-200' 
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {message}
            </div>
          )}

          <div className="space-y-4">
            {/* Username and Email (Read-only) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={profile?.username || ''}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                />
              </div>
            </div>

            {/* Editable Fields */}
            {userRole === 'doctor' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      name="first_name"
                      value={formData.first_name || ''}
                      onChange={handleChange}
                      disabled={!editing}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      name="last_name"
                      value={formData.last_name || ''}
                      onChange={handleChange}
                      disabled={!editing}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Specialization
                  </label>
                  <input
                    type="text"
                    name="specialization"
                    value={formData.specialization || ''}
                    onChange={handleChange}
                    disabled={!editing}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    License Number
                  </label>
                  <input
                    type="text"
                    name="license_number"
                    value={formData.license_number || ''}
                    onChange={handleChange}
                    disabled={!editing}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                  />
                </div>
              </>
            )}

            {userRole === 'admin' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      name="first_name"
                      value={formData.first_name || ''}
                      onChange={handleChange}
                      disabled={!editing}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      name="last_name"
                      value={formData.last_name || ''}
                      onChange={handleChange}
                      disabled={!editing}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department || ''}
                    onChange={handleChange}
                    disabled={!editing}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                  />
                </div>
              </>
            )}

            {userRole === 'patient' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      name="first_name"
                      value={formData.first_name || ''}
                      onChange={handleChange}
                      disabled={!editing}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      name="last_name"
                      value={formData.last_name || ''}
                      onChange={handleChange}
                      disabled={!editing}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    name="phone_number"
                    value={formData.phone_number || ''}
                    onChange={handleChange}
                    disabled={!editing}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Blood Group
                  </label>
                  <input
                    type="text"
                    name="blood_group"
                    value={formData.blood_group || ''}
                    onChange={handleChange}
                    disabled={!editing}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                  />
                </div>
              </>
            )}

            {/* Action Buttons */}
            {editing && (
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setFormData(profile);
                    setMessage('');
                  }}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

