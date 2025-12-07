/**
 * API Service Layer - This is how React connects to Django REST Framework
 * 
 * CONCEPT EXPLANATION:
 * ===================
 * 1. Axios is a library that makes HTTP requests (like fetch, but better)
 * 2. We create an axios instance with a base URL pointing to our Django backend
 * 3. We use session authentication (cookies) instead of tokens
 * 4. This service layer abstracts all API calls - components just call these functions
 * 
 * HOW IT WORKS:
 * ============
 * - When you call api.doctor.login(username, password), it sends a POST request
 * - Django receives it at /api/doctor/login/
 * - Django processes it, creates a session, and returns user data
 * - Session cookie is automatically stored by browser
 * - Future requests automatically include the session cookie
 */

import axios from 'axios';

// Base URL - This is where your Django backend is running
// Default: mirror the current hostname so cookies stay same-site (localhost ↔ localhost)
const API_PROTOCOL = typeof window !== 'undefined' ? window.location.protocol : 'http:';
const API_HOSTNAME = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || `${API_PROTOCOL}//${API_HOSTNAME}:8000/api`;

// Create an axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important: This sends cookies (session) with requests
});

/**
 * Get CSRF token from cookie
 */
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

/**
 * Request Interceptor - Runs BEFORE every API request
 * Adds CSRF token to all non-GET requests for security
 */
