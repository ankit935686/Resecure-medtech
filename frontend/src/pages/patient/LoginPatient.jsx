/**
 * Patient Login Page
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import GoogleSignInButton from '../../components/GoogleSignInButton';

export default function LoginPatient() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, googleAuth } = useAuth();
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
    setLoading(true);

    try {
      const result = await login('patient', formData.username, formData.password);

      if (result.success) {
        // Check if profile is complete
        navigate('/patient/dashboard');
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credential) => {
    setError('');
    setLoading(true);

    try {
      const result = await googleAuth('patient', credential);

      if (result.success) {
        navigate('/patient/dashboard');
      } else {
        setError(result.error || 'Google authentication failed');
      }
    } catch (err) {
      setError('An unexpected error occurred during Google sign-in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = (error) => {
    setError(error || 'Google sign-in failed');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-teal-100">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            Patient Login
          </h2>
          <p className="text-sm text-gray-600">MediStack 360</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="Enter your username"
            />
          </div>

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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {typeof error === 'object' ? JSON.stringify(error) : error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Logging in...' : 'Login as Patient'}
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
          text="signin_with"
        />

        <div className="mt-6 space-y-2 text-center text-sm">
          <p className="text-gray-600">
            Don't have an account?{' '}
            <Link to="/patient/signup" className="text-green-600 hover:text-green-800 font-medium">
              Sign up as Patient
            </Link>
          </p>
          <p className="text-gray-500">
            Are you a <Link to="/doctor/login" className="text-green-600 hover:text-green-800">Doctor</Link> or{' '}
            <Link to="/admin/login" className="text-green-600 hover:text-green-800">Admin</Link>?
          </p>
        </div>
      </div>
    </div>
  );
}

