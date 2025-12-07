/**
 * Main App Component - Sets up routing and authentication
 * 
 * HOW REACT ROUTER WORKS WITH DJANGO:
 * ===================================
 * 1. React Router handles client-side routing (URL changes in browser)
 * 2. Django doesn't need to know about these routes - it only handles API calls
 * 3. When user navigates to /doctor/dashboard:
 *    - React Router shows Dashboard component
 *    - Dashboard component uses useAuth() to get user data
 *    - If needed, Dashboard can call Django API to fetch more data
 * 
 * FLOW:
 * =====
 * User visits /login → Login page → Calls Django API → Gets token → 
 * Stores in localStorage → Redirects to /doctor/dashboard → 
 * ProtectedRoute checks auth → Shows Dashboard
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import LandingPage from './pages/LandingPage';

// Doctor Pages
import LoginDoctor from './pages/doctor/LoginDoctor';
import SignupDoctor from './pages/doctor/SignupDoctor';
import ProfileSetup from './pages/doctor/ProfileSetup';
import VerificationPending from './pages/doctor/VerificationPending';

// Admin Pages
import LoginAdmin from './pages/admin/LoginAdmin';
import SignupAdmin from './pages/admin/SignupAdmin';
import DoctorVerification from './pages/admin/DoctorVerification';

// Patient Pages
import LoginPatient from './pages/patient/LoginPatient';
import SignupPatient from './pages/patient/SignupPatient';
import PatientProfileSetup from './pages/patient/PatientProfileSetup';
import PatientDashboard from './pages/patient/PatientDashboard';
import ScanQRCode from './pages/patient/ScanQRCode';
import PatientWorkspace from './pages/patient/PatientWorkspace';
import IntakeFormFiller from './pages/patient/IntakeFormFiller';

// Doctor Dashboard
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import DoctorPatientWorkspaces from './pages/doctor/DoctorPatientWorkspaces';
import DoctorWorkspaceDetail from './pages/doctor/DoctorWorkspaceDetail';
import IntakeFormReview from './pages/doctor/IntakeFormReview';
import IntakeFormBuilder from './pages/doctor/IntakeFormBuilder';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes - Doctor */}
          <Route path="/doctor/login" element={<LoginDoctor />} />
          <Route path="/doctor/signup" element={<SignupDoctor />} />

          {/* Public Routes - Admin */}
          <Route path="/admin/login" element={<LoginAdmin />} />
          <Route path="/admin/signup" element={<SignupAdmin />} />

          {/* Public Routes - Patient */}
          <Route path="/patient/login" element={<LoginPatient />} />
          <Route path="/patient/signup" element={<SignupPatient />} />

          {/* Landing Page - Root */}
          <Route path="/" element={<LandingPage />} />

          {/* Protected Routes - Doctor */}
          <Route
            path="/doctor/dashboard"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/profile"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/profile-setup"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <ProfileSetup />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/verification-pending"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <VerificationPending />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/workspaces"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorPatientWorkspaces />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/workspaces/:connectionId"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorWorkspaceDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/intake-form/new"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <IntakeFormBuilder />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/intake-form/:formId"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <IntakeFormReview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/intake-form/:formId/edit"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <IntakeFormBuilder />
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Admin */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/doctors"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <DoctorVerification />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/profile"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Profile />
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Patient */}
          <Route
            path="/patient/dashboard"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <PatientDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/profile"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/profile-setup"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <PatientProfileSetup />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/workspaces/:connectionId"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <PatientWorkspace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/forms/:formId"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <IntakeFormFiller />
              </ProtectedRoute>
            }
          />

          {/* Public Route - Patient QR Scan (requires auth but anyone with link can access) */}
          <Route
            path="/patient/scan-qr/:token"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <ScanQRCode />
              </ProtectedRoute>
            }
          />

          {/* Catch all - redirect to landing page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
