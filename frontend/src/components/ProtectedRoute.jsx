/**
 * ProtectedRoute Component - Protects routes that require authentication
 * 
 * HOW IT WORKS:
 * ============
 * 1. Checks if user is authenticated using useAuth()
 * 2. If not authenticated, redirects to login
 * 3. If authenticated, shows the protected component
 * 4. Can also check for specific roles if needed
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, allowedRoles = null }) {
  const { isAuthenticated, userRole, loading } = useAuth();

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl">Loading...</p>
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If specific roles are required, check if user's role is allowed
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <Navigate to="/login" replace />;
  }

  // User is authenticated and has correct role, show the component
  return children;
}

