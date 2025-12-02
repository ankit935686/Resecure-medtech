from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from .models import PatientProfile, PatientDoctorConnection
from doctor.models import DoctorProfile


class PatientSignupSerializer(serializers.ModelSerializer):
    """Serializer for patient signup"""
    password = serializers.CharField(write_only=True, min_length=8, style={'input_type': 'password'})
    password_confirm = serializers.CharField(write_only=True, min_length=8, style={'input_type': 'password'})
    email = serializers.EmailField(required=True)
    username = serializers.CharField(required=True)
    
    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password_confirm')
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Passwords don't match."})
        return attrs
    
    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value
    
    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        # create_user automatically hashes the password
        user = User.objects.create_user(password=password, **validated_data)
        
        # Create patient profile
        PatientProfile.objects.create(user=user)
        
        return user


class PatientLoginSerializer(serializers.Serializer):
    """Serializer for patient login"""
    username = serializers.CharField(required=True, allow_blank=False)
    password = serializers.CharField(required=True, allow_blank=False, style={'input_type': 'password'}, write_only=True)
    
    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')
        
        if not username or not password:
            raise serializers.ValidationError({
                'non_field_errors': ["Must include both 'username' and 'password'."]
            })
        
        user = authenticate(username=username, password=password)
        if not user:
            raise serializers.ValidationError({
                'non_field_errors': ["Invalid username or password."]
            })
        
        if not user.is_active:
            raise serializers.ValidationError({
                'non_field_errors': ["User account is disabled."]
            })
        
        # Check if user has a patient profile
        try:
            patient_profile = user.patient_profile
        except PatientProfile.DoesNotExist:
            raise serializers.ValidationError({
                'non_field_errors': ["This account is not associated with a patient profile."]
            })
        
        attrs['user'] = user
        return attrs


