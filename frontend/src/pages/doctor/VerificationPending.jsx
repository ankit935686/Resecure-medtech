/**
 * Verification Pending Page
 * Displays while doctor profile is under admin review
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle, XCircle, RefreshCw, Home, AlertCircle } from 'lucide-react';
import api from '../../services/api';

export default function VerificationPending() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('pending');
  const [submittedAt, setSubmittedAt] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    checkStatus();
    // Poll status every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    try {
      setChecking(true);
      const data = await api.doctor.getVerificationStatus();
      
      setStatus(data.profile_status);
      setSubmittedAt(data.submitted_at);
      setRejectionReason(data.rejection_reason || '');

      // Redirect if verified
      if (data.profile_status === 'verified') {
        setTimeout(() => {
          navigate('/doctor/dashboard');
        }, 2000);
      }
    } catch (err) {
      console.error('Error checking status:', err);
    } finally {
      setLoading(false);
      setChecking(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading verification status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Pending Status */}
        {status === 'pending' && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mb-6">
              <Clock className="w-20 h-20 text-yellow-500 mx-auto mb-4 animate-pulse" />
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Verification In Progress</h1>
              <p className="text-gray-600">Your profile is being reviewed by our admin team</p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">Status:</span>
                  <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">
                    Pending Review
                  </span>
                </div>
                
                {submittedAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">Submitted:</span>
                    <span className="text-gray-600">{formatDate(submittedAt)}</span>
                  </div>
                )}

                <div className="border-t border-yellow-200 pt-3 mt-3">
                  <p className="text-sm text-gray-600">
                    ⏱️ Average verification time: <strong>2-24 hours</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">What happens next?</h3>
              <ul className="text-left space-y-2 text-gray-700">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Our admin team will verify your credentials</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span>You'll receive an email notification once verified</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span>You can start serving patients immediately after approval</span>
                </li>
              </ul>
            </div>

            <div className="flex gap-4">
              <button
                onClick={checkStatus}
                disabled={checking}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all flex items-center justify-center"
              >
                <RefreshCw className={`w-5 h-5 mr-2 ${checking ? 'animate-spin' : ''}`} />
                {checking ? 'Checking...' : 'Check Status'}
              </button>
              
              <button
                onClick={() => navigate('/doctor/profile')}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all flex items-center justify-center"
              >
                <Home className="w-5 h-5 mr-2" />
                Go to Profile
              </button>
            </div>
          </div>
        )}

        {/* Verified Status */}
        {status === 'verified' && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile Verified! 🎉</h1>
            <p className="text-gray-600 mb-6">Congratulations! Your profile has been approved</p>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
              <p className="text-green-800">
                You now have full access to the platform. Start serving your patients!
              </p>
            </div>

            <button
              onClick={() => navigate('/doctor/dashboard')}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {/* Rejected Status */}
        {status === 'rejected' && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile Rejected</h1>
            <p className="text-gray-600 mb-6">Your profile could not be verified</p>

            {rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6 text-left">
                <div className="flex items-start mb-2">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                  <h3 className="font-semibold text-red-900">Reason for Rejection:</h3>
                </div>
                <p className="text-red-800 ml-7">{rejectionReason}</p>
              </div>
            )}

            <div className="bg-blue-50 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">What you can do:</h3>
              <ul className="text-left space-y-2 text-gray-700">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Review the rejection reason above</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Update your profile with correct information</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Resubmit your profile for verification</span>
                </li>
              </ul>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => navigate('/doctor/profile-setup')}
                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all"
              >
                Update Profile
              </button>
              
              <button
                onClick={() => navigate('/doctor/profile')}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all"
              >
                View Profile
              </button>
            </div>
          </div>
        )}

        {/* Draft Status - Shouldn't normally see this but handle it */}
        {status === 'draft' && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <AlertCircle className="w-20 h-20 text-orange-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile Incomplete</h1>
            <p className="text-gray-600 mb-6">Please complete your profile setup first</p>

            <button
              onClick={() => navigate('/doctor/profile-setup')}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all"
            >
              Complete Profile Setup
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
