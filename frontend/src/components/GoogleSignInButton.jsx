import { useEffect, useRef } from 'react';

/**
 * Google Sign-In Button Component
 * 
 * This component renders a Google Sign-In button and handles the OAuth flow
 * 
 * Props:
 * - onSuccess: callback function when sign-in succeeds
 * - onError: callback function when sign-in fails
 * - text: button text ("signin_with" | "signup_with" | "continue_with")
 */
export default function GoogleSignInButton({ onSuccess, onError, text = 'signin_with' }) {
  const googleButtonRef = useRef(null);

  useEffect(() => {
    // Check if Google Sign-In script is already loaded
    if (window.google && window.google.accounts) {
      initializeGoogleSignIn();
    } else {
      // Load Google Sign-In script
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogleSignIn;
      document.body.appendChild(script);

      return () => {
        // Cleanup script on unmount
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      };
    }
  }, []);

  const initializeGoogleSignIn = () => {
    if (!window.google || !googleButtonRef.current) return;

    // Initialize Google Sign-In
    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
      callback: handleCredentialResponse,
    });

    // Render the button
    window.google.accounts.id.renderButton(
      googleButtonRef.current,
      {
        theme: 'outline',
        size: 'large',
        text: text,
        width: '100%',
        logo_alignment: 'left',
      }
    );
  };

  const handleCredentialResponse = (response) => {
    if (response.credential) {
      onSuccess(response.credential);
    } else {
      onError('Failed to get credential from Google');
    }
  };

  return (
    <div className="w-full">
      <div ref={googleButtonRef} className="w-full flex justify-center"></div>
    </div>
  );
}
