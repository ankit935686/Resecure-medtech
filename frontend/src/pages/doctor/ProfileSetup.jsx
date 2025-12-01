/**
 * 4-Step Doctor Profile Setup Wizard
 * Mobile-friendly, minimal, fast profile completion flow
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle, Upload, Copy, Check, AlertCircle, 
  User, Building, MapPin, FileText, Phone, Mail, 
  Stethoscope, ChevronRight, ChevronLeft, Save
} from 'lucide-react';
import api from '../../services/api';

// Specialization options
const SPECIALIZATIONS = [
  'Cardiology', 'Dermatology', 'Emergency Medicine', 'Endocrinology',
  'Family Medicine', 'Gastroenterology', 'General Surgery', 'Geriatrics',
  'Hematology', 'Infectious Disease', 'Internal Medicine', 'Nephrology',
  'Neurology', 'Obstetrics & Gynecology', 'Oncology', 'Ophthalmology',
  'Orthopedics', 'Otolaryngology', 'Pathology', 'Pediatrics',
  'Psychiatry', 'Pulmonology', 'Radiology', 'Rheumatology', 'Urology'
];

export default function ProfileSetup() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [profile, setProfile] = useState(null);
  const [copiedDoctorId, setCopiedDoctorId] = useState(false);

  // Form data for each step
  const [step0Data, setStep0Data] = useState({ consent_given: false });
  const [step1Data, setStep1Data] = useState({
    first_name: '',
    last_name: '',
    display_name: '',
    specialization: '',
    primary_clinic_hospital: '',
    city: '',
    country: ''
  });
  const [step2Data, setStep2Data] = useState({
    license_number: '',
    license_document: null
  });
  const [step3Data, setStep3Data] = useState({
    phone_number: '',
    professional_email: '',
    bio: '',
    consultation_mode: ''
  });

  // Load existing profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.doctor.getProfile();
      setProfile(data);
      
      // Pre-fill form data
      if (data.first_name) setStep1Data(prev => ({ ...prev, first_name: data.first_name }));
      if (data.last_name) setStep1Data(prev => ({ ...prev, last_name: data.last_name }));
      if (data.display_name) setStep1Data(prev => ({ ...prev, display_name: data.display_name }));
      if (data.specialization) setStep1Data(prev => ({ ...prev, specialization: data.specialization }));
      if (data.primary_clinic_hospital) setStep1Data(prev => ({ ...prev, primary_clinic_hospital: data.primary_clinic_hospital }));
      if (data.city) setStep1Data(prev => ({ ...prev, city: data.city }));
      if (data.country) setStep1Data(prev => ({ ...prev, country: data.country }));
      if (data.license_number) setStep2Data(prev => ({ ...prev, license_number: data.license_number }));
      if (data.phone_number) setStep3Data(prev => ({ ...prev, phone_number: data.phone_number }));
      if (data.professional_email) setStep3Data(prev => ({ ...prev, professional_email: data.professional_email }));
      if (data.bio) setStep3Data(prev => ({ ...prev, bio: data.bio }));
      if (data.consultation_mode) setStep3Data(prev => ({ ...prev, consultation_mode: data.consultation_mode }));
      
      setStep0Data({ consent_given: data.consent_given || false });
      setCurrentStep(data.current_step || 0);
    } catch (err) {
      console.error('Error loading profile:', err);
      if (err.response?.status === 403) {
        setError('You must be logged in as a doctor to access this page. Please logout and login as a doctor.');
        // Redirect to login after 3 seconds
        setTimeout(() => navigate('/doctor/login'), 3000);
      } else {
        setError('Failed to load profile. Please try again.');
      }
    }
  };

  const handleStep0 = async () => {
    if (!step0Data.consent_given) {
      setError('You must give consent to proceed');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await api.doctor.profileStep0Consent(step0Data);
      setCurrentStep(1);
      setSuccessMessage('Consent recorded successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save consent');
    } finally {
      setLoading(false);
    }
  };

  const handleStep1 = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Auto-generate display name if empty
      if (!step1Data.display_name && step1Data.first_name && step1Data.last_name) {
        step1Data.display_name = `Dr. ${step1Data.first_name} ${step1Data.last_name}`;
      }

      const response = await api.doctor.profileStep1BasicInfo(step1Data);
      setProfile(response.profile);
      setCurrentStep(2);
      setSuccessMessage('Basic info saved!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      const errors = err.response?.data;
      if (errors) {
        const firstError = Object.values(errors)[0];
        setError(Array.isArray(firstError) ? firstError[0] : firstError);
      } else {
        setError('Failed to save basic info');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async () => {
    if (!step2Data.license_number) {
      setError('License number is required');
      return;
    }
    if (!step2Data.license_document) {
      setError('Please upload your license document');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('license_number', step2Data.license_number);
      formData.append('license_document', step2Data.license_document);

      const response = await api.doctor.profileStep2Credentials(formData);
      setProfile(response.profile);
      setCurrentStep(3);
      setSuccessMessage(`Doctor ID generated: ${response.doctor_id}`);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      const errors = err.response?.data;
      if (errors) {
        const firstError = Object.values(errors)[0];
        setError(Array.isArray(firstError) ? firstError[0] : firstError);
      } else {
        setError('Failed to save credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStep3 = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await api.doctor.profileStep3Contact(step3Data);
      setProfile(response.profile);
      setCurrentStep(4);
      setSuccessMessage('Contact info saved!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      const errors = err.response?.data;
      if (errors) {
        const firstError = Object.values(errors)[0];
        setError(Array.isArray(firstError) ? firstError[0] : firstError);
      } else {
        setError('Failed to save contact info');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    
    try {
      await api.doctor.profileSubmit();
      navigate('/doctor/verification-pending');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    setLoading(true);
    try {
      await api.doctor.profileSaveDraft({
        ...step1Data,
        ...step2Data,
        ...step3Data
      });
      setSuccessMessage('Draft saved!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to save draft');
    } finally {
      setLoading(false);
    }
  };

  const copyDoctorId = () => {
    if (profile?.doctor_id) {
      navigator.clipboard.writeText(profile.doctor_id);
      setCopiedDoctorId(true);
      setTimeout(() => setCopiedDoctorId(false), 2000);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (10MB cap to keep uploads fast)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      setStep2Data({ ...step2Data, license_document: file });
      setError('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Doctor Profile Setup</h1>
          <p className="text-gray-600">Complete your profile to start serving patients</p>
        </div>

        {/* Progress Bar */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            {[0, 1, 2, 3, 4].map((step) => (
              <div key={step} className="flex-1 flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  currentStep > step ? 'bg-green-500 text-white' :
                  currentStep === step ? 'bg-blue-600 text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {currentStep > step ? <Check className="w-5 h-5" /> : step}
                </div>
                {step < 4 && (
                  <div className={`flex-1 h-1 mx-2 ${
                    currentStep > step ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="text-center text-sm text-gray-600">
            Step {currentStep} of 4
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
        )}
        
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            {successMessage}
          </div>
        )}

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Step 0: Consent */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div className="text-center">
                <FileText className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Consent Required</h2>
                <p className="text-gray-600">Please read and accept to continue</p>
              </div>

              <div className="bg-blue-50 p-6 rounded-lg">
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    checked={step0Data.consent_given}
                    onChange={(e) => setStep0Data({ consent_given: e.target.checked })}
                    className="mt-1 mr-3 w-5 h-5"
                  />
                  <span className="text-gray-700">
                    I consent to store and verify my professional information for patient care. 
                    I understand that my information will be reviewed by administrators before 
                    I can access the platform.
                  </span>
                </label>
              </div>

              <button
                onClick={handleStep0}
                disabled={!step0Data.consent_given || loading}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? 'Processing...' : 'Accept & Continue'}
                <ChevronRight className="w-5 h-5 ml-2" />
              </button>
            </div>
          )}

          {/* Step 1: Basic Professional Info */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <User className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold">Basic Professional Info</h2>
                <p className="text-gray-600">Tell us about yourself</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">First Name *</label>
                  <input
                    type="text"
                    value={step1Data.first_name}
                    onChange={(e) => setStep1Data({ ...step1Data, first_name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="John"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Last Name *</label>
                  <input
                    type="text"
                    value={step1Data.last_name}
                    onChange={(e) => setStep1Data({ ...step1Data, last_name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Smith"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Display Name</label>
                <input
                  type="text"
                  value={step1Data.display_name}
                  onChange={(e) => setStep1Data({ ...step1Data, display_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Dr. John Smith (auto-generated if empty)"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Specialty *</label>
                <select
                  value={step1Data.specialization}
                  onChange={(e) => setStep1Data({ ...step1Data, specialization: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select your specialty</option>
                  {SPECIALIZATIONS.map(spec => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Primary Clinic / Hospital *</label>
                <input
                  type="text"
                  value={step1Data.primary_clinic_hospital}
                  onChange={(e) => setStep1Data({ ...step1Data, primary_clinic_hospital: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="City General Hospital"
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">City *</label>
                  <input
                    type="text"
                    value={step1Data.city}
                    onChange={(e) => setStep1Data({ ...step1Data, city: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Mumbai"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Country *</label>
                  <input
                    type="text"
                    value={step1Data.country}
                    onChange={(e) => setStep1Data({ ...step1Data, country: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="India"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleSaveDraft}
                  disabled={loading}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all flex items-center justify-center"
                >
                  <Save className="w-5 h-5 mr-2" />
                  Save Draft
                </button>
                <button
                  onClick={handleStep1}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all flex items-center justify-center"
                >
                  {loading ? 'Saving...' : 'Continue'}
                  <ChevronRight className="w-5 h-5 ml-2" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Credentials & Doctor ID */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <Stethoscope className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold">Credentials & License</h2>
                <p className="text-gray-600">Verify your medical credentials</p>
              </div>

              {profile?.doctor_id && (
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Your Doctor ID</p>
                      <p className="text-2xl font-bold text-green-700">{profile.doctor_id}</p>
                    </div>
                    <button
                      onClick={copyDoctorId}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
                    >
                      {copiedDoctorId ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      <span className="ml-2">{copiedDoctorId ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Medical License Number *</label>
                <input
                  type="text"
                  value={step2Data.license_number}
                  onChange={(e) => setStep2Data({ ...step2Data, license_number: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., MH-12345"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Upload License Document *</label>
                <label
                  htmlFor="license-upload"
                  className="block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer"
                >
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-1">
                    {step2Data.license_document ? step2Data.license_document.name : 'Click to upload'}
                  </p>
                  <p className="text-sm text-gray-500">Any document up to 10MB</p>
                </label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  id="license-upload"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all flex items-center justify-center"
                >
                  <ChevronLeft className="w-5 h-5 mr-2" />
                  Back
                </button>
                <button
                  onClick={handleStep2}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all flex items-center justify-center"
                >
                  {loading ? 'Uploading...' : 'Continue'}
                  <ChevronRight className="w-5 h-5 ml-2" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Contact & Bio */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <Phone className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold">Contact & Bio</h2>
                <p className="text-gray-600">How patients can reach you</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number *</label>
                <input
                  type="tel"
                  value={step3Data.phone_number}
                  onChange={(e) => setStep3Data({ ...step3Data, phone_number: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+919876543210"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Professional Email</label>
                <input
                  type="email"
                  value={step3Data.professional_email}
                  onChange={(e) => setStep3Data({ ...step3Data, professional_email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Prefilled from your account"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Short Bio <span className="text-gray-500 text-xs">(Optional, max 280 chars)</span>
                </label>
                <textarea
                  value={step3Data.bio}
                  onChange={(e) => setStep3Data({ ...step3Data, bio: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows="3"
                  maxLength="280"
                  placeholder="Brief description of your practice and experience..."
                />
                <p className="text-xs text-gray-500 mt-1">{step3Data.bio.length}/280 characters</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Consultation Mode</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'teleconsultation', label: 'Tele' },
                    { value: 'in_person', label: 'In-Person' },
                    { value: 'both', label: 'Both' }
                  ].map(mode => (
                    <button
                      key={mode.value}
                      onClick={() => setStep3Data({ ...step3Data, consultation_mode: mode.value })}
                      className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                        step3Data.consultation_mode === mode.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all flex items-center justify-center"
                >
                  <ChevronLeft className="w-5 h-5 mr-2" />
                  Back
                </button>
                <button
                  onClick={handleStep3}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all flex items-center justify-center"
                >
                  {loading ? 'Saving...' : 'Continue'}
                  <ChevronRight className="w-5 h-5 ml-2" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review & Submit */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold">Review & Submit</h2>
                <p className="text-gray-600">Almost there! Review your information</p>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Personal Information</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-600">Name:</span> <span className="font-medium">{step1Data.first_name} {step1Data.last_name}</span></div>
                    <div><span className="text-gray-600">Display:</span> <span className="font-medium">{step1Data.display_name}</span></div>
                    <div><span className="text-gray-600">Specialty:</span> <span className="font-medium">{step1Data.specialization}</span></div>
                    <div><span className="text-gray-600">Hospital:</span> <span className="font-medium">{step1Data.primary_clinic_hospital}</span></div>
                    <div><span className="text-gray-600">Location:</span> <span className="font-medium">{step1Data.city}, {step1Data.country}</span></div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Credentials</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-600">License:</span> <span className="font-medium">{step2Data.license_number}</span></div>
                    <div><span className="text-gray-600">Doctor ID:</span> <span className="font-medium text-green-600">{profile?.doctor_id}</span></div>
                    <div><span className="text-gray-600">Document:</span> <span className="font-medium">{step2Data.license_document?.name || 'Uploaded ✓'}</span></div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Contact</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-600">Phone:</span> <span className="font-medium">{step3Data.phone_number}</span></div>
                    <div><span className="text-gray-600">Mode:</span> <span className="font-medium capitalize">{step3Data.consultation_mode}</span></div>
                  </div>
                  {step3Data.bio && (
                    <div className="mt-2"><span className="text-gray-600">Bio:</span> <p className="text-sm mt-1">{step3Data.bio}</p></div>
                  )}
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> After submission, your profile will be reviewed by our admin team. 
                  You'll be notified once verified (usually within 24 hours).
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all flex items-center justify-center"
                >
                  <ChevronLeft className="w-5 h-5 mr-2" />
                  Back
                </button>
                <button
                  onClick={handleSaveDraft}
                  disabled={loading}
                  className="flex-1 bg-gray-500 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 transition-all flex items-center justify-center"
                >
                  <Save className="w-5 h-5 mr-2" />
                  Save for Later
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all flex items-center justify-center"
                >
                  {loading ? 'Submitting...' : 'Submit for Verification'}
                  <CheckCircle className="w-5 h-5 ml-2" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
