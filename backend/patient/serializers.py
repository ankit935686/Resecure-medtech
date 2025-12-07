from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from .models import (
    PatientProfile,
    PatientDoctorConnection,
    DoctorPatientWorkspace,
    DoctorPatientTimelineEntry,
)
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


# ============= DOCTOR-PATIENT WORKSPACE SERIALIZERS =============

class DoctorPatientTimelineEntrySerializer(serializers.ModelSerializer):
    """Timeline entries with doctor updates/guidelines"""

    class Meta:
        model = DoctorPatientTimelineEntry
        fields = (
            'id',
            'entry_type',
            'title',
            'summary',
            'details',
            'attachments',
            'follow_up_actions',
            'visibility',
            'created_by',
            'is_critical',
            'highlight_color',
            'meta',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'created_by', 'created_at', 'updated_at')


class DoctorPatientTimelineEntryCreateSerializer(serializers.ModelSerializer):
    """Input serializer for doctors when creating timeline entries"""

    class Meta:
        model = DoctorPatientTimelineEntry
        fields = (
            'entry_type',
            'title',
            'summary',
            'details',
            'attachments',
            'follow_up_actions',
            'visibility',
            'is_critical',
            'highlight_color',
            'meta',
        )


class DoctorPatientWorkspaceSummarySerializer(serializers.ModelSerializer):
    """Lightweight summary for workspace cards."""

    connection_id = serializers.IntegerField(source='connection.id', read_only=True)
    doctor_name = serializers.SerializerMethodField()
    doctor_id = serializers.CharField(source='doctor.doctor_id', read_only=True)
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    patient_id = serializers.CharField(source='patient.patient_id', read_only=True)
    latest_entry = serializers.SerializerMethodField()

    class Meta:
        model = DoctorPatientWorkspace
        fields = (
            'id',
            'connection_id',
            'doctor_name',
            'doctor_id',
            'patient_name',
            'patient_id',
            'title',
            'summary',
            'status',
            'next_review_date',
            'updated_at',
            'latest_entry',
        )

    def get_doctor_name(self, obj):
        return obj.doctor.display_name or obj.doctor.full_name

    def get_latest_entry(self, obj):
        entry = obj.timeline_entries.filter(visibility='patient').first()
        if entry:
            return DoctorPatientTimelineEntrySerializer(entry).data
        return None


class DoctorPatientWorkspaceDetailSerializer(serializers.ModelSerializer):
    """Full workspace serializer with plan + timeline."""

    connection_id = serializers.IntegerField(source='connection.id', read_only=True)
    doctor_profile = serializers.SerializerMethodField()
    patient_profile = serializers.SerializerMethodField()
    timeline_entries = serializers.SerializerMethodField()

    class Meta:
        model = DoctorPatientWorkspace
        fields = (
            'id',
            'connection_id',
            'title',
            'summary',
            'primary_diagnosis',
            'treatment_plan',
            'medication_overview',
            'lifestyle_guidelines',
            'follow_up_instructions',
            'status',
            'next_review_date',
            'doctor_profile',
            'patient_profile',
            'timeline_entries',
            'updated_at',
        )

    def get_doctor_profile(self, obj):
        doctor = obj.doctor
        return {
            'name': doctor.display_name or doctor.full_name,
            'doctor_id': doctor.doctor_id,
            'specialization': doctor.specialization,
            'consultation_mode': doctor.consultation_mode,
            'city': doctor.city,
            'primary_clinic_hospital': doctor.primary_clinic_hospital,
        }

    def get_patient_profile(self, obj):
        patient = obj.patient
        return {
            'name': patient.full_name,
            'patient_id': patient.patient_id,
            'blood_group': patient.blood_group,
            'known_allergies': patient.known_allergies,
            'chronic_conditions': patient.chronic_conditions,
        }

    def get_timeline_entries(self, obj):
        limit = self.context.get('entries_limit')
        include_internal = self.context.get('include_internal_notes', False)
        entries = obj.timeline_entries.all()
        if not include_internal:
            entries = entries.exclude(visibility='internal')
        if limit:
            entries = entries[:limit]
        return DoctorPatientTimelineEntrySerializer(entries, many=True).data


class DoctorPatientWorkspaceUpdateSerializer(serializers.ModelSerializer):
    """Serializer for doctors updating the workspace plan."""

    class Meta:
        model = DoctorPatientWorkspace
        fields = (
            'title',
            'summary',
            'primary_diagnosis',
            'treatment_plan',
            'medication_overview',
            'lifestyle_guidelines',
            'follow_up_instructions',
            'status',
            'next_review_date',
        )


