from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from django.contrib.auth import authenticate, login
from django.contrib.auth.models import User
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils import timezone
from .models import DoctorProfile
from .serializers import (
    DoctorSignupSerializer,
    DoctorLoginSerializer,
    DoctorProfileSerializer,
    DoctorProfileUpdateSerializer,
    DoctorProfileStep0Serializer,
    DoctorProfileStep1Serializer,
    DoctorProfileStep2Serializer,
    DoctorProfileStep3Serializer,
    DoctorProfileSubmitSerializer,
    UserSerializer
)


@ensure_csrf_cookie
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def doctor_signup(request):
    """Doctor signup endpoint"""
    serializer = DoctorSignupSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        
        # Authenticate the user to set the backend attribute
        from django.contrib.auth import authenticate
        authenticated_user = authenticate(
            request,
            username=user.username,
            password=request.data.get('password')
        )
        
        if authenticated_user:
            # Log the user in (creates session)
            login(request, authenticated_user)
            
            # Get doctor profile
            doctor_profile = authenticated_user.doctor_profile
            
            return Response({
                'message': 'Doctor account created successfully',
                'user': UserSerializer(authenticated_user).data,
                'profile': DoctorProfileSerializer(doctor_profile).data,
                'profile_completed': doctor_profile.profile_completed,
                'redirect_to': 'profile' if not doctor_profile.profile_completed else 'dashboard'
            }, status=status.HTTP_201_CREATED)
        else:
            return Response({'error': 'Failed to authenticate user'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@ensure_csrf_cookie
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def doctor_login(request):
    """Doctor login endpoint"""
    serializer = DoctorLoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data['user']
        
        # Authenticate again to ensure backend attribute is set
        from django.contrib.auth import authenticate
        authenticated_user = authenticate(
            request,
            username=request.data.get('username'),
            password=request.data.get('password')
        )
        
        if authenticated_user:
            # Log the user in (creates session)
            login(request, authenticated_user)
            
            # Get doctor profile
            doctor_profile = authenticated_user.doctor_profile
            
            # Determine redirect based on profile status
            if doctor_profile.profile_status == 'pending':
                redirect_to = 'verification_pending'
            elif doctor_profile.profile_status == 'verified':
                redirect_to = 'dashboard'
            else:  # draft or rejected
                redirect_to = 'profile'
            
            return Response({
                'message': 'Login successful',
                'user': UserSerializer(authenticated_user).data,
                'profile': DoctorProfileSerializer(doctor_profile).data,
                'profile_completed': doctor_profile.profile_completed,
                'profile_status': doctor_profile.profile_status,
                'redirect_to': redirect_to
            }, status=status.HTTP_200_OK)
        else:
            return Response({'error': 'Authentication failed'}, status=status.HTTP_401_UNAUTHORIZED)
    
    # Return detailed error information
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def doctor_logout(request):
    """Doctor logout endpoint"""
    from django.contrib.auth import logout
    logout(request)
    return Response({'message': 'Logout successful'}, status=status.HTTP_200_OK)


class DoctorProfileView(generics.RetrieveAPIView):
    """Get doctor profile"""
    serializer_class = DoctorProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        print(f"[PROFILE VIEW] User: {self.request.user}, Authenticated: {self.request.user.is_authenticated}")
        print(f"[PROFILE VIEW] Session key: {self.request.session.session_key}")
        print(f"[PROFILE VIEW] Session data: {dict(self.request.session)}")
        print(f"[PROFILE VIEW] Cookies: {self.request.COOKIES}")
        if not self.request.user.is_authenticated:
            from rest_framework.exceptions import NotAuthenticated
            raise NotAuthenticated('You must be logged in to access this endpoint')
        
        try:
            return self.request.user.doctor_profile
        except DoctorProfile.DoesNotExist:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You must be logged in as a doctor to access this endpoint')


class DoctorProfileUpdateView(generics.UpdateAPIView):
    """Update doctor profile"""
    serializer_class = DoctorProfileUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user.doctor_profile
    
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial, context={'request': request})
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        # Return updated profile
        updated_profile = DoctorProfileSerializer(instance)
        return Response({
            'message': 'Profile updated successfully',
            'profile': updated_profile.data,
            'profile_completed': instance.profile_completed,
            'redirect_to': 'dashboard' if instance.profile_completed else 'profile'
        }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def doctor_current_user(request):
    """Get current authenticated doctor user"""
    user = request.user
    doctor_profile = user.doctor_profile
    
    return Response({
        'user': UserSerializer(user).data,
        'profile': DoctorProfileSerializer(doctor_profile).data,
        'profile_completed': doctor_profile.profile_completed
    }, status=status.HTTP_200_OK)


@ensure_csrf_cookie
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def doctor_google_auth(request):
    """Doctor Google OAuth authentication"""
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    from django.conf import settings
    
    token = request.data.get('credential')
    
    if not token:
        return Response({'error': 'No credential provided'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Get Google Client ID from settings
        google_client_id = settings.GOOGLE_CLIENT_ID
        
        # Verify the token with Google (with clock skew tolerance)
        idinfo = id_token.verify_oauth2_token(
            token, 
            google_requests.Request(),
            google_client_id,  # Verify with your actual client ID
            clock_skew_in_seconds=10  # Allow 10 seconds clock skew tolerance
        )
        
        # Verify the token is for our client ID
        if idinfo['aud'] != google_client_id:
            return Response({'error': 'Invalid token audience'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get user info from Google
        email = idinfo.get('email')
        google_id = idinfo.get('sub')
        first_name = idinfo.get('given_name', '')
        last_name = idinfo.get('family_name', '')
        
        if not email:
            return Response({'error': 'Email not provided by Google'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user exists
        user = User.objects.filter(email=email).first()
        
        if user:
            # Check if user has doctor profile
            try:
                doctor_profile = user.doctor_profile
            except DoctorProfile.DoesNotExist:
                # User exists but not a doctor - create doctor profile
                doctor_profile = DoctorProfile.objects.create(
                    user=user,
                    first_name=first_name,
                    last_name=last_name
                )
        else:
            # Create new user
            username = email.split('@')[0] + '_' + google_id[:8]
            user = User.objects.create_user(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name
            )
            user.set_unusable_password()  # No password for OAuth users
            user.save()
            
            # Create doctor profile
            doctor_profile = DoctorProfile.objects.create(
                user=user,
                first_name=first_name,
                last_name=last_name
            )
        
        # Log the user in
        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        
        # Debug: Check session
        print(f"[GOOGLE AUTH] User logged in: {user.username}")
        print(f"[GOOGLE AUTH] Session key: {request.session.session_key}")
        print(f"[GOOGLE AUTH] Session data: {dict(request.session)}")
        print(f"[GOOGLE AUTH] User authenticated: {request.user.is_authenticated}")
        
        # Determine redirect based on profile status
        if doctor_profile.profile_status == 'pending':
            redirect_to = 'verification_pending'
        elif doctor_profile.profile_status == 'verified':
            redirect_to = 'dashboard'
        else:  # draft or rejected
            redirect_to = 'profile'
        
        return Response({
            'message': 'Google authentication successful',
            'user': UserSerializer(user).data,
            'profile': DoctorProfileSerializer(doctor_profile, context={'request': request}).data,
            'profile_completed': doctor_profile.profile_completed,
            'profile_status': doctor_profile.profile_status,
            'redirect_to': redirect_to
        }, status=status.HTTP_200_OK)
        
    except ValueError as e:
        return Response({'error': f'Invalid token: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': f'Authentication failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ==================== 4-STEP PROFILE SETUP ====================

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def profile_step0_consent(request):
    """Step 0: Give consent to proceed"""
    try:
        profile = request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return Response({
            'error': 'You must be logged in as a doctor to access this endpoint',
            'detail': 'Doctor profile not found for current user'
        }, status=status.HTTP_403_FORBIDDEN)
    
    serializer = DoctorProfileStep0Serializer(profile, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response({
            'message': 'Consent recorded successfully',
            'profile': DoctorProfileSerializer(profile, context={'request': request}).data
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def profile_step1_basic_info(request):
    """Step 1: Basic Professional Info"""
    try:
        profile = request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if not profile.consent_given:
        return Response({'error': 'Consent must be given before proceeding'}, status=status.HTTP_400_BAD_REQUEST)
    
    serializer = DoctorProfileStep1Serializer(profile, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response({
            'message': 'Basic info saved successfully',
            'profile': DoctorProfileSerializer(profile, context={'request': request}).data
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def profile_step2_credentials(request):
    """Step 2: Credentials & Doctor ID"""
    try:
        profile = request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if profile.current_step < 1:
        return Response({'error': 'Complete previous steps first'}, status=status.HTTP_400_BAD_REQUEST)
    
    serializer = DoctorProfileStep2Serializer(profile, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response({
            'message': 'Credentials saved successfully',
            'doctor_id': profile.doctor_id,
            'profile': DoctorProfileSerializer(profile, context={'request': request}).data
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def profile_step3_contact(request):
    """Step 3: Contact & Bio"""
    try:
        profile = request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if profile.current_step < 2:
        return Response({'error': 'Complete previous steps first'}, status=status.HTTP_400_BAD_REQUEST)
    
    serializer = DoctorProfileStep3Serializer(profile, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response({
            'message': 'Contact info saved successfully',
            'profile': DoctorProfileSerializer(profile, context={'request': request}).data
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def profile_submit_verification(request):
    """Step 4: Submit profile for admin verification"""
    try:
        profile = request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if profile.current_step < 3:
        return Response({'error': 'Complete all steps before submitting'}, status=status.HTTP_400_BAD_REQUEST)
    
    serializer = DoctorProfileSubmitSerializer(profile, data=request.data)
    if serializer.is_valid():
        profile.submit_for_verification()
        
        return Response({
            'message': 'Profile submitted for verification successfully',
            'profile': DoctorProfileSerializer(profile, context={'request': request}).data,
            'redirect_to': 'verification_pending'
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def profile_save_draft(request):
    """Save profile as draft (can be submitted later)"""
    try:
        profile = request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Save current data without validation
    for key, value in request.data.items():
        if hasattr(profile, key) and key not in ['id', 'user', 'doctor_id', 'profile_status']:
            setattr(profile, key, value)
    
    profile.save()
    
    return Response({
        'message': 'Draft saved successfully',
        'profile': DoctorProfileSerializer(profile, context={'request': request}).data
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def profile_verification_status(request):
    """Check profile verification status"""
    try:
        profile = request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    return Response({
        'profile_status': profile.profile_status,
        'is_verified': profile.is_verified,
        'is_pending': profile.is_pending,
        'can_access_dashboard': profile.can_access_dashboard,
        'rejection_reason': profile.rejection_reason if profile.profile_status == 'rejected' else None,
        'verified_at': profile.verified_at,
        'submitted_at': profile.submitted_at,
        'profile': DoctorProfileSerializer(profile, context={'request': request}).data
    }, status=status.HTTP_200_OK)
