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
from patient.models import (
    PatientDoctorConnection,
    ConnectionToken,
    DoctorPatientWorkspace,
    DoctorPatientTimelineEntry,
)
from patient.serializers import (
    DoctorPatientWorkspaceSummarySerializer,
    DoctorPatientWorkspaceDetailSerializer,
    DoctorPatientWorkspaceUpdateSerializer,
    DoctorPatientTimelineEntrySerializer,
    DoctorPatientTimelineEntryCreateSerializer,
)
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


# ==================== PATIENT WORKSPACES (DOCTOR VIEW) ====================

def _get_workspace_for_doctor(doctor_profile, connection_id):
    """Helper to fetch workspace for a doctor/connection combo"""
    try:
        connection = PatientDoctorConnection.objects.select_related('patient', 'doctor').get(
            id=connection_id,
            doctor=doctor_profile,
            status='accepted'
        )
    except PatientDoctorConnection.DoesNotExist:
        return None

    workspace = DoctorPatientWorkspace.ensure_for_connection(connection)
    workspace.sync_metadata()
    return workspace


def _parse_entries_limit(request):
    limit_param = request.GET.get('limit')
    try:
        return int(limit_param) if limit_param else None
    except (TypeError, ValueError):
        return None


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def doctor_list_workspaces(request):
    """List all active care workspaces for the doctor"""
    try:
        doctor_profile = request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)

    connections = PatientDoctorConnection.objects.filter(
        doctor=doctor_profile,
        status='accepted'
    ).select_related('patient', 'doctor')

    if not connections.exists():
        return Response({'count': 0, 'workspaces': []}, status=status.HTTP_200_OK)

    connection_ids = []
    for connection in connections:
        DoctorPatientWorkspace.ensure_for_connection(connection).sync_metadata()
        connection_ids.append(connection.id)

    workspaces = DoctorPatientWorkspace.objects.filter(
        connection_id__in=connection_ids
    ).select_related('patient', 'doctor', 'connection').prefetch_related('timeline_entries')

    serializer = DoctorPatientWorkspaceSummarySerializer(workspaces, many=True)
    return Response({'count': len(serializer.data), 'workspaces': serializer.data}, status=status.HTTP_200_OK)


