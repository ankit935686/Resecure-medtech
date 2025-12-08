from rest_framework import serializers
from .models import MedicalHistoryEntry, MedicalHistoryTimeline, MedicalHistorySummary
from patient.models import DoctorPatientWorkspace, PatientProfile
from doctor.models import DoctorProfile
from django.contrib.auth.models import User


class MedicalHistoryEntrySerializer(serializers.ModelSerializer):
    """Serializer for medical history entries"""
    
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    added_by_name = serializers.SerializerMethodField()
    duration_text = serializers.CharField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = MedicalHistoryEntry
        fields = [
            'id', 'workspace', 'patient', 'patient_name', 'category', 'category_display',
            'source', 'source_display', 'title', 'description', 'status', 'status_display',
            'start_date', 'end_date', 'recorded_date', 'source_reference_id', 
            'source_reference_type', 'severity', 'severity_display', 'is_chronic',
            'requires_monitoring', 'is_critical', 'category_data', 'added_by',
            'added_by_name', 'verified_by_doctor', 'verified_at', 'doctor_notes',
            'tags', 'duration_text', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'recorded_date', 'created_at', 'updated_at']
    
    def get_added_by_name(self, obj):
        if obj.added_by:
            try:
                doctor = DoctorProfile.objects.get(user=obj.added_by)
                return f"Dr. {doctor.full_name}"
            except DoctorProfile.DoesNotExist:
                try:
                    patient = PatientProfile.objects.get(user=obj.added_by)
                    return patient.full_name
                except PatientProfile.DoesNotExist:
                    return obj.added_by.get_full_name() or obj.added_by.username
        return "System"


class MedicalHistoryTimelineSerializer(serializers.ModelSerializer):
    """Serializer for timeline events"""
    
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)
    performed_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = MedicalHistoryTimeline
        fields = [
            'id', 'history_entry', 'event_type', 'event_type_display',
            'event_description', 'event_data', 'performed_by', 'performed_by_name',
            'performed_by_type', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_performed_by_name(self, obj):
        if obj.performed_by:
            try:
                doctor = DoctorProfile.objects.get(user=obj.performed_by)
                return f"Dr. {doctor.full_name}"
            except DoctorProfile.DoesNotExist:
                try:
                    patient = PatientProfile.objects.get(user=obj.performed_by)
                    return patient.full_name
                except PatientProfile.DoesNotExist:
                    return obj.performed_by.get_full_name() or obj.performed_by.username
        return "System"


class MedicalHistorySummarySerializer(serializers.ModelSerializer):
    """Serializer for medical history summary"""
    
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    
    class Meta:
        model = MedicalHistorySummary
        fields = [
            'id', 'workspace', 'patient', 'patient_name', 'total_conditions',
            'active_conditions', 'total_medications', 'current_medications',
            'total_allergies', 'total_surgeries', 'total_visits', 'total_lab_results',
            'has_chronic_conditions', 'has_critical_allergies', 'requires_monitoring',
            'last_visit_date', 'active_conditions_list', 'current_medications_list',
            'all_allergies_list', 'recent_labs_list', 'completeness_score',
            'last_updated'
        ]
        read_only_fields = ['id', 'last_updated']


class DoctorAddHistorySerializer(serializers.Serializer):
    """Serializer for doctor adding new history entry"""
    
    workspace_id = serializers.IntegerField()
    category = serializers.ChoiceField(choices=MedicalHistoryEntry.CATEGORY_CHOICES)
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(
        choices=MedicalHistoryEntry.STATUS_CHOICES,
        default='active'
    )
    start_date = serializers.DateField(required=False, allow_null=True)
    end_date = serializers.DateField(required=False, allow_null=True)
    severity = serializers.ChoiceField(
        choices=MedicalHistoryEntry.SEVERITY_CHOICES,
        required=False,
        allow_null=True
    )
    is_chronic = serializers.BooleanField(default=False)
    requires_monitoring = serializers.BooleanField(default=False)
    is_critical = serializers.BooleanField(default=False)
    category_data = serializers.JSONField(required=False, default=dict)
    doctor_notes = serializers.CharField(required=False, allow_blank=True)
    tags = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list
    )
    
    def validate_workspace_id(self, value):
        if not DoctorPatientWorkspace.objects.filter(id=value).exists():
            raise serializers.ValidationError("Invalid workspace ID")
        return value
    
    def validate(self, data):
        if data.get('end_date') and data.get('start_date'):
            if data['end_date'] < data['start_date']:
                raise serializers.ValidationError("End date cannot be before start date")
        return data


