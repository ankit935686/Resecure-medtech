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
from patient.models import PatientDoctorConnection, ConnectionToken
from datetime import timedelta
import qrcode
from io import BytesIO
import base64


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


# ==================== DOCTOR-PATIENT CONNECTION MANAGEMENT ====================

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_connection_requests(request):
    """Get all pending connection requests from patients"""
    try:
        doctor_profile = request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Get all pending connections
    pending_connections = PatientDoctorConnection.objects.filter(
        doctor=doctor_profile,
        status='pending'
    ).select_related('patient', 'patient__user').order_by('-created_at')
    
    # Serialize connection data (hiding sensitive patient info)
    connections_data = []
    for conn in pending_connections:
        connections_data.append({
            'id': conn.id,
            'patient_name': conn.patient.full_name,
            'patient_age': conn.patient.date_of_birth.year if conn.patient.date_of_birth else None,
            'patient_gender': conn.patient.gender,
            'patient_note': conn.patient_note,
            'connection_type': conn.connection_type,
            'created_at': conn.created_at,
            'emergency_contact': conn.patient.emergency_contact_name if conn.patient.emergency_contact_name else None,
        })
    
    return Response({
        'pending_requests': connections_data,
        'count': len(connections_data)
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_connected_patients(request):
    """Get all accepted patient connections"""
    try:
        doctor_profile = request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Get all accepted connections
    connected_patients = PatientDoctorConnection.objects.filter(
        doctor=doctor_profile,
        status='accepted'
    ).select_related('patient', 'patient__user').order_by('-accepted_at')
    
    # Serialize full patient data for accepted connections
    patients_data = []
    for conn in connected_patients:
        patients_data.append({
            'connection_id': conn.id,
            'patient_id': conn.patient.patient_id,
            'patient_name': conn.patient.full_name,
            'patient_email': conn.patient.user.email,
            'patient_phone': conn.patient.phone_number,
            'date_of_birth': conn.patient.date_of_birth,
            'gender': conn.patient.gender,
            'blood_group': conn.patient.blood_group,
            'allergies': conn.patient.known_allergies,
            'chronic_conditions': conn.patient.chronic_conditions,
            'current_medications': conn.patient.current_medications,
            'emergency_contact_name': conn.patient.emergency_contact_name,
            'emergency_contact_phone': conn.patient.emergency_contact_phone,
            'preferred_language': conn.patient.preferred_language,
            'note_for_doctors': conn.patient.note_for_doctors,
            'connected_since': conn.accepted_at,
            'patient_note': conn.patient_note,
        })
    
    return Response({
        'connected_patients': patients_data,
        'count': len(patients_data)
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def accept_connection_request(request, connection_id):
    """Accept a patient connection request"""
    try:
        doctor_profile = request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    try:
        connection = PatientDoctorConnection.objects.get(
            id=connection_id,
            doctor=doctor_profile,
            status='pending'
        )
    except PatientDoctorConnection.DoesNotExist:
        return Response({'error': 'Connection request not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Accept the connection
    doctor_note = request.data.get('note', '')
    connection.accept_connection(doctor_note)
    
    return Response({
        'message': 'Connection accepted successfully',
        'connection_id': connection.id,
        'patient_name': connection.patient.full_name,
        'patient_id': connection.patient.patient_id
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def reject_connection_request(request, connection_id):
    """Reject a patient connection request"""
    try:
        doctor_profile = request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    try:
        connection = PatientDoctorConnection.objects.get(
            id=connection_id,
            doctor=doctor_profile,
            status='pending'
        )
    except PatientDoctorConnection.DoesNotExist:
        return Response({'error': 'Connection request not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Reject the connection
    doctor_note = request.data.get('note', '')
    connection.reject_connection(doctor_note)
    
    return Response({
        'message': 'Connection rejected',
        'connection_id': connection.id
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def remove_patient_connection(request, connection_id):
    """Remove a patient connection"""
    try:
        doctor_profile = request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    try:
        connection = PatientDoctorConnection.objects.get(
            id=connection_id,
            doctor=doctor_profile,
            status='accepted'
        )
    except PatientDoctorConnection.DoesNotExist:
        return Response({'error': 'Connection not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Remove the connection
    connection.remove_connection()
    
    return Response({
        'message': 'Connection removed successfully',
        'connection_id': connection.id
    }, status=status.HTTP_200_OK)


# ==================== QR CODE GENERATION & MANAGEMENT ====================

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def generate_qr_token(request):
    """Generate QR code token for patient connection"""
    try:
        doctor_profile = request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Check if doctor is verified
    if not doctor_profile.is_verified:
        return Response({
            'error': 'Only verified doctors can generate connection QR codes'
        }, status=status.HTTP_403_FORBIDDEN)
    
    # Get expiry time from request (default 24 hours)
    expiry_hours = request.data.get('expiry_hours', 24)
    max_uses = request.data.get('max_uses', 1)
    
    # Validate inputs
    if expiry_hours < 1 or expiry_hours > 168:  # Max 1 week
        return Response({
            'error': 'Expiry hours must be between 1 and 168 (1 week)'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if max_uses < 1 or max_uses > 100:
        return Response({
            'error': 'Max uses must be between 1 and 100'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Create token
    expires_at = timezone.now() + timedelta(hours=expiry_hours)
    token = ConnectionToken.objects.create(
        doctor=doctor_profile,
        expires_at=expires_at,
        max_uses=max_uses
    )
    
    # Generate QR code URL
    # In production, this should be your actual frontend URL
    frontend_url = request.data.get('frontend_url', 'http://localhost:5173')
    qr_data = f"{frontend_url}/patient/scan-qr/{token.token}"
    
    # Generate QR code image
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(qr_data)
    qr.make(fit=True)
    
    # Create image
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    return Response({
        'message': 'QR code generated successfully',
        'token': token.token,
        'qr_code_image': f'data:image/png;base64,{img_str}',
        'qr_url': qr_data,
        'expires_at': token.expires_at,
        'max_uses': token.max_uses,
        'doctor_name': doctor_profile.display_name or doctor_profile.full_name,
        'doctor_specialization': doctor_profile.specialization
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_my_qr_tokens(request):
    """Get all QR tokens generated by this doctor"""
    try:
        doctor_profile = request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Get all tokens
    tokens = ConnectionToken.objects.filter(
        doctor=doctor_profile
    ).order_by('-created_at')
    
    tokens_data = []
    for token in tokens:
        tokens_data.append({
            'token': token.token,
            'created_at': token.created_at,
            'expires_at': token.expires_at,
            'is_expired': token.is_expired,
            'is_used': token.is_used,
            'is_valid': token.is_valid,
            'use_count': token.use_count,
            'max_uses': token.max_uses,
            'used_by': token.used_by_patient.full_name if token.used_by_patient else None,
            'used_at': token.used_at
        })
    
    return Response({
        'tokens': tokens_data,
        'count': len(tokens_data)
    }, status=status.HTTP_200_OK)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_qr_token(request, token_str):
    """Delete a QR token (only expired or used tokens)"""
    try:
        doctor_profile = request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    try:
        token = ConnectionToken.objects.get(
            token=token_str,
            doctor=doctor_profile
        )
    except ConnectionToken.DoesNotExist:
        return Response({'error': 'Token not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Only allow deletion of expired or fully used tokens
    if token.is_valid:
        return Response({
            'error': 'Cannot delete active QR token. Only expired or fully used tokens can be deleted.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Delete the token
    token.delete()
    
    return Response({
        'message': 'QR token deleted successfully',
        'token': token_str
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def search_patients(request):
    """Search for patients by name or patient ID (for doctors)"""
    try:
        doctor_profile = request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    from patient.models import PatientProfile
    from django.db.models import Q
    
    query = request.GET.get('q', '').strip()
    patient_id = request.GET.get('patient_id', '').strip()
    
    if not query and not patient_id:
        return Response({
            'error': 'Please provide a search query or patient ID'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Get patients with completed profiles only
    patients = PatientProfile.objects.filter(profile_completed=True)
    
    if patient_id:
        # Search by patient ID (exact match)
        patients = patients.filter(patient_id=patient_id)
    elif query:
        # Search by name
        patients = patients.filter(
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query)
        )
    
    # Get existing connections to check status
    existing_connections = PatientDoctorConnection.objects.filter(
        doctor=doctor_profile,
        patient__in=patients
    ).values('patient_id', 'status')
    
    connection_status_map = {conn['patient_id']: conn['status'] for conn in existing_connections}
    
    # Limit results
    patients = patients[:20]
    
    patients_data = []
    for patient in patients:
        connection_status = connection_status_map.get(patient.id, None)
        patients_data.append({
            'id': patient.id,
            'patient_id': patient.patient_id,
            'full_name': patient.full_name,
            'age': patient.date_of_birth.year if patient.date_of_birth else None,
            'gender': patient.gender,
            'blood_group': patient.blood_group,
            'city': patient.city if hasattr(patient, 'city') else None,
            'connection_status': connection_status  # None, 'pending', 'accepted', 'rejected'
        })
    
    return Response({
        'count': len(patients_data),
        'patients': patients_data
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_patient_connection(request):
    """Create a connection request to a patient (doctor initiated)"""
    try:
        doctor_profile = request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    from patient.models import PatientProfile
    
    patient_id = request.data.get('patient_id')
    doctor_note = request.data.get('note', '')
    
    if not patient_id:
        return Response({'error': 'Patient ID is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        patient_profile = PatientProfile.objects.get(id=patient_id)
    except PatientProfile.DoesNotExist:
        return Response({'error': 'Patient not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Check if connection already exists
    existing_connection = PatientDoctorConnection.objects.filter(
        patient=patient_profile,
        doctor=doctor_profile
    ).first()
    
    if existing_connection:
        return Response({
            'error': f'Connection already exists with status: {existing_connection.status}'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Create connection request from doctor
    connection = PatientDoctorConnection.objects.create(
        patient=patient_profile,
        doctor=doctor_profile,
        doctor_note=doctor_note,
        connection_type='request',
        initiated_by='doctor',
        status='pending'
    )
    
    return Response({
        'message': 'Connection request sent to patient successfully',
        'connection_id': connection.id,
        'patient_name': patient_profile.full_name,
        'status': connection.status
    }, status=status.HTTP_201_CREATED)