apiClient.interceptors.request.use(
  (config) => {
    // Add CSRF token to non-GET requests
    if (config.method !== 'get') {
      const csrfToken = getCookie('csrftoken');
      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor - Runs AFTER every API response
 * Handles errors globally (like 401 unauthorized)
 */
apiClient.interceptors.response.use(
  (response) => {
    // If request succeeds, just return the data
    return response;
  },
  (error) => {
    // If we get a 401 (unauthorized), user is not authenticated
    if (error.response?.status === 401) {
      // Clear session data and redirect to appropriate login page
      const userRole = localStorage.getItem('userRole');
      localStorage.removeItem('user');
      localStorage.removeItem('userRole');
      
      // Redirect based on user role
      if (userRole === 'patient') {
        window.location.href = '/patient/login';
      } else if (userRole === 'admin') {
        window.location.href = '/admin/login';
      } else {
        window.location.href = '/doctor/login';
      }
    }
    
    // Log error details for debugging
    if (error.response?.status === 400) {
      console.error('400 Bad Request:', error.response.data);
    }
    
    return Promise.reject(error);
  }
);

/**
 * API Service Object - All API calls are organized here
 * Each role (doctor, admin, patient) has its own section
 */
const api = {
  // ==================== CORE API ====================
  core: {
    getCsrfToken: async () => {
      // GET /api/csrf/
      // Only fetch if the cookie is missing to avoid redundant requests
      const csrfToken = getCookie('csrftoken');
      if (csrfToken) {
        return { detail: 'CSRF cookie already set' };
      }
      const response = await apiClient.get('/csrf/');
      return response.data;
    },
  },

  // ==================== DOCTOR API ====================
  doctor: {
    signup: async (data) => {
      // POST /api/doctor/signup/
      // Sends: { username, email, password, password_confirm }
      // Returns: { token, user, profile, redirect_to }
      await api.core.getCsrfToken(); // Get CSRF token first
      const response = await apiClient.post('/doctor/signup/', data);
      return response.data;
    },

    login: async (username, password) => {
      // POST /api/doctor/login/
      // Sends: { username, password }
      // Returns: { token, user, profile, redirect_to }
      await api.core.getCsrfToken(); // Get CSRF token first
      const response = await apiClient.post('/doctor/login/', {
        username,
        password,
      });
      return response.data;
    },

    googleAuth: async (credential) => {
      // POST /api/doctor/google-auth/
      // Sends: { credential } (Google ID token)
      // Returns: { user, profile, redirect_to }
      await api.core.getCsrfToken(); // Get CSRF token first
      const response = await apiClient.post('/doctor/google-auth/', {
        credential,
      });
      return response.data;
    },

    logout: async () => {
      // POST /api/doctor/logout/
      // Requires: Authorization header with token
      await api.core.getCsrfToken();
      const response = await apiClient.post('/doctor/logout/');
      return response.data;
    },

    getProfile: async () => {
      // GET /api/doctor/profile/
      // Requires: Authorization header with token
      const response = await apiClient.get('/doctor/profile/');
      return response.data;
    },

    updateProfile: async (data) => {
      // PATCH /api/doctor/profile/update/
      // Requires: Authorization header with token
      await api.core.getCsrfToken();
      const response = await apiClient.patch('/doctor/profile/update/', data);
      return response.data;
    },

    getCurrentUser: async () => {
      // GET /api/doctor/me/
      // Requires: Authorization header with token
      const response = await apiClient.get('/doctor/me/');
      return response.data;
    },

    // 4-Step Profile Setup
    profileStep0Consent: async (data) => {
      // POST /api/doctor/profile/step0/consent/
      await api.core.getCsrfToken();
      const response = await apiClient.post('/doctor/profile/step0/consent/', data);
      return response.data;
    },

    profileStep1BasicInfo: async (data) => {
      // POST /api/doctor/profile/step1/basic-info/
      await api.core.getCsrfToken();
      const response = await apiClient.post('/doctor/profile/step1/basic-info/', data);
      return response.data;
    },

    profileStep2Credentials: async (formData) => {
      // POST /api/doctor/profile/step2/credentials/
      // Use FormData for file upload
      await api.core.getCsrfToken();
      const response = await apiClient.post('/doctor/profile/step2/credentials/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },

    profileStep3Contact: async (data) => {
      // POST /api/doctor/profile/step3/contact/
      await api.core.getCsrfToken();
      const response = await apiClient.post('/doctor/profile/step3/contact/', data);
      return response.data;
    },

    profileSubmit: async () => {
      // POST /api/doctor/profile/submit/
      await api.core.getCsrfToken();
      const response = await apiClient.post('/doctor/profile/submit/', {});
      return response.data;
    },

    profileSaveDraft: async (data) => {
      // POST /api/doctor/profile/save-draft/
      await api.core.getCsrfToken();
      const response = await apiClient.post('/doctor/profile/save-draft/', data);
      return response.data;
    },

    getVerificationStatus: async () => {
      // GET /api/doctor/profile/verification-status/
      const response = await apiClient.get('/doctor/profile/verification-status/');
      return response.data;
    },

    // Connection Management
    getConnectionRequests: async () => {
      // GET /api/doctor/connections/requests/
      const response = await apiClient.get('/doctor/connections/requests/');
      return response.data;
    },

    getConnectedPatients: async () => {
      // GET /api/doctor/connections/patients/
      const response = await apiClient.get('/doctor/connections/patients/');
      return response.data;
    },

    acceptConnection: async (connectionId, note = '') => {
      // POST /api/doctor/connections/<id>/accept/
      await api.core.getCsrfToken();
      const response = await apiClient.post(`/doctor/connections/${connectionId}/accept/`, { note });
      return response.data;
    },

    rejectConnection: async (connectionId, note = '') => {
      // POST /api/doctor/connections/<id>/reject/
      await api.core.getCsrfToken();
      const response = await apiClient.post(`/doctor/connections/${connectionId}/reject/`, { note });
      return response.data;
    },

    removePatientConnection: async (connectionId) => {
      // POST /api/doctor/connections/<id>/remove/
      await api.core.getCsrfToken();
      const response = await apiClient.post(`/doctor/connections/${connectionId}/remove/`);
      return response.data;
    },

    // QR Code Generation
    generateQRCode: async (data = {}) => {
      // POST /api/doctor/qr/generate/
      await api.core.getCsrfToken();
      const response = await apiClient.post('/doctor/qr/generate/', data);
      return response.data;
    },

    getMyQRTokens: async () => {
      // GET /api/doctor/qr/tokens/
      const response = await apiClient.get('/doctor/qr/tokens/');
      return response.data;
    },

    deleteQRToken: async (token) => {
      // DELETE /api/doctor/qr/<token>/delete/
      await api.core.getCsrfToken();
      const response = await apiClient.delete(`/doctor/qr/${token}/delete/`);
      return response.data;
    },

    // Patient Search
    searchPatients: async (params = {}) => {
      // GET /api/doctor/patients/search/
      const response = await apiClient.get('/doctor/patients/search/', { params });
      return response.data;
    },

    connectWithPatient: async (patientId, note = '') => {
      // POST /api/doctor/patients/connect/
      await api.core.getCsrfToken();
      const response = await apiClient.post('/doctor/patients/connect/', {
        patient_id: patientId,
        note: note
      });
      return response.data;
    },

    // Doctor-Patient Workspaces
    getCareWorkspaces: async () => {
      // GET /api/doctor/workspaces/
      const response = await apiClient.get('/doctor/workspaces/');
      return response.data;
    },

    getCareWorkspaceDetail: async (connectionId, params = {}) => {
      // GET /api/doctor/workspaces/<id>/
      const response = await apiClient.get(`/doctor/workspaces/${connectionId}/`, { params });
      return response.data;
    },

    updateCareWorkspace: async (connectionId, data) => {
      // PATCH /api/doctor/workspaces/<id>/
      await api.core.getCsrfToken();
      const response = await apiClient.patch(`/doctor/workspaces/${connectionId}/`, data);
      return response.data;
    },

    addWorkspaceEntry: async (connectionId, data) => {
      // POST /api/doctor/workspaces/<id>/entries/
      await api.core.getCsrfToken();
      const response = await apiClient.post(`/doctor/workspaces/${connectionId}/entries/`, data);
      return response.data;
    },

    // Patient Profile Details
    getPatientProfile: async (patientId) => {
      // GET /api/doctor/patients/<id>/profile/
      const response = await apiClient.get(`/doctor/patients/${patientId}/profile/`);
      return response.data;
    },

    // Dashboard Summary
    getDashboardSummary: async () => {
      // GET /api/doctor/dashboard/summary/
      const response = await apiClient.get('/doctor/dashboard/summary/');
      return response.data;
    },

    // AI Intake Form endpoints (Doctor Side)
    createIntakeForm: async (workspaceId, doctorPrompt, title = 'Patient Intake Form', description = '') => {
      // POST /api/doctor/intake-forms/create/
      await api.core.getCsrfToken();
      const response = await apiClient.post('/doctor/intake-forms/create/', {
        workspace: workspaceId,
        doctor_prompt: doctorPrompt,
        title,
        description,
      });
      return response.data;
    },

    getIntakeForms: async (workspaceId = null, status = null) => {
      // GET /api/doctor/intake-forms/
      const params = {};
      if (workspaceId) params.workspace_id = workspaceId;
      if (status) params.status = status;
      const response = await apiClient.get('/doctor/intake-forms/', { params });
      return response.data;
    },

    getIntakeFormDetail: async (formId) => {
      // GET /api/doctor/intake-forms/<id>/
      const response = await apiClient.get(`/doctor/intake-forms/${formId}/`);
      return response.data;
    },

    updateIntakeForm: async (formId, data) => {
      // PUT /api/doctor/intake-forms/<id>/update/
      await api.core.getCsrfToken();
      const response = await apiClient.put(`/doctor/intake-forms/${formId}/update/`, data);
      return response.data;
    },

    sendIntakeForm: async (formId) => {
      // POST /api/doctor/intake-forms/<id>/send/
      await api.core.getCsrfToken();
      const response = await apiClient.post(`/doctor/intake-forms/${formId}/send/`);
      return response.data;
    },

    deleteIntakeForm: async (formId) => {
      // DELETE /api/doctor/intake-forms/<id>/delete/
      await api.core.getCsrfToken();
      const response = await apiClient.delete(`/doctor/intake-forms/${formId}/delete/`);
      return response.data;
    },
  },

  // ==================== ADMIN API ====================
  admin: {
    signup: async (data) => {
      await api.core.getCsrfToken(); // Get CSRF token first
      const response = await apiClient.post('/admin/signup/', data);
      return response.data;
    },

    login: async (username, password) => {
      await api.core.getCsrfToken(); // Get CSRF token first
      const response = await apiClient.post('/admin/login/', {
        username,
        password,
      });
      return response.data;
    },

    logout: async () => {
      await api.core.getCsrfToken();
      const response = await apiClient.post('/admin/logout/');
      return response.data;
    },

    getProfile: async () => {
      const response = await apiClient.get('/admin/profile/');
      return response.data;
    },

    updateProfile: async (data) => {
      await api.core.getCsrfToken();
      const response = await apiClient.patch('/admin/profile/update/', data);
      return response.data;
    },

    getCurrentUser: async () => {
      const response = await apiClient.get('/admin/me/');
      return response.data;
    },

    getPendingDoctors: async () => {
      await api.core.getCsrfToken();
      const response = await apiClient.get('/admin/doctors/pending/');
      return response.data;
    },

    getAllDoctors: async (status) => {
      await api.core.getCsrfToken();
      const query = status ? `?status=${status}` : '';
      const response = await apiClient.get(`/admin/doctors/all/${query}`);
      return response.data;
    },

    verifyDoctor: async (doctorId) => {
      await api.core.getCsrfToken();
      const response = await apiClient.post(`/admin/doctors/${doctorId}/verify/`);
      return response.data;
    },

    rejectDoctor: async (doctorId, reason) => {
      await api.core.getCsrfToken();
      const response = await apiClient.post(`/admin/doctors/${doctorId}/reject/`, { reason });
      return response.data;
    },
  },

  // ==================== PATIENT API ====================
  patient: {
    signup: async (data) => {
      await api.core.getCsrfToken(); // Get CSRF token first
      const response = await apiClient.post('/patient/signup/', data);
      return response.data;
    },

    login: async (username, password) => {
      await api.core.getCsrfToken(); // Get CSRF token first
      const response = await apiClient.post('/patient/login/', {
        username,
        password,
      });
      return response.data;
    },

    googleAuth: async (credential) => {
      // POST /api/patient/google-auth/
      // Sends: { credential} (Google ID token)
      // Returns: { user, profile, redirect_to }
      await api.core.getCsrfToken(); // Get CSRF token first
      const response = await apiClient.post('/patient/google-auth/', {
        credential,
      });
      return response.data;
    },

    logout: async () => {
      await api.core.getCsrfToken();
      const response = await apiClient.post('/patient/logout/');
      return response.data;
    },

    getProfile: async () => {
      const response = await apiClient.get('/patient/profile/');
      return response.data;
    },

    updateProfile: async (data) => {
      await api.core.getCsrfToken();
      const response = await apiClient.patch('/patient/profile/update/', data);
      return response.data;
    },

    getCurrentUser: async () => {
      const response = await apiClient.get('/patient/me/');
      return response.data;
    },

    // Profile Setup Wizard
    submitConsent: async (data) => {
      await api.core.getCsrfToken();
      const response = await apiClient.post('/patient/setup/consent/', data);
      return response.data;
    },

    submitStep1: async (data) => {
      await api.core.getCsrfToken();
      const response = await apiClient.post('/patient/setup/step1/', data);
      return response.data;
    },

    submitStep2: async (formData) => {
      await api.core.getCsrfToken();
      const response = await apiClient.post('/patient/setup/step2/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },

    submitStep3: async (data) => {
      await api.core.getCsrfToken();
      const response = await apiClient.post('/patient/setup/step3/', data);
      return response.data;
    },

    finishProfileSetup: async () => {
      await api.core.getCsrfToken();
      const response = await apiClient.post('/patient/setup/finish/', {});
      return response.data;
    },

    getProfileSetupStatus: async () => {
      const response = await apiClient.get('/patient/setup/status/');
      return response.data;
    },

    // Doctor Linking
    searchDoctors: async (params) => {
      const queryString = new URLSearchParams(params).toString();
      const response = await apiClient.get(`/patient/doctors/search/?${queryString}`);
      return response.data;
    },

    createConnection: async (data) => {
      await api.core.getCsrfToken();
      const response = await apiClient.post('/patient/connections/create/', data);
      return response.data;
    },

    getMyConnections: async () => {
      const response = await apiClient.get('/patient/connections/');
      return response.data;
    },

    getConnectedDoctors: async () => {
      const response = await apiClient.get('/patient/connections/doctors/');
      return response.data;
    },

    removeConnection: async (connectionId) => {
      await api.core.getCsrfToken();
      const response = await apiClient.delete(`/patient/connections/${connectionId}/remove/`);
      return response.data;
    },

    acceptConnection: async (connectionId, note = '') => {
      // POST /api/patient/connections/<id>/accept/
      await api.core.getCsrfToken();
      const response = await apiClient.post(`/patient/connections/${connectionId}/accept/`, { note });
      return response.data;
    },

    rejectConnection: async (connectionId, note = '') => {
      // POST /api/patient/connections/<id>/reject/
      await api.core.getCsrfToken();
      const response = await apiClient.post(`/patient/connections/${connectionId}/reject/`, { note });
      return response.data;
    },

    // Doctor-Patient Workspaces
    getCareWorkspaces: async () => {
      // GET /api/patient/workspaces/
      const response = await apiClient.get('/patient/workspaces/');
      return response.data;
    },

    getCareWorkspaceDetail: async (connectionId, params = {}) => {
      // GET /api/patient/workspaces/<id>/
      const response = await apiClient.get(`/patient/workspaces/${connectionId}/`, { params });
      return response.data;
    },

    // QR Code Scanning
    validateQRToken: async (token) => {
      // GET /api/patient/qr/validate/<token>/
      const response = await apiClient.get(`/patient/qr/validate/${token}/`);
      return response.data;
    },

    scanQRCode: async (token) => {
      // POST /api/patient/qr/scan/<token>/
      await api.core.getCsrfToken();
      const response = await apiClient.post(`/patient/qr/scan/${token}/`);
      return response.data;
    },

    // AI Intake Form endpoints (Patient Side)
    getIntakeForms: async (status = null) => {
      // GET /api/patient/intake-forms/
      const params = status ? { status } : {};
      const response = await apiClient.get('/patient/intake-forms/', { params });
      return response.data;
    },

    getIntakeFormDetail: async (formId) => {
      // GET /api/patient/intake-forms/<id>/
      const response = await apiClient.get(`/patient/intake-forms/${formId}/`);
      return response.data;
    },

    saveFormResponse: async (formId, responseData, isComplete = false) => {
      // POST /api/patient/intake-forms/<id>/response/
      await api.core.getCsrfToken();
      const response = await apiClient.post(`/patient/intake-forms/${formId}/response/`, {
        response_data: responseData,
        is_complete: isComplete,
      });
      return response.data;
    },

    uploadFormFile: async (formId, fieldId, fieldLabel, file, uploadType = 'document', description = '') => {
      // POST /api/patient/intake-forms/<id>/upload/
      await api.core.getCsrfToken();
      const formData = new FormData();
      formData.append('field_id', fieldId);
      formData.append('field_label', fieldLabel);
      formData.append('file', file);
      formData.append('upload_type', uploadType);
      formData.append('description', description);

      const response = await apiClient.post(`/patient/intake-forms/${formId}/upload/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },

    deleteFormUpload: async (formId, uploadId) => {
      // DELETE /api/patient/intake-forms/<id>/upload/<upload_id>/delete/
      await api.core.getCsrfToken();
      const response = await apiClient.delete(`/patient/intake-forms/${formId}/upload/${uploadId}/delete/`);
      return response.data;
    },

    getFormNotifications: async () => {
      // GET /api/patient/intake-forms/notifications/
      const response = await apiClient.get('/patient/intake-forms/notifications/');
      return response.data;
    },

    getDashboardSummary: async () => {
      // GET /api/patient/dashboard/summary/
      const response = await apiClient.get('/patient/dashboard/summary/');
      return response.data;
    },
  },
};

export default api;

