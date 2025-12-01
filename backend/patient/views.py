from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth import login
from django.contrib.auth.models import User
from django.views.decorators.csrf import ensure_csrf_cookie
from .models import PatientProfile
from .serializers import (
    PatientSignupSerializer,
    PatientLoginSerializer,
    PatientProfileSerializer,
    PatientProfileUpdateSerializer,
    UserSerializer
)


@ensure_csrf_cookie
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def patient_signup(request):
    """Patient signup endpoint"""
    serializer = PatientSignupSerializer(data=request.data)
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
            
            # Get patient profile
            patient_profile = authenticated_user.patient_profile
            
            return Response({
                'message': 'Patient account created successfully',
                'user': UserSerializer(authenticated_user).data,
                'profile': PatientProfileSerializer(patient_profile).data,
                'profile_completed': patient_profile.profile_completed,
                'redirect_to': 'profile'  # Patient always redirects to profile page
            }, status=status.HTTP_201_CREATED)
        else:
            return Response({'error': 'Failed to authenticate user'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@ensure_csrf_cookie
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def patient_login(request):
    """Patient login endpoint"""
    serializer = PatientLoginSerializer(data=request.data)
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
            
            # Get patient profile
            patient_profile = authenticated_user.patient_profile
            
            return Response({
                'message': 'Login successful',
                'user': UserSerializer(authenticated_user).data,
                'profile': PatientProfileSerializer(patient_profile).data,
                'profile_completed': patient_profile.profile_completed,
                'redirect_to': 'profile'  # Patient always redirects to profile page
            }, status=status.HTTP_200_OK)
        else:
            return Response({'error': 'Authentication failed'}, status=status.HTTP_401_UNAUTHORIZED)
    
    # Return detailed error information
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def patient_logout(request):
    """Patient logout endpoint"""
    from django.contrib.auth import logout
    logout(request)
    return Response({'message': 'Logout successful'}, status=status.HTTP_200_OK)


class PatientProfileView(generics.RetrieveAPIView):
    """Get patient profile"""
    serializer_class = PatientProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user.patient_profile


class PatientProfileUpdateView(generics.UpdateAPIView):
    """Update patient profile"""
    serializer_class = PatientProfileUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user.patient_profile
    
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial, context={'request': request})
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        # Return updated profile
        updated_profile = PatientProfileSerializer(instance)
        return Response({
            'message': 'Profile updated successfully',
            'profile': updated_profile.data,
            'profile_completed': instance.profile_completed,
            'redirect_to': 'profile'  # Patient always redirects to profile page
        }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def patient_current_user(request):
    """Get current authenticated patient user"""
    user = request.user
    patient_profile = user.patient_profile
    
    return Response({
        'user': UserSerializer(user).data,
        'profile': PatientProfileSerializer(patient_profile).data,
        'profile_completed': patient_profile.profile_completed,
        'redirect_to': 'profile'  # Patient always redirects to profile page
    }, status=status.HTTP_200_OK)


@ensure_csrf_cookie
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def patient_google_auth(request):
    """Patient Google OAuth authentication"""
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
            # Check if user has patient profile
            try:
                patient_profile = user.patient_profile
            except PatientProfile.DoesNotExist:
                # User exists but not a patient - create patient profile
                patient_profile = PatientProfile.objects.create(
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
            
            # Create patient profile
            patient_profile = PatientProfile.objects.create(
                user=user,
                first_name=first_name,
                last_name=last_name
            )
        
        # Log the user in
        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        
        return Response({
            'message': 'Google authentication successful',
            'user': UserSerializer(user).data,
            'profile': PatientProfileSerializer(patient_profile).data,
            'profile_completed': patient_profile.profile_completed,
            'redirect_to': 'profile'
        }, status=status.HTTP_200_OK)
        
    except ValueError as e:
        return Response({'error': f'Invalid token: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': f'Authentication failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
