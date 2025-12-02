/**
 * Patient Profile Setup - 3-Step Wizard
 * Mobile-first, fast, and friendly profile completion
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  User,
  Phone,
  Calendar,
  AlertCircle,
  Upload,
  Clock,
  Shield,
  ChevronRight,
} from 'lucide-react';
import api from '../../services/api';

export default function PatientProfileSetup() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form Data
  const [consentGiven, setConsentGiven] = useState(false);
  const [step1Data, setStep1Data] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    phone_number: '',
  });
  const [step2Data, setStep2Data] = useState({
    emergency_contact_name: '',
    emergency_contact_phone: '',
    known_allergies: '',
    chronic_conditions: '',
    current_medications: '',
    prescription_upload: null,
  });
  const [step3Data, setStep3Data] = useState({
    preferred_language: 'en',
    preferred_contact_method: 'email',
    share_data_for_research: false,
    note_for_doctors: '',
  });

  // Load current profile status
  useEffect(() => {
    loadProfileStatus();
  }, []);

  const loadProfileStatus = async () => {
    try {
      const response = await api.patient.getProfileSetupStatus();
      const profile = response.profile;
      
      // Pre-fill form data if available
      if (profile) {
        setCurrentStep(profile.current_step || 0);
        setConsentGiven(profile.consent_given || false);
        
        setStep1Data({
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          date_of_birth: profile.date_of_birth || '',
          gender: profile.gender || '',
          phone_number: profile.phone_number || '',
        });
        
        setStep2Data({
          emergency_contact_name: profile.emergency_contact_name || '',
          emergency_contact_phone: profile.emergency_contact_phone || '',
          known_allergies: profile.known_allergies || '',
          chronic_conditions: profile.chronic_conditions || '',
          current_medications: profile.current_medications || '',
          prescription_upload: null,
        });
        
        setStep3Data({
          preferred_language: profile.preferred_language || 'en',
          preferred_contact_method: profile.preferred_contact_method || 'email',
          share_data_for_research: profile.share_data_for_research || false,
          note_for_doctors: profile.note_for_doctors || '',
        });
      }
    } catch (err) {
      console.error('Error loading profile status:', err);
    }
  };

  const handleConsentSubmit = async () => {
    if (!consentGiven) {
      setError('You must give consent to proceed');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.patient.submitConsent({ consent_given: true });
      setSuccess('Consent recorded successfully!');
      setTimeout(() => {
        setCurrentStep(1);
        setSuccess('');
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit consent');
    } finally {
      setLoading(false);
    }
  };

  const handleStep1Submit = async () => {
    setLoading(true);
    setError('');

    try {
      await api.patient.submitStep1(step1Data);
      setSuccess('Basic information saved!');
      setTimeout(() => {
        setCurrentStep(2);
        setSuccess('');
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save basic information');
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Submit = async () => {
    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('emergency_contact_name', step2Data.emergency_contact_name);
      formData.append('emergency_contact_phone', step2Data.emergency_contact_phone);
      formData.append('known_allergies', step2Data.known_allergies);
      formData.append('chronic_conditions', step2Data.chronic_conditions);
      formData.append('current_medications', step2Data.current_medications);
      
      if (step2Data.prescription_upload) {
        formData.append('prescription_upload', step2Data.prescription_upload);
      }

      await api.patient.submitStep2(formData);
      setSuccess('Health information saved!');
      setTimeout(() => {
        setCurrentStep(3);
        setSuccess('');
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save health information');
    } finally {
      setLoading(false);
    }
  };

  const handleStep3Submit = async () => {
    setLoading(true);
    setError('');

    try {
      await api.patient.submitStep3(step3Data);
      setSuccess('Preferences saved!');
      
      // Finish profile setup
      setTimeout(async () => {
        try {
          const response = await api.patient.finishProfileSetup();
          setSuccess('Profile completed successfully!');
          setTimeout(() => {
            navigate('/patient/dashboard');
          }, 1500);
        } catch (err) {
          console.error('Error finishing setup:', err);
          // Even if finish fails, profile is mostly complete
          navigate('/patient/dashboard');
        }
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      setStep2Data({ ...step2Data, prescription_upload: file });
      setError('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-cyan-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-2 bg-white px-6 py-3 rounded-full shadow-lg mb-4">
            <Heart className="w-6 h-6 text-green-600" />
            <span className="font-bold text-xl text-gray-800">MediStack 360</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Complete Your Patient Profile</h1>
          <p className="text-gray-600">This helps doctors understand your history faster. Takes under 2 minutes.</p>
        </div>

        {/* Progress Bar */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            {[0, 1, 2, 3].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div className="flex items-center justify-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                      currentStep >= step
                        ? 'bg-gradient-to-r from-green-500 to-teal-500 text-white shadow-lg'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {currentStep > step ? <CheckCircle className="w-6 h-6" /> : step}
                  </div>
                </div>
                {step < 3 && (
                  <div
                    className={`flex-1 h-1 mx-2 rounded-full transition-all ${
                      currentStep > step ? 'bg-gradient-to-r from-green-500 to-teal-500' : 'bg-gray-200'
                    }`}
                  ></div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>Consent</span>
            <span>Basic Info</span>
            <span>Health</span>
            <span>Preferences</span>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-700 px-6 py-4 rounded-xl mb-6 flex items-center space-x-3">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border-2 border-green-200 text-green-700 px-6 py-4 rounded-xl mb-6 flex items-center space-x-3">
            <CheckCircle className="w-6 h-6 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Step 0: Consent */}
        {currentStep === 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center space-x-3 mb-6">
              <Shield className="w-8 h-8 text-green-600" />
              <h2 className="text-2xl font-bold text-gray-900">Welcome & Consent</h2>
            </div>

            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
              <h3 className="font-bold text-blue-900 mb-3 flex items-center">
                <AlertCircle className="w-5 h-5 mr-2" />
                Privacy & Data Security
              </h3>
              <p className="text-blue-800 text-sm leading-relaxed mb-4">
                Your health information is protected and will only be shared with your linked clinicians for your care.
                We comply with all healthcare privacy regulations.
              </p>
              <ul className="space-y-2 text-blue-800 text-sm">
                <li className="flex items-start">
                  <CheckCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Your data is encrypted and stored securely</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Only doctors you connect with can access your information</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  <span>You can withdraw consent at any time</span>
                </li>
              </ul>
            </div>

            <label className="flex items-start space-x-3 p-6 bg-gray-50 rounded-xl border-2 border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="w-5 h-5 text-green-600 rounded mt-1"
              />
              <span className="text-gray-700 leading-relaxed">
                <strong>I consent</strong> to store and share my health information with my linked clinicians for care
                purposes.
              </span>
            </label>

            <button
              onClick={handleConsentSubmit}
              disabled={!consentGiven || loading}
              className="w-full mt-6 bg-gradient-to-r from-green-600 to-teal-600 text-white py-4 rounded-xl hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center space-x-2"
            >
              <span>{loading ? 'Processing...' : 'Start Setup'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Step 1: Basic Identity & Contact */}
        {currentStep === 1 && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center space-x-3 mb-6">
              <User className="w-8 h-8 text-green-600" />
              <h2 className="text-2xl font-bold text-gray-900">Basic Identity & Contact</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={step1Data.first_name}
                    onChange={(e) => setStep1Data({ ...step1Data, first_name: e.target.value })}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder="John"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={step1Data.last_name}
                    onChange={(e) => setStep1Data({ ...step1Data, last_name: e.target.value })}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                  <input
                    type="date"
                    value={step1Data.date_of_birth}
                    onChange={(e) => setStep1Data({ ...step1Data, date_of_birth: e.target.value })}
                    required
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gender (Optional)</label>
                <select
                  value={step1Data.gender}
                  onChange={(e) => setStep1Data({ ...step1Data, gender: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    value={step1Data.phone_number}
                    onChange={(e) => setStep1Data({ ...step1Data, phone_number: e.target.value })}
                    required
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setCurrentStep(0)}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold flex items-center space-x-2"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
              <button
                onClick={handleStep1Submit}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-green-600 to-teal-600 text-white py-3 rounded-xl hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center space-x-2"
              >
                <span>{loading ? 'Saving...' : 'Continue'}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Health Snapshot */}
        {currentStep === 2 && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center space-x-3 mb-6">
              <Heart className="w-8 h-8 text-green-600" />
              <h2 className="text-2xl font-bold text-gray-900">Health Snapshot</h2>
            </div>

            <div className="space-y-6">
              {/* Emergency Contact */}
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
                <h3 className="font-bold text-red-900 mb-4 flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  Emergency Contact <span className="text-red-500 ml-1">*</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                    <input
                      type="text"
                      value={step2Data.emergency_contact_name}
                      onChange={(e) => setStep2Data({ ...step2Data, emergency_contact_name: e.target.value })}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={step2Data.emergency_contact_phone}
                      onChange={(e) => setStep2Data({ ...step2Data, emergency_contact_phone: e.target.value })}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      placeholder="+1 (555) 987-6543"
                    />
                  </div>
                </div>
              </div>

              {/* Medical Information */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Known Allergies (Optional)
                </label>
                <input
                  type="text"
                  value={step2Data.known_allergies}
                  onChange={(e) => setStep2Data({ ...step2Data, known_allergies: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  placeholder="e.g., Penicillin, Peanuts (separate with commas)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chronic Conditions (Optional)
                </label>
                <input
                  type="text"
                  value={step2Data.chronic_conditions}
                  onChange={(e) => setStep2Data({ ...step2Data, chronic_conditions: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  placeholder="e.g., Diabetes, Hypertension (separate with commas)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Medications (Optional)
                </label>
                <textarea
                  value={step2Data.current_medications}
                  onChange={(e) => setStep2Data({ ...step2Data, current_medications: e.target.value })}
                  rows="3"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  placeholder="List your current medications..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Prescription (Optional, max 10MB)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-green-500 transition-all">
                  <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    id="prescription-upload"
                  />
                  <label htmlFor="prescription-upload" className="cursor-pointer">
                    <span className="text-green-600 font-semibold hover:text-green-700">Choose file</span>
                    <span className="text-gray-500 text-sm block mt-1">PDF, JPG, PNG up to 10MB</span>
                  </label>
                  {step2Data.prescription_upload && (
                    <p className="text-sm text-green-600 mt-2">{step2Data.prescription_upload.name}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold flex items-center space-x-2"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
              <button
                onClick={handleStep2Submit}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-green-600 to-teal-600 text-white py-3 rounded-xl hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center space-x-2"
              >
                <span>{loading ? 'Saving...' : 'Continue'}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Preferences */}
        {currentStep === 3 && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center space-x-3 mb-6">
              <Clock className="w-8 h-8 text-green-600" />
              <h2 className="text-2xl font-bold text-gray-900">Preferences & Quick Setup</h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Language</label>
                <select
                  value={step3Data.preferred_language}
                  onChange={(e) => setStep3Data({ ...step3Data, preferred_language: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Contact Method</label>
                <select
                  value={step3Data.preferred_contact_method}
                  onChange={(e) => setStep3Data({ ...step3Data, preferred_contact_method: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="sms">SMS</option>
                  <option value="app_notification">App Notification</option>
                </select>
              </div>

              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={step3Data.share_data_for_research}
                    onChange={(e) => setStep3Data({ ...step3Data, share_data_for_research: e.target.checked })}
                    className="w-5 h-5 text-green-600 rounded mt-1"
                  />
                  <div>
                    <span className="font-semibold text-blue-900">Share data for research</span>
                    <p className="text-sm text-blue-700 mt-1">
                      Help improve healthcare by anonymously contributing to medical research
                    </p>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quick Note for Doctors (max 140 characters)
                </label>
                <textarea
                  value={step3Data.note_for_doctors}
                  onChange={(e) => setStep3Data({ ...step3Data, note_for_doctors: e.target.value })}
                  maxLength={140}
                  rows="2"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  placeholder="What should your doctor know first?"
                />
                <p className="text-xs text-gray-500 mt-1">{step3Data.note_for_doctors.length}/140 characters</p>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold flex items-center space-x-2"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
              <button
                onClick={handleStep3Submit}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-green-600 to-teal-600 text-white py-3 rounded-xl hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center space-x-2"
              >
                <CheckCircle className="w-5 h-5" />
                <span>{loading ? 'Finishing...' : 'Finish Setup'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Time Estimate */}
        <div className="text-center mt-6 text-gray-500 text-sm flex items-center justify-center space-x-2">
          <Clock className="w-4 h-4" />
          <span>
            Step {currentStep + 1} of 4 • Est. {currentStep === 0 ? '30' : currentStep === 1 ? '60' : currentStep === 2 ? '45' : '30'} seconds
          </span>
        </div>
      </div>
    </div>
  );
}