@api_view(['GET', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def doctor_workspace_detail(request, connection_id):
    """Get or update a specific workspace"""
    try:
        doctor_profile = request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)

    workspace = _get_workspace_for_doctor(doctor_profile, connection_id)
    if not workspace:
        return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'PATCH':
        serializer = DoctorPatientWorkspaceUpdateSerializer(workspace, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            detail = DoctorPatientWorkspaceDetailSerializer(
                workspace,
                context={'entries_limit': _parse_entries_limit(request), 'include_internal_notes': True}
            )
            return Response({
                'message': 'Workspace updated successfully',
                'workspace': detail.data
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    serializer = DoctorPatientWorkspaceDetailSerializer(
        workspace,
        context={'entries_limit': _parse_entries_limit(request), 'include_internal_notes': True}
    )
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def doctor_workspace_add_entry(request, connection_id):
    """Add a treatment/update note to the workspace timeline"""
    try:
        doctor_profile = request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)

    workspace = _get_workspace_for_doctor(doctor_profile, connection_id)
    if not workspace:
        return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = DoctorPatientTimelineEntryCreateSerializer(data=request.data)
    if serializer.is_valid():
        entry = serializer.save(workspace=workspace, created_by='doctor')
        entry_data = DoctorPatientTimelineEntrySerializer(entry).data
        return Response({
            'message': 'Update shared with patient',
            'entry': entry_data
        }, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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


# ==================== PATIENT PROFILE DETAILS FOR DOCTORS ====================

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_patient_profile_detail(request, patient_id):
    """Get comprehensive patient profile details for a connected patient"""
    try:
        doctor_profile = request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Get patient profile
    try:
        from patient.models import PatientProfile
        patient_profile = PatientProfile.objects.get(id=patient_id)
    except PatientProfile.DoesNotExist:
        return Response({'error': 'Patient not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Check if doctor is connected to this patient
    try:
        connection = PatientDoctorConnection.objects.get(
            patient=patient_profile,
            doctor=doctor_profile,
            status='accepted'
        )
    except PatientDoctorConnection.DoesNotExist:
        return Response({
            'error': 'You are not connected to this patient'
        }, status=status.HTTP_403_FORBIDDEN)
    
    # Serialize patient profile with context
    from patient.serializers import PatientProfileForDoctorSerializer
    serializer = PatientProfileForDoctorSerializer(
        patient_profile,
        context={'doctor_profile': doctor_profile}
    )
    
    return Response({
        'patient': serializer.data,
        'connection': {
            'id': connection.id,
            'created_at': connection.created_at,
            'connection_type': connection.connection_type,
            'patient_note': connection.patient_note,
        }
    }, status=status.HTTP_200_OK)


# ==================== DOCTOR DASHBOARD SUMMARY ====================

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def doctor_dashboard_summary(request):
    """Get comprehensive dashboard summary for doctor"""
    try:
        doctor_profile = request.user.doctor_profile
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Get all connections
    connections = PatientDoctorConnection.objects.filter(doctor=doctor_profile)
    
    # Count by status
    total_patients = connections.filter(status='accepted').count()
    pending_requests = connections.filter(status='pending').count()
    
    # Get active workspaces
    active_workspaces = DoctorPatientWorkspace.objects.filter(
        doctor=doctor_profile,
        status='active'
    ).select_related('patient', 'connection').count()
    
    # Get recent timeline entries (last 7 days)
    from datetime import timedelta
    from django.utils import timezone
    seven_days_ago = timezone.now() - timedelta(days=7)
    
    recent_updates = DoctorPatientTimelineEntry.objects.filter(
        workspace__doctor=doctor_profile,
        created_at__gte=seven_days_ago
    ).count()
    
    # Get upcoming reviews (next 30 days)
    thirty_days_later = timezone.now() + timedelta(days=30)
    upcoming_reviews = DoctorPatientWorkspace.objects.filter(
        doctor=doctor_profile,
        next_review_date__isnull=False,
        next_review_date__lte=thirty_days_later.date(),
        next_review_date__gte=timezone.now().date()
    ).select_related('patient').order_by('next_review_date')
    
    upcoming_reviews_data = []
    for workspace in upcoming_reviews[:5]:  # Limit to 5
        upcoming_reviews_data.append({
            'patient_name': workspace.patient.full_name,
            'patient_id': workspace.patient.patient_id,
            'review_date': workspace.next_review_date,
            'workspace_id': workspace.id,
            'connection_id': workspace.connection_id,
        })
    
    # Get critical/important updates
    critical_entries = DoctorPatientTimelineEntry.objects.filter(
        workspace__doctor=doctor_profile,
        is_critical=True,
        created_at__gte=seven_days_ago
    ).select_related('workspace__patient').order_by('-created_at')[:5]
    
    critical_entries_data = []
    for entry in critical_entries:
        critical_entries_data.append({
            'patient_name': entry.workspace.patient.full_name,
            'patient_id': entry.workspace.patient.patient_id,
            'title': entry.title,
            'summary': entry.summary,
            'entry_type': entry.entry_type,
            'created_at': entry.created_at,
            'workspace_id': entry.workspace.id,
        })
    
    # Get QR tokens statistics
    qr_tokens = ConnectionToken.objects.filter(doctor=doctor_profile)
    active_qr_tokens = qr_tokens.filter(is_valid=True).count()
    
    return Response({
        'summary': {
            'total_patients': total_patients,
            'pending_requests': pending_requests,
            'active_workspaces': active_workspaces,
            'recent_updates_count': recent_updates,
            'active_qr_tokens': active_qr_tokens,
        },
        'upcoming_reviews': upcoming_reviews_data,
        'critical_updates': critical_entries_data,
        'doctor_info': {
            'name': doctor_profile.display_name or doctor_profile.full_name,
            'doctor_id': doctor_profile.doctor_id,
            'specialization': doctor_profile.specialization,
            'verification_status': doctor_profile.profile_status,
        }
    }, status=status.HTTP_200_OK)


# ===========================
# AI Intake Form Views (Doctor Side)
# ===========================

import os
import json
import time
import requests
from patient.models import AIIntakeForm, IntakeFormResponse, IntakeFormUpload
from patient.serializers import (
    AIIntakeFormSerializer,
    AIIntakeFormCreateSerializer,
    AIIntakeFormUpdateSerializer,
    DoctorIntakeFormListSerializer,
    IntakeFormUploadSerializer,
)


def generate_intake_form_with_gemini(doctor_prompt, patient_context=None):
    """
    Generate intake form schema using Groq API with retry logic and error handling
    """
    api_key = os.getenv('GROQ_API_KEY')
    if not api_key:
        return {
            'success': False,
            'error': 'GROQ_API_KEY not configured. Please add your Groq API key to environment variables.',
            'raw_response': None,
            'quota_exceeded': False
        }
    
    # Groq API endpoint and model
    api_url = 'https://api.groq.com/openai/v1/chat/completions'
    model_name = 'llama-3.3-70b-versatile'
    
    # Retry configuration
    max_retries = 3
    base_delay = 2
    
    last_error = None
    raw_response = None
    
    for attempt in range(max_retries):
        try:
            # Build the system prompt
            system_instruction = """You are a medical intake form generator. Your task is to create a structured intake form based on a doctor's requirements.

Return ONLY a valid JSON object with this EXACT structure (no markdown, no code blocks, no explanations):

{
    "fields": [
        {
            "id": "unique_field_id",
            "label": "Question or field label",
            "type": "text|textarea|number|date|select|multiselect|file",
            "required": true,
            "placeholder": "Optional placeholder text",
            "helpText": "Optional help text",
            "options": ["option1", "option2"],
            "validation": {"min": 0, "max": 100},
            "category": "personal|medical|lifestyle|history"
        }
    ],
    "report_uploads": [
        {
            "id": "unique_upload_id",
            "label": "Report name to upload",
            "description": "Description of what report is needed",
            "required": true,
            "upload_type": "medical_report|lab_result|prescription|imaging|document"
        }
    ]
}

Field types:
- text: Single line text input
- textarea: Multi-line text input
- number: Numeric input
- date: Date picker
- select: Single choice dropdown
- multiselect: Multiple choice selection
- file: File upload (use this in report_uploads section)

Categories help organize fields:
- personal: Name, age, contact info
- medical: Current symptoms, conditions, medications
- lifestyle: Diet, exercise, sleep, habits
- history: Past medical history, surgeries, family history

Make fields relevant to the doctor's request. Use proper medical terminology but keep questions clear for patients."""

            context_info = ""
            if patient_context:
                context_info = f"\nPatient Context: {json.dumps(patient_context, indent=2)}\n"
            
            user_prompt = f"""{context_info}
Doctor's Request: {doctor_prompt}

Generate the intake form JSON now:"""
            
            # Call Grok API
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key}'
            }
            
            payload = {
                'messages': [
                    {'role': 'system', 'content': system_instruction},
                    {'role': 'user', 'content': user_prompt}
                ],
                'model': model_name,
                'stream': False,
                'temperature': 0.7,
                'max_tokens': 2048
            }
            
            response = requests.post(api_url, headers=headers, json=payload, timeout=30)
            
            # Check for errors
            if response.status_code != 200:
                error_detail = response.json() if response.text else {'error': 'Unknown error'}
                raise Exception(f"Groq API error (status {response.status_code}): {error_detail}")
            
            # Parse response
            response_data = response.json()
            raw_response = response_data['choices'][0]['message']['content'].strip()
            
            # Clean up the response - remove markdown code blocks if present
            cleaned_response = raw_response
            if '```json' in cleaned_response:
                cleaned_response = cleaned_response.split('```json')[1].split('```')[0]
            elif '```' in cleaned_response:
                cleaned_response = cleaned_response.split('```')[1].split('```')[0]
            
            cleaned_response = cleaned_response.strip()
            
            # Parse JSON response
            form_data = json.loads(cleaned_response)
            
            # Validate and ensure proper structure
            validated_schema = validate_form_schema(form_data)
            
            return {
                'success': True,
                'form_schema': validated_schema,
                'raw_response': raw_response,
                'quota_exceeded': False,
                'model_used': model_name
            }
        
        except json.JSONDecodeError as e:
            last_error = f'Failed to parse AI response as JSON: {str(e)}'
            if attempt < max_retries - 1:
                time.sleep(base_delay * (2 ** attempt))
                continue
        
        except requests.exceptions.Timeout:
            last_error = 'Request timeout'
            if attempt < max_retries - 1:
                time.sleep(base_delay * (2 ** attempt))
                continue
        
        except requests.exceptions.RequestException as e:
            last_error = str(e)
            error_message = str(e).lower()
            
            # Check if it's a quota/rate limit error
            if any(keyword in error_message for keyword in ['quota', 'rate limit', '429', 'resource exhausted']):
                return {
                    'success': False,
                    'error': 'AI service quota exceeded. The free tier limit has been reached. Please try again later or upgrade your API plan.',
                    'raw_response': raw_response,
                    'quota_exceeded': True,
                    'details': last_error
                }
            
            # Retry on transient errors
            if attempt < max_retries - 1 and any(keyword in error_message for keyword in ['timeout', 'connection', '503', '500']):
                time.sleep(base_delay * (2 ** attempt))
                continue
        
        except Exception as e:
            last_error = str(e)
            error_message = str(e).lower()
            
            # Check if it's a quota/rate limit error
            if any(keyword in error_message for keyword in ['quota', 'rate limit', '429', 'resource exhausted']):
                return {
                    'success': False,
                    'error': 'AI service quota exceeded. The free tier limit has been reached. Please try again later.',
                    'raw_response': raw_response,
                    'quota_exceeded': True,
                    'details': last_error
                }
            
            # Retry on transient errors
            if attempt < max_retries - 1:
                time.sleep(base_delay * (2 ** attempt))
                continue
    
    # If all retries failed
    return {
        'success': False,
        'error': f'Failed to generate form after {max_retries} attempts. Last error: {last_error}',
        'raw_response': raw_response,
        'quota_exceeded': False
    }


def validate_form_schema(schema):
    """Validate and fix the form schema structure"""
    import re
    
    validated = {
        'fields': [],
        'report_uploads': []
    }
    
    # Validate fields
    if 'fields' in schema and isinstance(schema['fields'], list):
        for field in schema['fields']:
            if not isinstance(field, dict):
                continue
            
            # Ensure required properties
            if 'id' not in field or 'label' not in field or 'type' not in field:
                if 'label' in field and 'id' not in field:
                    # Generate ID from label
                    field_id = re.sub(r'[^a-z0-9_]', '', field['label'].lower().replace(' ', '_'))
                    field['id'] = field_id[:50]
                else:
                    continue
            
            # Set default values
            field.setdefault('required', False)
            field.setdefault('placeholder', '')
            field.setdefault('helpText', '')
            field.setdefault('category', 'medical')
            
            # Validate type
            valid_types = ['text', 'textarea', 'number', 'date', 'select', 'multiselect', 'file']
            if field['type'] not in valid_types:
                field['type'] = 'text'
            
            validated['fields'].append(field)
    
    # Validate report uploads
    if 'report_uploads' in schema and isinstance(schema['report_uploads'], list):
        for upload in schema['report_uploads']:
            if not isinstance(upload, dict):
                continue
            
            # Ensure required properties
            if 'id' not in upload or 'label' not in upload:
                if 'label' in upload and 'id' not in upload:
                    upload_id = re.sub(r'[^a-z0-9_]', '', upload['label'].lower().replace(' ', '_'))
                    upload['id'] = upload_id[:50]
                else:
                    continue
            
            # Set default values
            upload.setdefault('required', False)
            upload.setdefault('description', '')
            upload.setdefault('upload_type', 'medical_report')
            
            validated['report_uploads'].append(upload)
    
    return validated


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_ai_intake_form(request):
    """
    Create a new AI-generated intake form
    Doctor provides workspace_id and doctor_prompt
    """
    if not hasattr(request.user, 'doctor_profile'):
        return Response(
            {'error': 'Only doctors can create intake forms'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    doctor_profile = request.user.doctor_profile
    
    # Validate input
    serializer = AIIntakeFormCreateSerializer(data=request.data, context={'request': request})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    workspace = serializer.validated_data['workspace']
    doctor_prompt = serializer.validated_data['doctor_prompt']
    title = serializer.validated_data.get('title', 'Patient Intake Form')
    description = serializer.validated_data.get('description', '')
    
    # Verify doctor has access to this workspace
    if workspace.doctor != doctor_profile:
        return Response(
            {'error': 'You do not have access to this workspace'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Build patient context for better AI generation
    patient = workspace.patient
    patient_context = {
        'patient_name': patient.full_name,
        'age': patient.date_of_birth.strftime('%Y-%m-%d') if patient.date_of_birth else None,
        'known_conditions': patient.chronic_conditions if patient.chronic_conditions else None,
        'allergies': patient.known_allergies if patient.known_allergies else None,
    }
    
    # Generate form using Gemini API
    result = generate_intake_form_with_gemini(doctor_prompt, patient_context)
    
    if not result['success']:
        # Use 429 status code for quota errors, 500 for other errors
        error_status = status.HTTP_429_TOO_MANY_REQUESTS if result.get('quota_exceeded') else status.HTTP_500_INTERNAL_SERVER_ERROR
        return Response(
            {
                'error': result['error'],
                'raw_response': result.get('raw_response'),
                'quota_exceeded': result.get('quota_exceeded', False),
                'details': result.get('details')
            },
            status=error_status
        )
    
    # Create the intake form
    intake_form = AIIntakeForm.objects.create(
        workspace=workspace,
        doctor=doctor_profile,
        patient=patient,
        title=title,
        description=description,
        doctor_prompt=doctor_prompt,
        form_schema=result['form_schema'],
        ai_raw_response=result['raw_response'],
        status='draft'
    )
    
    # Return the created form
    return Response(
        AIIntakeFormSerializer(intake_form, context={'request': request}).data,
        status=status.HTTP_201_CREATED
    )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_doctor_intake_forms(request):
    """
    List all intake forms created by the doctor
    Optional query params: workspace_id, status
    """
    if not hasattr(request.user, 'doctor_profile'):
        return Response(
            {'error': 'Only doctors can access this endpoint'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    doctor_profile = request.user.doctor_profile
    
    # Base query
    forms = AIIntakeForm.objects.filter(doctor=doctor_profile).select_related(
        'patient', 'workspace'
    ).prefetch_related('uploads', 'response')
    
    # Filter by workspace if provided
    workspace_id = request.query_params.get('workspace_id')
    if workspace_id:
        forms = forms.filter(workspace_id=workspace_id)
    
    # Filter by status if provided
    form_status = request.query_params.get('status')
    if form_status:
        forms = forms.filter(status=form_status)
    
    # Order by most recent first
    forms = forms.order_by('-created_at')
    
    # Serialize and return
    serializer = DoctorIntakeFormListSerializer(forms, many=True)
    return Response({'forms': serializer.data}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_intake_form_detail(request, form_id):
    """
    Get detailed view of an intake form
    """
    if not hasattr(request.user, 'doctor_profile'):
        return Response(
            {'error': 'Only doctors can access this endpoint'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    doctor_profile = request.user.doctor_profile
    
    try:
        form = AIIntakeForm.objects.select_related(
            'patient', 'doctor', 'workspace'
        ).prefetch_related('uploads', 'response').get(id=form_id)
        
        # Verify access
        if form.doctor != doctor_profile:
            return Response(
                {'error': 'You do not have access to this form'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = AIIntakeFormSerializer(form, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    except AIIntakeForm.DoesNotExist:
        return Response(
            {'error': 'Intake form not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['PUT', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def update_intake_form(request, form_id):
    """
    Update intake form (title, description, form_schema)
    Only allowed in draft status
    """
    if not hasattr(request.user, 'doctor_profile'):
        return Response(
            {'error': 'Only doctors can update intake forms'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    doctor_profile = request.user.doctor_profile
    
    try:
        form = AIIntakeForm.objects.get(id=form_id)
        
        # Verify access
        if form.doctor != doctor_profile:
            return Response(
                {'error': 'You do not have access to this form'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Only allow updates in draft status
        if form.status != 'draft':
            return Response(
                {'error': 'Can only update forms in draft status'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update the form
        serializer = AIIntakeFormUpdateSerializer(form, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(
                AIIntakeFormSerializer(form, context={'request': request}).data,
                status=status.HTTP_200_OK
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    except AIIntakeForm.DoesNotExist:
        return Response(
            {'error': 'Intake form not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def send_intake_form_to_patient(request, form_id):
    """
    Send the intake form to the patient
    Changes status from 'draft' to 'sent'
    """
    if not hasattr(request.user, 'doctor_profile'):
        return Response(
            {'error': 'Only doctors can send intake forms'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    doctor_profile = request.user.doctor_profile
    
    try:
        form = AIIntakeForm.objects.get(id=form_id)
        
        # Verify access
        if form.doctor != doctor_profile:
            return Response(
                {'error': 'You do not have access to this form'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Can only send forms in draft status
        if form.status != 'draft':
            return Response(
                {'error': 'Form has already been sent or is not in draft status'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate form has fields
        if not form.form_schema or not form.form_schema.get('fields'):
            return Response(
                {'error': 'Cannot send empty form. Add at least one field.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Send the form
        form.send_to_patient()
        
        # TODO: Create notification for patient
        # This will be implemented in notification system
        
        return Response({
            'message': 'Form sent to patient successfully',
            'form': AIIntakeFormSerializer(form, context={'request': request}).data
        }, status=status.HTTP_200_OK)
    
    except AIIntakeForm.DoesNotExist:
        return Response(
            {'error': 'Intake form not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_intake_form(request, form_id):
    """
    Delete an intake form
    Only allowed if no response exists
    """
    if not hasattr(request.user, 'doctor_profile'):
        return Response(
            {'error': 'Only doctors can delete intake forms'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    doctor_profile = request.user.doctor_profile
    
    try:
        form = AIIntakeForm.objects.get(id=form_id)
        
        # Verify access
        if form.doctor != doctor_profile:
            return Response(
                {'error': 'You do not have access to this form'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Don't allow deletion if patient has responded
        if hasattr(form, 'response') and form.response:
            return Response(
                {'error': 'Cannot delete form that has been responded to'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        form.delete()
        
        return Response(
            {'message': 'Intake form deleted successfully'},
            status=status.HTTP_200_OK
        )
    
    except AIIntakeForm.DoesNotExist:
        return Response(
            {'error': 'Intake form not found'},
            status=status.HTTP_404_NOT_FOUND
        )


# ============================================================================
# MEDICAL REPORT MANAGEMENT - Import from patient views
# ============================================================================
from patient.views import (
    list_medical_reports,
    medical_report_detail,
    add_report_comment
)
