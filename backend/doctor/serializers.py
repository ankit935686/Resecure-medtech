from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from .models import DoctorProfile


class DoctorSignupSerializer(serializers.ModelSerializer):
    """Serializer for doctor signup"""
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
        
        # Create doctor profile
        DoctorProfile.objects.create(user=user)
        
        return user


class DoctorLoginSerializer(serializers.Serializer):
    """Serializer for doctor login"""
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
        
        # Check if user has a doctor profile
        try:
            doctor_profile = user.doctor_profile
        except DoctorProfile.DoesNotExist:
            raise serializers.ValidationError({
                'non_field_errors': ["This account is not associated with a doctor profile."]
            })
        
        attrs['user'] = user
        return attrs


class DoctorProfileSerializer(serializers.ModelSerializer):
    """Serializer for doctor profile"""
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    full_name = serializers.CharField(read_only=True)
    is_verified = serializers.BooleanField(read_only=True)
    is_pending = serializers.BooleanField(read_only=True)
    can_access_dashboard = serializers.BooleanField(read_only=True)
    license_document_url = serializers.SerializerMethodField()
    
    class Meta:
        model = DoctorProfile
        fields = (
            'id', 'username', 'email', 'first_name', 'last_name', 
            'full_name', 'display_name', 'phone_number', 'specialization', 
            'license_number', 'doctor_id', 'primary_clinic_hospital',
            'city', 'country', 'bio', 'consultation_mode',
            'professional_email', 'license_document', 'license_document_url',
            'profile_status', 'profile_completed', 'current_step',
            'consent_given', 'is_verified', 'is_pending', 'can_access_dashboard',
            'rejection_reason', 'submitted_at', 'verified_at',
            'created_at', 'updated_at',
            # Legacy fields
            'years_of_experience', 'hospital_affiliation'
        )
        read_only_fields = (
            'id', 'doctor_id', 'profile_status', 'profile_completed', 
            'verified_at', 'submitted_at', 'created_at', 'updated_at',
            'rejection_reason', 'is_verified', 'is_pending', 'can_access_dashboard'
        )
    
    def get_license_document_url(self, obj):
        if obj.license_document:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.license_document.url)
        return None


class DoctorProfileStep0Serializer(serializers.ModelSerializer):
    """Step 0: Consent"""
    class Meta:
        model = DoctorProfile
        fields = ('consent_given',)
    
    def validate_consent_given(self, value):
        if not value:
            raise serializers.ValidationError("Consent must be given to proceed.")
        return value
    
    def update(self, instance, validated_data):
        from django.utils import timezone
        if validated_data.get('consent_given'):
            instance.consent_timestamp = timezone.now()
            instance.current_step = 1
        return super().update(instance, validated_data)


class DoctorProfileStep1Serializer(serializers.ModelSerializer):
    """Step 1: Basic Professional Info"""
    class Meta:
        model = DoctorProfile
        fields = (
            'first_name', 'last_name', 'display_name',
            'specialization', 'primary_clinic_hospital',
            'city', 'country'
        )
    
    def validate(self, attrs):
        required_fields = ['first_name', 'last_name', 'specialization', 'primary_clinic_hospital', 'city', 'country']
        for field in required_fields:
            if not attrs.get(field):
                raise serializers.ValidationError({field: f"{field.replace('_', ' ').title()} is required."})
        return attrs
    
    def update(self, instance, validated_data):
        instance.current_step = 2
        return super().update(instance, validated_data)


class DoctorProfileStep2Serializer(serializers.ModelSerializer):
    """Step 2: Credentials & Doctor ID"""
    class Meta:
        model = DoctorProfile
        fields = ('license_number', 'license_document', 'doctor_id')
        read_only_fields = ('doctor_id',)
    
    def validate_license_number(self, value):
        if value:
            instance = self.instance
            if DoctorProfile.objects.filter(license_number=value).exclude(id=instance.id).exists():
                raise serializers.ValidationError("A doctor with this license number already exists.")
        else:
            raise serializers.ValidationError("License number is required.")
        return value
    
    def validate_license_document(self, value):
        if not value:
            raise serializers.ValidationError("License document is required.")
        
        # Validate file size (max 10MB) but allow any document type while building features
        if value.size > 10 * 1024 * 1024:
            raise serializers.ValidationError("File size must be less than 10MB.")
        
        return value
    
    def update(self, instance, validated_data):
        instance.current_step = 3
        # Doctor ID is auto-generated in model save
        return super().update(instance, validated_data)


class DoctorProfileStep3Serializer(serializers.ModelSerializer):
    """Step 3: Contact & Bio"""
    class Meta:
        model = DoctorProfile
        fields = ('phone_number', 'professional_email', 'bio', 'consultation_mode')
    
    def validate_phone_number(self, value):
        if not value:
            raise serializers.ValidationError("Phone number is required.")
        return value
    
    def validate_bio(self, value):
        if value and len(value) > 280:
            raise serializers.ValidationError("Bio must be less than 280 characters.")
        return value
    
    def update(self, instance, validated_data):
        instance.current_step = 4
        return super().update(instance, validated_data)


class DoctorProfileSubmitSerializer(serializers.ModelSerializer):
    """Step 4: Review & Submit"""
    class Meta:
        model = DoctorProfile
        fields = ('profile_status',)
        read_only_fields = ('profile_status',)
    
    def validate(self, attrs):
        instance = self.instance
        # Check all required fields are completed
        required_checks = [
            (instance.consent_given, "Consent not given"),
            (instance.first_name, "First name missing"),
            (instance.last_name, "Last name missing"),
            (instance.specialization, "Specialization missing"),
            (instance.primary_clinic_hospital, "Clinic/Hospital missing"),
            (instance.city, "City missing"),
            (instance.country, "Country missing"),
            (instance.license_number, "License number missing"),
            (instance.license_document, "License document missing"),
            (instance.phone_number, "Phone number missing"),
        ]
        
        for check, error_msg in required_checks:
            if not check:
                raise serializers.ValidationError(error_msg)
        
        return attrs


class DoctorProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating doctor profile (general updates)"""
    
    class Meta:
        model = DoctorProfile
        fields = (
            'first_name', 'last_name', 'display_name', 'phone_number', 
            'specialization', 'license_number', 'primary_clinic_hospital',
            'city', 'country', 'bio', 'consultation_mode',
            'professional_email', 'years_of_experience', 'hospital_affiliation'
        )
    
    def validate_license_number(self, value):
        if value:
            instance = self.instance
            if DoctorProfile.objects.filter(license_number=value).exclude(id=instance.id).exists():
                raise serializers.ValidationError("A doctor with this license number already exists.")
        return value
    
    def validate_bio(self, value):
        if value and len(value) > 280:
            raise serializers.ValidationError("Bio must be less than 280 characters.")
        return value


# Admin Serializers
class DoctorVerificationSerializer(serializers.ModelSerializer):
    """Admin serializer for verifying doctor profiles"""
    action = serializers.ChoiceField(choices=['verify', 'reject'], write_only=True)
    rejection_reason = serializers.CharField(required=False, allow_blank=True)
    
    class Meta:
        model = DoctorProfile
        fields = ('action', 'rejection_reason', 'profile_status', 'verified_at')
        read_only_fields = ('profile_status', 'verified_at')


class UserSerializer(serializers.ModelSerializer):
    """Basic user serializer"""
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name')

