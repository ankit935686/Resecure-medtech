from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth import login
from django.contrib.auth.models import User
from django.views.decorators.csrf import ensure_csrf_cookie
from django.db.models import Q
from datetime import datetime
from .models import (
    PatientProfile,
    PatientDoctorConnection,
    ConnectionToken,
    DoctorPatientWorkspace,
)
from doctor.models import DoctorProfile
from django.utils import timezone
from .serializers import (
    PatientSignupSerializer,
    PatientLoginSerializer,
    PatientProfileSerializer,
    PatientProfileUpdateSerializer,
    UserSerializer,
    # Profile Setup Serializers
    ConsentSerializer,
    Step1BasicInfoSerializer,
    Step2HealthSnapshotSerializer,
    Step3PreferencesSerializer,
    PatientProfileSetupSerializer,
    # Doctor Linking Serializers
    DoctorSearchSerializer,
    PatientDoctorConnectionSerializer,
    CreateConnectionRequestSerializer,
    # Workspace Serializers
    DoctorPatientWorkspaceSummarySerializer,
    DoctorPatientWorkspaceDetailSerializer,
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


# ============= PROFILE SETUP WIZARD VIEWS =============

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def submit_consent(request):
    """Step 0 - Submit consent"""
    profile = request.user.patient_profile
    serializer = ConsentSerializer(data=request.data)
    
    if serializer.is_valid():
        profile.consent_given = True
        profile.consent_timestamp = datetime.now()
        profile.current_step = 1
        profile.save()
        
        return Response({
            'message': 'Consent recorded successfully',
            'profile': PatientProfileSetupSerializer(profile).data,
            'next_step': 1
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def submit_step1_basic_info(request):
    """Step 1 - Submit basic identity and contact info"""
    profile = request.user.patient_profile
    
    if not profile.consent_given:
        return Response({
            'error': 'Please complete consent step first'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    serializer = Step1BasicInfoSerializer(profile, data=request.data, partial=False)
    
    if serializer.is_valid():
        serializer.save()
        profile.current_step = 2
        profile.save()
        
        return Response({
            'message': 'Step 1 completed successfully',
            'profile': PatientProfileSetupSerializer(profile).data,
            'next_step': 2
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def submit_step2_health_snapshot(request):
    """Step 2 - Submit health snapshot"""
    profile = request.user.patient_profile
    
    if profile.current_step < 1:
        return Response({
            'error': 'Please complete previous steps first'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    serializer = Step2HealthSnapshotSerializer(profile, data=request.data, partial=False)
    
    if serializer.is_valid():
        serializer.save()
        profile.current_step = 3
        profile.save()
        
        return Response({
            'message': 'Step 2 completed successfully',
            'profile': PatientProfileSetupSerializer(profile).data,
            'next_step': 3
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def submit_step3_preferences(request):
    """Step 3 - Submit preferences (optional)"""
    profile = request.user.patient_profile
    
    if profile.current_step < 2:
        return Response({
            'error': 'Please complete previous steps first'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    serializer = Step3PreferencesSerializer(profile, data=request.data, partial=True)
    
    if serializer.is_valid():
        serializer.save()
        
        # Check if profile is complete
        if profile.is_profile_complete:
            profile.profile_completed = True
        
        profile.current_step = 3
        profile.save()
        
        return Response({
            'message': 'Step 3 completed successfully',
            'profile': PatientProfileSetupSerializer(profile).data,
            'profile_completed': profile.profile_completed,
            'patient_id': profile.patient_id
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def finish_profile_setup(request):
    """Finish profile setup and mark as complete"""
    profile = request.user.patient_profile
    
    if not profile.is_profile_complete:
        return Response({
            'error': 'Please complete all required fields',
            'required_fields': {
                'first_name': bool(profile.first_name),
                'last_name': bool(profile.last_name),
                'date_of_birth': bool(profile.date_of_birth),
                'phone_number': bool(profile.phone_number),
                'emergency_contact_name': bool(profile.emergency_contact_name),
                'emergency_contact_phone': bool(profile.emergency_contact_phone),
                'consent_given': profile.consent_given
            }
        }, status=status.HTTP_400_BAD_REQUEST)
    
    profile.profile_completed = True
    profile.save()
    
    return Response({
        'message': 'Profile setup completed successfully',
        'profile': PatientProfileSetupSerializer(profile).data,
        'patient_id': profile.patient_id,
        'redirect_to': 'dashboard'
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_profile_setup_status(request):
    """Get current profile setup status"""
    profile = request.user.patient_profile
    
    return Response({
        'profile': PatientProfileSetupSerializer(profile).data,
        'current_step': profile.current_step,
        'profile_completed': profile.profile_completed,
        'is_profile_complete': profile.is_profile_complete,
        'patient_id': profile.patient_id
    }, status=status.HTTP_200_OK)


# ============= DOCTOR LINKING VIEWS =============

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def search_doctors(request):
    """Search for doctors by name, specialty, city, or doctor ID"""
    query = request.GET.get('q', '').strip()
    specialty = request.GET.get('specialty', '').strip()
    city = request.GET.get('city', '').strip()
    doctor_id = request.GET.get('doctor_id', '').strip()
    
    # Start with verified doctors only
    doctors = DoctorProfile.objects.filter(profile_status='verified')
    
    if doctor_id:
        # Search by doctor ID (exact match)
        doctors = doctors.filter(doctor_id=doctor_id)
    else:
        # Search by other criteria
        if query:
            doctors = doctors.filter(
                Q(first_name__icontains=query) |
                Q(last_name__icontains=query) |
                Q(display_name__icontains=query) |
                Q(specialization__icontains=query)
            )
        
        if specialty:
            doctors = doctors.filter(specialization__icontains=specialty)
        
        if city:
            doctors = doctors.filter(city__icontains=city)
    
    # Limit results
    doctors = doctors[:20]
    
    serializer = DoctorSearchSerializer(doctors, many=True)
    
    return Response({
        'count': len(serializer.data),
        'doctors': serializer.data
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_connection_request(request):
    """Create a connection request to a doctor"""
    patient_profile = request.user.patient_profile
    
    serializer = CreateConnectionRequestSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    doctor_id = serializer.validated_data.get('doctor_id')
    doctor_profile_id = serializer.validated_data.get('doctor_profile_id')
    patient_note = serializer.validated_data.get('patient_note', '')
    
    # Find the doctor
    try:
        if doctor_id:
            doctor_profile = DoctorProfile.objects.get(doctor_id=doctor_id)
        else:
            doctor_profile = DoctorProfile.objects.get(id=doctor_profile_id)
    except DoctorProfile.DoesNotExist:
        return Response({
            'error': 'Doctor not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Check if doctor is verified
    if not doctor_profile.is_verified:
        return Response({
            'error': 'Cannot connect with unverified doctors'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Check if connection already exists
    existing_connection = PatientDoctorConnection.objects.filter(
        patient=patient_profile,
        doctor=doctor_profile
    ).first()
    
    if existing_connection:
        if existing_connection.status == 'accepted':
            return Response({
                'error': 'You are already connected with this doctor'
            }, status=status.HTTP_400_BAD_REQUEST)
        elif existing_connection.status == 'pending':
            return Response({
                'error': 'Connection request already pending'
            }, status=status.HTTP_400_BAD_REQUEST)
        elif existing_connection.status == 'rejected':
            # Allow re-request after rejection
            existing_connection.status = 'pending'
            existing_connection.patient_note = patient_note
            existing_connection.save()
            
            return Response({
                'message': 'Connection request sent successfully',
                'connection': PatientDoctorConnectionSerializer(existing_connection).data
            }, status=status.HTTP_200_OK)
    
    # Create new connection request
    connection = PatientDoctorConnection.objects.create(
        patient=patient_profile,
        doctor=doctor_profile,
        status='pending',
        initiated_by='patient',
        patient_note=patient_note
    )
    
    return Response({
        'message': 'Connection request sent successfully',
        'connection': PatientDoctorConnectionSerializer(connection).data
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_my_connections(request):
    """Get all connections for the current patient"""
    patient_profile = request.user.patient_profile
    
    connections = PatientDoctorConnection.objects.filter(
        patient=patient_profile
    ).select_related('doctor', 'doctor__user')
    
    serializer = PatientDoctorConnectionSerializer(connections, many=True)
    
    return Response({
        'count': len(serializer.data),
        'connections': serializer.data
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_connected_doctors(request):
    """Get only accepted/connected doctors"""
    patient_profile = request.user.patient_profile
    
    connections = PatientDoctorConnection.objects.filter(
        patient=patient_profile,
        status='accepted'
    ).select_related('doctor', 'doctor__user')
    
    serializer = PatientDoctorConnectionSerializer(connections, many=True)
    
    return Response({
        'count': len(serializer.data),
        'doctors': serializer.data
    }, status=status.HTTP_200_OK)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def remove_connection(request, connection_id):
    """Remove a connection with a doctor"""
    patient_profile = request.user.patient_profile
    
    try:
        connection = PatientDoctorConnection.objects.get(
            id=connection_id,
            patient=patient_profile
        )
    except PatientDoctorConnection.DoesNotExist:
        return Response({
            'error': 'Connection not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    connection.remove_connection()
    
    return Response({
        'message': 'Connection removed successfully'
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def accept_connection_request(request, connection_id):
    """Accept a doctor's connection request"""
    patient_profile = request.user.patient_profile
    
    try:
        connection = PatientDoctorConnection.objects.get(
            id=connection_id,
            patient=patient_profile,
            status='pending'
        )
    except PatientDoctorConnection.DoesNotExist:
        return Response({
            'error': 'Connection request not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Accept the connection
    patient_note = request.data.get('note', '')
    connection.status = 'accepted'
    connection.accepted_at = timezone.now()
    if patient_note:
        connection.patient_note = patient_note
    connection.save()
    
    return Response({
        'message': 'Connection accepted successfully',
        'connection': PatientDoctorConnectionSerializer(connection).data
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def reject_connection_request(request, connection_id):
    """Reject a doctor's connection request"""
    patient_profile = request.user.patient_profile
    
    try:
        connection = PatientDoctorConnection.objects.get(
            id=connection_id,
            patient=patient_profile,
            status='pending'
        )
    except PatientDoctorConnection.DoesNotExist:
        return Response({
            'error': 'Connection request not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Reject the connection
    patient_note = request.data.get('note', '')
    connection.status = 'rejected'
    if patient_note:
        connection.patient_note = patient_note
    connection.save()
    
    return Response({
        'message': 'Connection rejected',
        'connection': PatientDoctorConnectionSerializer(connection).data
    }, status=status.HTTP_200_OK)


# ============= DOCTOR WORKSPACES (PATIENT VIEW) =============

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_patient_workspaces(request):
    """List all doctor-specific workspaces for the patient"""
    patient_profile = request.user.patient_profile

    connections = PatientDoctorConnection.objects.filter(
        patient=patient_profile,
        status='accepted'
    ).select_related('doctor', 'patient')

    if not connections.exists():
        return Response({'count': 0, 'workspaces': []}, status=status.HTTP_200_OK)

    connection_ids = []
    for connection in connections:
        workspace = DoctorPatientWorkspace.ensure_for_connection(connection)
        workspace.sync_metadata()
        connection_ids.append(connection.id)

    workspaces = DoctorPatientWorkspace.objects.filter(
        connection_id__in=connection_ids
    ).select_related('doctor', 'patient', 'connection').prefetch_related('timeline_entries')

    serializer = DoctorPatientWorkspaceSummarySerializer(workspaces, many=True)
    return Response({'count': len(serializer.data), 'workspaces': serializer.data}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_patient_workspace_detail(request, connection_id):
    """Detailed workspace view for a specific doctor"""
    patient_profile = request.user.patient_profile

    try:
        connection = PatientDoctorConnection.objects.select_related('doctor', 'patient').get(
            id=connection_id,
            patient=patient_profile,
            status='accepted'
        )
    except PatientDoctorConnection.DoesNotExist:
        return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)

    workspace = DoctorPatientWorkspace.ensure_for_connection(connection)
    workspace.sync_metadata()

    limit = request.GET.get('limit')
    try:
        limit = int(limit) if limit else None
    except ValueError:
        limit = None

    serializer = DoctorPatientWorkspaceDetailSerializer(
        workspace,
        context={'entries_limit': limit}
    )
    return Response(serializer.data, status=status.HTTP_200_OK)


# ============= QR CODE SCANNING =============

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def validate_qr_token(request, token):
    """Validate a QR code token before scanning"""
    try:
        qr_token = ConnectionToken.objects.select_related('doctor').get(token=token)
    except ConnectionToken.DoesNotExist:
        return Response({
            'error': 'Invalid QR code',
            'valid': False
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Check if token is valid
    if not qr_token.is_valid:
        reason = 'expired' if qr_token.is_expired else 'already_used'
        return Response({
            'error': f'QR code is {reason}',
            'valid': False,
            'is_expired': qr_token.is_expired,
            'is_used': qr_token.is_used
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Return doctor info for preview
    doctor = qr_token.doctor
    return Response({
        'valid': True,
        'doctor': {
            'name': doctor.display_name or doctor.full_name,
            'specialization': doctor.specialization,
            'clinic': doctor.primary_clinic_hospital,
            'city': doctor.city,
            'consultation_mode': doctor.consultation_mode
        },
        'expires_at': qr_token.expires_at,
        'time_remaining': (qr_token.expires_at - timezone.now()).total_seconds() / 3600  # in hours
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def scan_qr_code(request, token):
    """Scan QR code and create instant connection with doctor"""
    patient_profile = request.user.patient_profile
    
    # Check if patient profile is complete
    if not patient_profile.is_profile_complete:
        return Response({
            'error': 'Please complete your profile before connecting with doctors',
            'redirect_to': 'profile_setup'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Get the token
    try:
        qr_token = ConnectionToken.objects.select_related('doctor').get(token=token)
    except ConnectionToken.DoesNotExist:
        return Response({
            'error': 'Invalid QR code'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Check if token is valid
    if not qr_token.is_valid:
        reason = 'expired' if qr_token.is_expired else 'already used'
        return Response({
            'error': f'QR code is {reason}'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    doctor = qr_token.doctor
    
    # Check if connection already exists
    existing_connection = PatientDoctorConnection.objects.filter(
        patient=patient_profile,
        doctor=doctor
    ).first()
    
    if existing_connection:
        if existing_connection.status == 'accepted':
            return Response({
                'error': 'You are already connected with this doctor',
                'connection_exists': True
            }, status=status.HTTP_400_BAD_REQUEST)
        elif existing_connection.status == 'pending':
            # Auto-accept if it's a pending request
            existing_connection.status = 'accepted'
            existing_connection.accepted_at = timezone.now()
            existing_connection.connection_type = 'qr_code'
            existing_connection.qr_token = qr_token
            existing_connection.save()
            
            # Mark token as used
            qr_token.mark_as_used(patient_profile)
            
            return Response({
                'message': 'Connection accepted successfully via QR code',
                'connection': PatientDoctorConnectionSerializer(existing_connection).data,
                'doctor': {
                    'name': doctor.display_name or doctor.full_name,
                    'doctor_id': doctor.doctor_id,
                    'specialization': doctor.specialization
                }
            }, status=status.HTTP_200_OK)
        elif existing_connection.status in ['rejected', 'removed']:
            # Update rejected/removed connection to accepted via QR code
            existing_connection.status = 'accepted'
            existing_connection.accepted_at = timezone.now()
            existing_connection.connection_type = 'qr_code'
            existing_connection.qr_token = qr_token
            existing_connection.doctor_note = 'Reconnected via QR code'
            existing_connection.save()
            
            # Mark token as used
            qr_token.mark_as_used(patient_profile)
            
            return Response({
                'message': 'Connection re-established successfully via QR code',
                'connection': PatientDoctorConnectionSerializer(existing_connection).data,
                'doctor': {
                    'name': doctor.display_name or doctor.full_name,
                    'doctor_id': doctor.doctor_id,
                    'specialization': doctor.specialization
                }
            }, status=status.HTTP_200_OK)
    
    # Create new instant connection (auto-accepted for QR scans)
    connection = PatientDoctorConnection.objects.create(
        patient=patient_profile,
        doctor=doctor,
        status='accepted',  # Auto-accept for QR code connections
        accepted_at=timezone.now(),
        initiated_by='patient',
        connection_type='qr_code',
        qr_token=qr_token,
        patient_note='Connected via QR code'
    )
    
    # Mark token as used
    qr_token.mark_as_used(patient_profile)
    
    return Response({
        'message': 'Successfully connected with doctor via QR code',
        'connection': PatientDoctorConnectionSerializer(connection).data,
        'doctor': {
            'name': doctor.display_name or doctor.full_name,
            'doctor_id': doctor.doctor_id,
            'specialization': doctor.specialization,
            'clinic': doctor.primary_clinic_hospital,
            'city': doctor.city
        }
    }, status=status.HTTP_201_CREATED)