class BulkHistoryImportSerializer(serializers.Serializer):
    """Serializer for bulk importing history from intake forms or OCR"""
    
    workspace_id = serializers.IntegerField()
    source = serializers.ChoiceField(choices=['INTAKE', 'OCR', 'MANUAL'])
    source_reference_id = serializers.CharField(required=False, allow_blank=True)
    source_reference_type = serializers.CharField(required=False, allow_blank=True)
    entries = serializers.ListField(
        child=serializers.DictField(),
        min_length=1
    )
    
    def validate_workspace_id(self, value):
        if not DoctorPatientWorkspace.objects.filter(id=value).exists():
            raise serializers.ValidationError("Invalid workspace ID")
        return value
    
    def validate_entries(self, value):
        """Validate each entry has required fields"""
        required_fields = ['category', 'title']
        for entry in value:
            for field in required_fields:
                if field not in entry:
                    raise serializers.ValidationError(
                        f"Each entry must have '{field}' field"
                    )
            if entry['category'] not in dict(MedicalHistoryEntry.CATEGORY_CHOICES):
                raise serializers.ValidationError(
                    f"Invalid category: {entry['category']}"
                )
        return value


# ==================== NEW SERIALIZERS FOR ENHANCED FEATURES ====================

class ClinicalTrendSerializer(serializers.Serializer):
    """Serializer for clinical trend data"""
    from .models import ClinicalTrend
    
    id = serializers.IntegerField(read_only=True)
    workspace = serializers.PrimaryKeyRelatedField(read_only=True)
    patient = serializers.PrimaryKeyRelatedField(read_only=True)
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    
    trend_type = serializers.ChoiceField(choices=ClinicalTrend.TREND_TYPE_CHOICES)
    parameter_name = serializers.CharField(max_length=100)
    parameter_unit = serializers.CharField(max_length=20, required=False, allow_blank=True)
    
    data_points = serializers.JSONField()
    reference_range_min = serializers.FloatField(required=False, allow_null=True)
    reference_range_max = serializers.FloatField(required=False, allow_null=True)
    reference_range_text = serializers.CharField(required=False, allow_blank=True)
    
    trend_direction = serializers.CharField(read_only=True)
    latest_value = serializers.CharField(read_only=True)
    latest_value_date = serializers.DateField(read_only=True)
    is_currently_abnormal = serializers.BooleanField(read_only=True)
    
    ai_interpretation = serializers.CharField(read_only=True)
    clinical_significance = serializers.CharField(read_only=True)
    last_analyzed = serializers.DateTimeField(read_only=True)
    
    class Meta:
        fields = '__all__'


class UnifiedTimelineItemSerializer(serializers.Serializer):
    """Serializer for unified timeline items (merges all data sources)"""
    
    id = serializers.CharField()
    date = serializers.DateField()
    type = serializers.ChoiceField(
        choices=[
            ('intake', 'AI Intake Form'),
            ('report', 'Medical Report'),
            ('visit', 'Doctor Visit'),
            ('lab_result', 'Lab Result'),
            ('condition', 'Medical Condition'),
            ('medication', 'Medication'),
            ('allergy', 'Allergy'),
            ('surgery', 'Surgery'),
        ]
    )
    icon = serializers.CharField()
    title = serializers.CharField()
    summary = serializers.CharField()
    source = serializers.CharField()
    source_type = serializers.CharField()
    is_abnormal = serializers.BooleanField(default=False)
    is_critical = serializers.BooleanField(default=False)
    entry_id = serializers.IntegerField(required=False, allow_null=True)
    detail_link = serializers.CharField(required=False, allow_blank=True)
    metadata = serializers.JSONField(default=dict)


