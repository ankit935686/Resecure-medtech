/**
 * AuthContext - Manages Authentication State Globally
 * 
 * CONCEPT EXPLANATION:
 * ===================
 * React Context allows us to share state (like user info, login status) 
 * across ALL components without prop drilling.
 * 
 * HOW IT WORKS:
 * ============
 * 1. We create a Context that holds: user data, login status, login/logout functions
 * 2. We wrap the app with AuthProvider
 * 3. Any component can use useAuth() hook to access auth state
 * 4. When user logs in, we:
 *    - Call Django API
 *    - Get token and user data back
 *    - Store token in localStorage (persists across page refreshes)
 *    - Update context state
 *    - Redirect based on user role
 */

import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

// Create the context
const AuthContext = createContext(null);

/**
 * AuthProvider Component
 * Wraps the entire app and provides auth state to all children
 */
export function AuthProvider({ children }) {
  // State variables
  const [user, setUser] = useState(null); // Current logged-in user
  const [userRole, setUserRole] = useState(null); // 'doctor', 'admin', or 'patient'
  const [loading, setLoading] = useState(true); // Loading state

  /**
   * Check if user is already logged in (on app load)
   * Verifies session by calling API
   */
  useEffect(() => {
    // Try to verify session by checking stored role
    const storedUser = localStorage.getItem('user');
    const storedRole = localStorage.getItem('userRole');

    if (storedUser && storedRole) {
      setUser(JSON.parse(storedUser));
      setUserRole(storedRole);
      
      // Verify session is still valid by fetching current user
      verifySession(storedRole);
    } else {
      setLoading(false);
    }
  }, []);

  /**
   * Verify session is still valid by calling the API
   */
  const verifySession = async (role) => {
    try {
      let userData;
      switch (role) {
        case 'doctor':
          userData = await api.doctor.getCurrentUser();
          break;
        case 'admin':
          userData = await api.admin.getCurrentUser();
          break;
        case 'patient':
          userData = await api.patient.getCurrentUser();
          break;
        default:
          throw new Error('Invalid role');
      }
      setUser(userData.user);
      setLoading(false);
    } catch (error) {
      // Session invalid, clear everything
      logout();
    }
  };

  /**
   * Login function - handles login for all roles
   */
  const login = async (role, username, password) => {
    try {
      let response;
      
      // Call the appropriate API based on role
      switch (role) {
        case 'doctor':
          response = await api.doctor.login(username, password);
          break;
        case 'admin':
          response = await api.admin.login(username, password);
          break;
        case 'patient':
          response = await api.patient.login(username, password);
          break;
        default:
          throw new Error('Invalid role');
      }

      // Store user data (session is handled by cookies)
      const { user: userData, redirect_to } = response;
      
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('userRole', role);
      
      setUser(userData);
      setUserRole(role);

      return { success: true, redirect_to };
    } catch (error) {
      // Return error message
      const errorMessage = error.response?.data?.errors?.non_field_errors?.[0] 
        || error.response?.data?.message 
        || 'Login failed. Please try again.';
      return { success: false, error: errorMessage };
    }
  };

  /**
   * Signup function - handles signup for all roles
   */
  const signup = async (role, signupData) => {
    try {
      let response;
      
      // Call the appropriate API based on role
      switch (role) {
        case 'doctor':
          response = await api.doctor.signup(signupData);
          break;
        case 'admin':
          response = await api.admin.signup(signupData);
          break;
        case 'patient':
          response = await api.patient.signup(signupData);
          break;
        default:
          throw new Error('Invalid role');
      }

      // Store user data (session is handled by cookies)
      const { user: userData, redirect_to } = response;
      
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('userRole', role);
      
      setUser(userData);
      setUserRole(role);

      return { success: true, redirect_to };
    } catch (error) {
      // Log full error for debugging
      console.error('Signup error:', error.response?.data || error);
      
      // Return error message - handle different error formats
      let errorMessage = 'Signup failed. Please try again.';
      
      if (error.response?.data) {
        const data = error.response.data;
        
        // Handle different error response formats
        if (data.errors) {
          // Format: { errors: { field: ['error'] } }
          if (typeof data.errors === 'string') {
            errorMessage = data.errors;
          } else if (data.errors.non_field_errors) {
            errorMessage = data.errors.non_field_errors[0];
          } else {
            // Get first error from any field
            const firstError = Object.values(data.errors)[0];
            errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
          }
        } else if (data.non_field_errors) {
          // Format: { non_field_errors: ['error'] }
          errorMessage = Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : data.non_field_errors;
        } else if (data.message) {
          // Format: { message: 'error' }
          errorMessage = data.message;
        } else if (typeof data === 'object' && Object.keys(data).length > 0) {
          // Format: { field: ['error'] } - Direct serializer errors
          const firstField = Object.keys(data)[0];
          const firstError = data[firstField];
          errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
        } else if (typeof data === 'string') {
          errorMessage = data;
        }
      }
      
      return { success: false, error: errorMessage };
    }
  };

  /**
   * Google authentication function - handles Google OAuth for all roles
   */
  const googleAuth = async (role, credential) => {
    try {
      let response;
      
      // Call the appropriate API based on role
      switch (role) {
        case 'doctor':
          response = await api.doctor.googleAuth(credential);
          break;
        case 'patient':
          response = await api.patient.googleAuth(credential);
          break;
        default:
          throw new Error('Invalid role for Google auth');
      }

      // Store user data (session is handled by cookies)
      const { user: userData, redirect_to } = response;
      
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('userRole', role);
      
      setUser(userData);
      setUserRole(role);

      return { success: true, redirect_to };
    } catch (error) {
      console.error('Google auth error:', error.response?.data || error);
      
      let errorMessage = 'Google authentication failed. Please try again.';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      return { success: false, error: errorMessage };
    }
  };

  /**
   * Logout function - clears all auth data
   */
  const logout = async () => {
    try {
      // Call logout API if we have a role
      if (userRole) {
        switch (userRole) {
          case 'doctor':
            await api.doctor.logout();
            break;
          case 'admin':
            await api.admin.logout();
            break;
          case 'patient':
            await api.patient.logout();
            break;
        }
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear everything regardless of API call success
      localStorage.removeItem('user');
      localStorage.removeItem('userRole');
      setUser(null);
      setUserRole(null);
    }
  };

  // Value object - what we're providing to all components
  const value = {
    user,
    userRole,
    loading,
    login,
    signup,
    googleAuth,
    logout,
    isAuthenticated: !!user, // true if user exists
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook to use auth context
 * Components call: const { user, login, logout } = useAuth();
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