class PatientProfileSerializer(serializers.ModelSerializer):
    """Serializer for patient profile"""
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    full_name = serializers.CharField(read_only=True)
    
    class Meta:
        model = PatientProfile
        fields = (
            'id', 'username', 'email', 'first_name', 'last_name', 
            'full_name', 'phone_number', 'date_of_birth', 'blood_group',
            'emergency_contact_name', 'emergency_contact_phone', 'address',
            'bio', 'profile_completed', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at', 'profile_completed')


class PatientProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating patient profile"""
    
    class Meta:
        model = PatientProfile
        fields = (
            'first_name', 'last_name', 'phone_number', 'date_of_birth',
            'blood_group', 'emergency_contact_name', 'emergency_contact_phone',
            'address', 'bio'
        )
    
    def update(self, instance, validated_data):
        # Check if profile is being completed
        required_fields = ['first_name', 'last_name', 'phone_number']
        if all(validated_data.get(field) for field in required_fields):
            instance.profile_completed = True
        
        return super().update(instance, validated_data)


class UserSerializer(serializers.ModelSerializer):
    """Basic user serializer"""
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name')


# ============= PROFILE SETUP STEP SERIALIZERS =============

class ConsentSerializer(serializers.Serializer):
    """Step 0 - Consent serializer"""
    consent_given = serializers.BooleanField(required=True)
    
    def validate_consent_given(self, value):
        if not value:
            raise serializers.ValidationError("You must give consent to proceed.")
        return value


class Step1BasicInfoSerializer(serializers.ModelSerializer):
    """Step 1 - Basic Identity & Contact (Required)"""
    email = serializers.EmailField(source='user.email', read_only=True)
    
    class Meta:
        model = PatientProfile
        fields = (
            'first_name', 'last_name', 'date_of_birth', 
            'gender', 'phone_number', 'email'
        )
    
    def validate(self, attrs):
        # All fields in Step 1 are required
        required_fields = ['first_name', 'last_name', 'date_of_birth', 'phone_number']
        for field in required_fields:
            if not attrs.get(field):
                raise serializers.ValidationError({field: "This field is required for Step 1."})
        return attrs


class Step2HealthSnapshotSerializer(serializers.ModelSerializer):
    """Step 2 - Health Snapshot (Required + short)"""
    
    class Meta:
        model = PatientProfile
        fields = (
            'emergency_contact_name', 'emergency_contact_phone',
            'known_allergies', 'chronic_conditions', 'current_medications',
            'prescription_upload'
        )
    
    def validate(self, attrs):
        # Emergency contact is required
        if not attrs.get('emergency_contact_name') or not attrs.get('emergency_contact_phone'):
            raise serializers.ValidationError({
                'emergency_contact': "Emergency contact name and phone are required."
            })
        return attrs


class Step3PreferencesSerializer(serializers.ModelSerializer):
    """Step 3 - Preferences & Quick Setup (Optional but recommended)"""
    
    class Meta:
        model = PatientProfile
        fields = (
            'preferred_language', 'preferred_contact_method',
            'share_data_for_research', 'note_for_doctors'
        )


class PatientProfileSetupSerializer(serializers.ModelSerializer):
    """Complete profile setup serializer for all steps"""
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    full_name = serializers.CharField(read_only=True)
    is_profile_complete = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = PatientProfile
        fields = (
            'id', 'username', 'email', 'patient_id',
            # Step 0
            'consent_given', 'consent_timestamp',
            # Step 1
            'first_name', 'last_name', 'full_name', 'date_of_birth', 
            'gender', 'phone_number',
            # Step 2
            'emergency_contact_name', 'emergency_contact_phone',
            'known_allergies', 'chronic_conditions', 'current_medications',
            'prescription_upload',
            # Step 3
            'preferred_language', 'preferred_contact_method',
            'share_data_for_research', 'note_for_doctors',
            # Status
            'profile_completed', 'current_step', 'is_profile_complete',
            'created_at', 'updated_at'
        )
        read_only_fields = (
            'id', 'patient_id', 'consent_timestamp', 'profile_completed',
            'created_at', 'updated_at'
        )


# ============= DOCTOR LINKING SERIALIZERS =============

class DoctorSearchSerializer(serializers.ModelSerializer):
    """Serializer for doctor search results"""
    full_name = serializers.CharField(read_only=True)
    is_verified = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = DoctorProfile
        fields = (
            'id', 'doctor_id', 'display_name', 'full_name',
            'first_name', 'last_name', 'specialization',
            'primary_clinic_hospital', 'city', 'country',
            'consultation_mode', 'is_verified', 'profile_status'
        )


class PatientDoctorConnectionSerializer(serializers.ModelSerializer):
    """Serializer for patient-doctor connections"""
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    patient_id = serializers.CharField(source='patient.patient_id', read_only=True)
    doctor_name = serializers.CharField(source='doctor.full_name', read_only=True)
    doctor_id = serializers.CharField(source='doctor.doctor_id', read_only=True)
    doctor_specialization = serializers.CharField(source='doctor.specialization', read_only=True)
    
    class Meta:
        model = PatientDoctorConnection
        fields = (
            'id', 'patient_name', 'patient_id', 'doctor_name', 'doctor_id',
            'doctor_specialization', 'status', 'initiated_by',
            'patient_note', 'doctor_note', 'created_at', 'updated_at', 'accepted_at'
        )
        read_only_fields = ('id', 'initiated_by', 'created_at', 'updated_at', 'accepted_at')


class CreateConnectionRequestSerializer(serializers.Serializer):
    """Serializer for creating a connection request"""
    doctor_id = serializers.CharField(required=False, allow_blank=True)
    doctor_profile_id = serializers.IntegerField(required=False)
    patient_note = serializers.CharField(required=False, allow_blank=True, max_length=500)
    
    def validate(self, attrs):
        # Must provide either doctor_id or doctor_profile_id
        if not attrs.get('doctor_id') and not attrs.get('doctor_profile_id'):
            raise serializers.ValidationError({
                'doctor': "Please provide either doctor_id or doctor_profile_id."
            })
        return attrs

