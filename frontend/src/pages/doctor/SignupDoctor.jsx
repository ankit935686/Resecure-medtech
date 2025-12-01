/**
 * Doctor Signup Page
 * 
 * HOW IT CONNECTS TO DJANGO:
 * =========================
 * 1. User fills form
 * 2. We call useAuth().signup('doctor', formData)
 * 3. AuthContext calls api.doctor.signup()
 * 4. Axios sends POST request to Django: http://127.0.0.1:8000/api/doctor/signup/
 * 5. Django creates user + profile, returns token + user data
 * 6. We store token and redirect
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import GoogleSignInButton from '../../components/GoogleSignInButton';

export default function SignupDoctor() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { signup, googleAuth } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.password_confirm) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const result = await signup('doctor', formData);

      if (result.success) {
        // Small delay to ensure session cookie is set
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Handle redirect based on profile status - use window.location for full reload
        if (result.redirect_to === 'profile') {
          window.location.href = '/doctor/profile-setup';
        } else if (result.redirect_to === 'verification_pending') {
          window.location.href = '/doctor/verification-pending';
        } else {
          window.location.href = '/doctor/dashboard';
        }
      } else {
        setError(result.error || 'Signup failed');
        setLoading(false);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credential) => {
    setError('');
    setLoading(true);

    try {
      const result = await googleAuth('doctor', credential);

      if (result.success) {
        // Small delay to ensure session cookie is set
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Handle redirect based on profile status
        if (result.redirect_to === 'profile') {
          window.location.href = '/doctor/profile-setup'; // Force full page reload
        } else if (result.redirect_to === 'verification_pending') {
          window.location.href = '/doctor/verification-pending'; // Force full page reload
        } else {
          window.location.href = '/doctor/dashboard'; // Force full page reload
        }
      } else {
        setError(result.error || 'Google authentication failed');
        setLoading(false);
      }
    } catch (err) {
      setError('An unexpected error occurred during Google sign-in');
      setLoading(false);
    }
  };

  const handleGoogleError = (error) => {
    setError(error || 'Google sign-in failed');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            Doctor Registration
          </h2>
          <p className="text-sm text-gray-600">Create your doctor account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Choose a username"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="your.email@example.com"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={8}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="At least 8 characters"
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              name="password_confirm"
              value={formData.password_confirm}
              onChange={handleChange}
              required
              minLength={8}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Re-enter your password"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {typeof error === 'object' ? JSON.stringify(error) : error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating account...' : 'Sign Up as Doctor'}
          </button>
        </form>

        {/* Divider */}
        <div className="mt-6 mb-6 flex items-center">
          <div className="grow border-t border-gray-300"></div>
          <span className="px-4 text-sm text-gray-500">OR</span>
          <div className="grow border-t border-gray-300"></div>
        </div>

        {/* Google Sign In */}
        <GoogleSignInButton
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          text="signup_with"
        />

        {/* Links */}
        <div className="mt-6 space-y-2 text-center text-sm">
          <p className="text-gray-600">
            Already have an account?{' '}
            <Link to="/doctor/login" className="text-indigo-600 hover:text-indigo-800 font-medium">
              Login as Doctor
            </Link>
          </p>
          <p className="text-gray-500">
            Are you an <Link to="/admin/signup" className="text-indigo-600 hover:text-indigo-800">Admin</Link> or{' '}
            <Link to="/patient/signup" className="text-indigo-600 hover:text-indigo-800">Patient</Link>?
          </p>
        </div>
      </div>
    </div>
  );
}