class ClinicalSummarySerializer(serializers.Serializer):
    """Serializer for AI-generated clinical summary"""
    
    generated_at = serializers.DateTimeField()
    patient_name = serializers.CharField()
    patient_age = serializers.IntegerField(required=False, allow_null=True)
    patient_gender = serializers.CharField(required=False)
    
    # Overview
    clinical_summary = serializers.CharField()
    
    # Active conditions
    active_conditions = serializers.ListField(
        child=serializers.DictField()
    )
    active_conditions_count = serializers.IntegerField()
    
    # Medications
    current_medications = serializers.ListField(
        child=serializers.DictField()
    )
    medications_count = serializers.IntegerField()
    
    # Allergies
    allergies = serializers.ListField(
        child=serializers.DictField()
    )
    allergies_count = serializers.IntegerField()
    
    # Risk assessment
    risk_assessment = serializers.JSONField()
    
    # Trends
    trends_detected = serializers.ListField(
        child=serializers.DictField()
    )
    
    # Focus points
    focus_points = serializers.ListField(
        child=serializers.CharField()
    )
    
    # Statistics
    stats = serializers.DictField()


class EnhancedMedicalHistorySummarySerializer(serializers.ModelSerializer):
    """Enhanced serializer for medical history summary with AI fields"""
    
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    patient_age = serializers.SerializerMethodField()
    patient_gender = serializers.CharField(source='patient.gender', read_only=True)
    
    class Meta:
        from .models import MedicalHistorySummary
        model = MedicalHistorySummary
        fields = [
            'id', 'workspace', 'patient', 'patient_name', 'patient_age', 'patient_gender',
            'total_conditions', 'active_conditions', 'total_medications', 'current_medications',
            'total_allergies', 'total_surgeries', 'total_visits', 'total_lab_results',
            'has_chronic_conditions', 'has_critical_allergies', 'requires_monitoring',
            'last_visit_date', 'active_conditions_list', 'current_medications_list',
            'all_allergies_list', 'recent_labs_list', 'completeness_score',
            'ai_clinical_summary', 'ai_risk_assessment', 'ai_trends_detected',
            'ai_focus_points', 'ai_last_generated', 'unverified_entries_count',
            'critical_alerts_count', 'last_updated'
        ]
        read_only_fields = ['id', 'last_updated', 'ai_last_generated']
    
    def get_patient_age(self, obj):
        if obj.patient.date_of_birth:
            from datetime import date
            today = date.today()
            age = today.year - obj.patient.date_of_birth.year - (
                (today.month, today.day) < (obj.patient.date_of_birth.month, obj.patient.date_of_birth.day)
            )
            return age
        return None


class CategoryHistorySerializer(serializers.Serializer):
    """Serializer for category-specific history view"""
    
    category = serializers.CharField()
    category_display = serializers.CharField()
    total_count = serializers.IntegerField()
    active_count = serializers.IntegerField()
    entries = MedicalHistoryEntrySerializer(many=True)


class TrendAnalysisSerializer(serializers.Serializer):
    """Serializer for trend analysis response"""
    
    parameter_name = serializers.CharField()
    parameter_unit = serializers.CharField(required=False)
    data_points = serializers.ListField(child=serializers.DictField())
    trend_direction = serializers.CharField()
    latest_value = serializers.CharField()
    latest_date = serializers.DateField()
    is_abnormal = serializers.BooleanField()
    reference_range = serializers.CharField(required=False)
    ai_interpretation = serializers.CharField(required=False)
    clinical_significance = serializers.CharField(required=False)
    chart_data = serializers.DictField(required=False)