class PatientProfileForDoctorSerializer(serializers.ModelSerializer):
    """Comprehensive patient profile for doctors to view"""
    
    connection_status = serializers.SerializerMethodField()
    age = serializers.SerializerMethodField()
    workspace_id = serializers.SerializerMethodField()
    
    class Meta:
        model = PatientProfile
        fields = (
            'id',
            'patient_id',
            'full_name',
            'first_name',
            'last_name',
            'date_of_birth',
            'age',
            'gender',
            'phone_number',
            'blood_group',
            'known_allergies',
            'chronic_conditions',
            'current_medications',
            'emergency_contact_name',
            'emergency_contact_phone',
            'preferred_language',
            'preferred_contact_method',
            'note_for_doctors',
            'connection_status',
            'workspace_id',
            'created_at',
            'updated_at',
        )
        read_only_fields = fields
    
    def get_age(self, obj):
        if obj.date_of_birth:
            from datetime import date
            today = date.today()
            return today.year - obj.date_of_birth.year - (
                (today.month, today.day) < (obj.date_of_birth.month, obj.date_of_birth.day)
            )
        return None
    
    def get_connection_status(self, obj):
        doctor_profile = self.context.get('doctor_profile')
        if doctor_profile:
            try:
                connection = PatientDoctorConnection.objects.get(
                    patient=obj,
                    doctor=doctor_profile
                )
                return connection.status
            except PatientDoctorConnection.DoesNotExist:
                return 'not_connected'
        return None
    
    def get_workspace_id(self, obj):
        doctor_profile = self.context.get('doctor_profile')
        if doctor_profile:
            try:
                connection = PatientDoctorConnection.objects.get(
                    patient=obj,
                    doctor=doctor_profile,
                    status='accepted'
                )
                workspace = DoctorPatientWorkspace.objects.filter(connection=connection).first()
                return workspace.id if workspace else None
            except PatientDoctorConnection.DoesNotExist:
                return None
        return None


# ===========================
# AI Intake Form Serializers
# ===========================

from .models import AIIntakeForm, IntakeFormResponse, IntakeFormUpload


class IntakeFormUploadSerializer(serializers.ModelSerializer):
    """Serializer for intake form file uploads"""
    file_url = serializers.SerializerMethodField()
    
    class Meta:
        model = IntakeFormUpload
        fields = (
            'id', 'field_id', 'field_label', 'file', 'file_url',
            'file_name', 'file_size', 'file_type', 'upload_type',
            'description', 'uploaded_at', 'ocr_processed', 'ocr_text',
            'ocr_medical_data', 'ocr_confidence'
        )
        read_only_fields = ('id', 'uploaded_at', 'file_name', 'file_size',
                           'ocr_processed', 'ocr_text', 'ocr_medical_data', 'ocr_confidence')
    
    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and hasattr(obj.file, 'url'):
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class IntakeFormResponseSerializer(serializers.ModelSerializer):
    """Serializer for intake form response"""
    
    class Meta:
        model = IntakeFormResponse
        fields = (
            'id', 'response_data', 'is_complete', 'completion_percentage',
            'started_at', 'last_saved_at', 'completed_at'
        )
        read_only_fields = ('id', 'started_at', 'last_saved_at', 'completion_percentage')


class AIIntakeFormSerializer(serializers.ModelSerializer):
    """Base serializer for AI Intake Form"""
    doctor_name = serializers.CharField(source='doctor.display_name', read_only=True)
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    uploads = IntakeFormUploadSerializer(many=True, read_only=True)
    response = IntakeFormResponseSerializer(read_only=True)
    has_response = serializers.SerializerMethodField()
    
    class Meta:
        model = AIIntakeForm
        fields = (
            'id', 'workspace', 'doctor', 'patient', 'doctor_name', 'patient_name',
            'title', 'description', 'doctor_prompt', 'form_schema', 'status',
            'created_at', 'updated_at', 'sent_at', 'submitted_at', 'reviewed_at',
            'ai_summary', 'ai_analysis', 'ocr_processed', 'ocr_results',
            'uploads', 'response', 'has_response'
        )
        read_only_fields = (
            'id', 'doctor', 'patient', 'created_at', 'updated_at',
            'sent_at', 'submitted_at', 'reviewed_at', 'ai_raw_response',
            'ai_analysis', 'ocr_processed', 'ocr_results'
        )
    
    def get_has_response(self, obj):
        return hasattr(obj, 'response') and obj.response is not None


class AIIntakeFormCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating AI Intake Form with doctor prompt"""
    
    class Meta:
        model = AIIntakeForm
        fields = (
            'workspace', 'title', 'description', 'doctor_prompt'
        )
    
    def validate_workspace(self, value):
        """Ensure doctor has access to this workspace"""
        request = self.context.get('request')
        if request and hasattr(request.user, 'doctor_profile'):
            if value.doctor != request.user.doctor_profile:
                raise serializers.ValidationError("You don't have access to this workspace.")
        return value


class AIIntakeFormUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating form schema and metadata by doctor"""
    
    class Meta:
        model = AIIntakeForm
        fields = ('title', 'description', 'form_schema')
    
    def validate(self, attrs):
        # Validate form_schema structure if provided
        form_schema = attrs.get('form_schema')
        if form_schema:
            if not isinstance(form_schema, dict):
                raise serializers.ValidationError({"form_schema": "Must be a valid JSON object."})
            
            fields = form_schema.get('fields', [])
            if not isinstance(fields, list):
                raise serializers.ValidationError({"form_schema": "Fields must be a list."})
            
            # Validate each field has required properties
            for i, field in enumerate(fields):
                if not isinstance(field, dict):
                    raise serializers.ValidationError({
                        "form_schema": f"Field at index {i} must be an object."
                    })
                
                required_keys = ['id', 'label', 'type']
                for key in required_keys:
                    if key not in field:
                        raise serializers.ValidationError({
                            "form_schema": f"Field at index {i} missing required key: {key}"
                        })
        
        return attrs


class IntakeFormResponseCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for patient to create/update their response"""
    
    class Meta:
        model = IntakeFormResponse
        fields = ('response_data', 'is_complete')
    
    def validate_response_data(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Response data must be a valid JSON object.")
        return value
    
    def update(self, instance, validated_data):
        # If marking as complete, set completed_at timestamp
        if validated_data.get('is_complete') and not instance.completed_at:
            from django.utils import timezone
            instance.completed_at = timezone.now()
        
        return super().update(instance, validated_data)


class DoctorIntakeFormListSerializer(serializers.ModelSerializer):
    """Simplified serializer for listing forms (doctor view)"""
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    patient_id = serializers.CharField(source='patient.patient_id', read_only=True)
    has_response = serializers.SerializerMethodField()
    response_status = serializers.SerializerMethodField()
    
    class Meta:
        model = AIIntakeForm
        fields = (
            'id', 'title', 'patient_name', 'patient_id', 'status',
            'created_at', 'sent_at', 'submitted_at', 'has_response', 'response_status'
        )
    
    def get_has_response(self, obj):
        return hasattr(obj, 'response') and obj.response is not None
    
    def get_response_status(self, obj):
        if hasattr(obj, 'response') and obj.response:
            return {
                'is_complete': obj.response.is_complete,
                'completion_percentage': obj.response.completion_percentage,
                'last_saved_at': obj.response.last_saved_at
            }
        return None


class PatientIntakeFormListSerializer(serializers.ModelSerializer):
    """Simplified serializer for listing forms (patient view)"""
    doctor_name = serializers.CharField(source='doctor.display_name', read_only=True)
    doctor_specialization = serializers.CharField(source='doctor.specialization', read_only=True)
    has_started = serializers.SerializerMethodField()
    completion_percentage = serializers.SerializerMethodField()
    workspace_id = serializers.IntegerField(source='workspace.id', read_only=True, allow_null=True)
    connection_id = serializers.SerializerMethodField()
    
    class Meta:
        model = AIIntakeForm
        fields = (
            'id', 'title', 'description', 'doctor_name', 'doctor_specialization',
            'status', 'sent_at', 'has_started', 'completion_percentage',
            'workspace_id', 'connection_id'
        )
    
    def get_has_started(self, obj):
        return hasattr(obj, 'response') and obj.response is not None
    
    def get_completion_percentage(self, obj):
        if hasattr(obj, 'response') and obj.response:
            return obj.response.completion_percentage
        return 0
    
    def get_connection_id(self, obj):
        if obj.workspace:
            return obj.workspace.connection_id
        return None

