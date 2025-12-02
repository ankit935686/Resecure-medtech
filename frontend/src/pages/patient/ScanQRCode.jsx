import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, AlertCircle, User, Building2, MapPin, Stethoscope, Loader2 } from 'lucide-react';
import api from '../../services/api';

function ScanQRCode() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [validationData, setValidationData] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      setValidating(true);
      setError(null);
      const response = await api.patient.validateQRToken(token);
      setValidationData(response);
    } catch (err) {
      console.error('Token validation error:', err);
      if (err.response?.data) {
        setError(err.response.data.error || 'Invalid or expired QR code');
      } else {
        setError('Failed to validate QR code. Please try again.');
      }
    } finally {
      setValidating(false);
      setLoading(false);
    }
  };

  const handleScan = async () => {
    try {
      setScanning(true);
      setError(null);
      const response = await api.patient.scanQRCode(token);
      setSuccess(true);
      
      // Show success message
      setTimeout(() => {
        navigate('/patient/dashboard', {
          state: {
            message: `Successfully connected with ${response.doctor.name}!`,
            doctorInfo: response.doctor
          }
        });
      }, 2000);
    } catch (err) {
      console.error('QR scan error:', err);
      if (err.response?.data) {
        if (err.response.data.redirect_to === 'profile_setup') {
          setError('Please complete your profile before connecting with doctors');
          setTimeout(() => {
            navigate('/patient/profile-setup');
          }, 2000);
        } else {
          setError(err.response.data.error || 'Failed to connect with doctor');
        }
      } else {
        setError('Failed to scan QR code. Please try again.');
      }
    } finally {
      setScanning(false);
    }
  };

  if (loading || validating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <Loader2 className="w-16 h-16 text-emerald-500 animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Validating QR Code</h2>
          <p className="text-gray-600">Please wait while we verify the connection...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-emerald-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-3">Connected!</h2>
          <p className="text-gray-600 mb-6">
            You have successfully connected with the doctor.
          </p>
          <div className="animate-pulse text-emerald-600 font-medium">
            Redirecting to dashboard...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-12 h-12 text-red-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-3">Invalid QR Code</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/patient/dashboard')}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-6 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Valid token - show doctor info and connect button
  const { doctor, expires_at, time_remaining } = validationData;
  const hoursRemaining = Math.floor(time_remaining);
  const minutesRemaining = Math.floor((time_remaining - hoursRemaining) * 60);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">QR Code Verified</h1>
          <p className="text-gray-600">Connect with your doctor instantly</p>
        </div>

        {/* Doctor Info Card */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 mb-6 border border-emerald-200">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-16 h-16 bg-emerald-200 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-8 h-8 text-emerald-700" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-800 mb-1">{doctor.name}</h2>
              <div className="flex items-center gap-2 text-emerald-700 font-medium">
                <Stethoscope className="w-4 h-4" />
                <span>{doctor.specialization}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {doctor.clinic && (
              <div className="flex items-center gap-3 text-gray-700">
                <Building2 className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <span>{doctor.clinic}</span>
              </div>
            )}
            {doctor.city && (
              <div className="flex items-center gap-3 text-gray-700">
                <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <span>{doctor.city}</span>
              </div>
            )}
            {doctor.consultation_mode && (
              <div className="flex items-center gap-3 text-gray-700">
                <Stethoscope className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <span className="capitalize">{doctor.consultation_mode.replace('_', ' ')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Expiry Info */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800 mb-1">QR Code Expires In</p>
              <p className="text-xs text-yellow-700">
                {hoursRemaining > 0 && `${hoursRemaining}h `}
                {minutesRemaining}m remaining
              </p>
            </div>
          </div>
        </div>

        {/* Info Alert */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Instant Connection</p>
              <p className="text-xs text-blue-700">
                By scanning this QR code, you will be instantly connected with this doctor. 
                They will have access to your medical profile and contact information.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/patient/dashboard')}
            disabled={scanning}
            className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex-1 px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg font-bold hover:from-emerald-600 hover:to-teal-600 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {scanning ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Connect Now
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScanQRCode;
