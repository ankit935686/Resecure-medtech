from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth import login
from django.contrib.auth.models import User
from django.views.decorators.csrf import ensure_csrf_cookie
from .models import AdminProfile
from .serializers import (
    AdminSignupSerializer,
    AdminLoginSerializer,
    AdminProfileSerializer,
    AdminProfileUpdateSerializer,
    UserSerializer
)


@ensure_csrf_cookie
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def admin_signup(request):
    """Admin signup endpoint"""
    print(f"Admin signup request data: {request.data}")  # Debug logging
    serializer = AdminSignupSerializer(data=request.data)
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
            
            # Get admin profile
            admin_profile = authenticated_user.admin_profile
            
            return Response({
                'message': 'Admin account created successfully',
                'user': UserSerializer(authenticated_user).data,
                'profile': AdminProfileSerializer(admin_profile).data,
                'profile_completed': admin_profile.profile_completed,
                'redirect_to': 'dashboard'  # Admin always redirects to dashboard
            }, status=status.HTTP_201_CREATED)
        else:
            return Response({'error': 'Failed to authenticate user'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    print(f"Admin signup validation errors: {serializer.errors}")  # Debug logging
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@ensure_csrf_cookie
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def admin_login(request):
    """Admin login endpoint"""
    print(f"Admin login request data: {request.data}")  # Debug logging
    serializer = AdminLoginSerializer(data=request.data)
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
            
            # Get admin profile
            admin_profile = authenticated_user.admin_profile
            
            return Response({
                'message': 'Login successful',
                'user': UserSerializer(authenticated_user).data,
                'profile': AdminProfileSerializer(admin_profile).data,
                'profile_completed': admin_profile.profile_completed,
                'redirect_to': 'dashboard'  # Admin always redirects to dashboard
            }, status=status.HTTP_200_OK)
        else:
            return Response({'error': 'Authentication failed'}, status=status.HTTP_401_UNAUTHORIZED)
    
    print(f"Admin login validation errors: {serializer.errors}")  # Debug logging
    # Return detailed error information
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def admin_logout(request):
    """Admin logout endpoint"""
    from django.contrib.auth import logout
    logout(request)
    return Response({'message': 'Logout successful'}, status=status.HTTP_200_OK)


class AdminProfileView(generics.RetrieveAPIView):
    """Get admin profile"""
    serializer_class = AdminProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user.admin_profile


class AdminProfileUpdateView(generics.UpdateAPIView):
    """Update admin profile"""
    serializer_class = AdminProfileUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user.admin_profile
    
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial, context={'request': request})
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        # Return updated profile
        updated_profile = AdminProfileSerializer(instance)
        return Response({
            'message': 'Profile updated successfully',
            'profile': updated_profile.data,
            'profile_completed': instance.profile_completed,
            'redirect_to': 'dashboard'  # Admin always redirects to dashboard
        }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def admin_current_user(request):
    """Get current authenticated admin user"""
    user = request.user
    admin_profile = user.admin_profile
    
    return Response({
        'user': UserSerializer(user).data,
        'profile': AdminProfileSerializer(admin_profile).data,
        'profile_completed': admin_profile.profile_completed,
        'redirect_to': 'dashboard'  # Admin always redirects to dashboard
    }, status=status.HTTP_200_OK)


# ==================== DOCTOR VERIFICATION (ADMIN ONLY) ====================

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def pending_doctors_list(request):
    """Get list of doctors pending verification (Admin only)"""
    # Check if user is admin
    try:
        request.user.admin_profile
    except:
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    
    from doctor.models import DoctorProfile
    from doctor.serializers import DoctorProfileSerializer
    
    pending_doctors = DoctorProfile.objects.filter(profile_status='pending').order_by('-submitted_at')
    serializer = DoctorProfileSerializer(pending_doctors, many=True, context={'request': request})
    
    return Response({
        'count': pending_doctors.count(),
        'doctors': serializer.data
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def verify_doctor(request, doctor_id):
    """Verify a doctor profile (Admin only)"""
    # Check if user is admin
    try:
        request.user.admin_profile
    except:
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    
    from doctor.models import DoctorProfile
    from doctor.serializers import DoctorProfileSerializer
    
    try:
        doctor_profile = DoctorProfile.objects.get(id=doctor_id)
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if doctor_profile.profile_status != 'pending':
        return Response({'error': 'Only pending profiles can be verified'}, status=status.HTTP_400_BAD_REQUEST)
    
    doctor_profile.verify_profile(request.user)
    
    return Response({
        'message': 'Doctor verified successfully',
        'profile': DoctorProfileSerializer(doctor_profile, context={'request': request}).data
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def reject_doctor(request, doctor_id):
    """Reject a doctor profile (Admin only)"""
    # Check if user is admin
    try:
        request.user.admin_profile
    except:
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    
    from doctor.models import DoctorProfile
    from doctor.serializers import DoctorProfileSerializer
    
    try:
        doctor_profile = DoctorProfile.objects.get(id=doctor_id)
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if doctor_profile.profile_status != 'pending':
        return Response({'error': 'Only pending profiles can be rejected'}, status=status.HTTP_400_BAD_REQUEST)
    
    reason = request.data.get('reason', 'No reason provided')
    doctor_profile.reject_profile(request.user, reason)
    
    return Response({
        'message': 'Doctor profile rejected',
        'profile': DoctorProfileSerializer(doctor_profile, context={'request': request}).data
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def all_doctors_list(request):
    """Get list of all doctors with filters (Admin only)"""
    # Check if user is admin
    try:
        request.user.admin_profile
    except:
        return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
    
    from doctor.models import DoctorProfile
    from doctor.serializers import DoctorProfileSerializer
    
    status_filter = request.query_params.get('status', None)
    
    doctors = DoctorProfile.objects.all().order_by('-created_at')
    
    if status_filter:
        doctors = doctors.filter(profile_status=status_filter)
    
    serializer = DoctorProfileSerializer(doctors, many=True, context={'request': request})
    
    return Response({
        'count': doctors.count(),
        'doctors': serializer.data
    }, status=status.HTTP_200_OK)
