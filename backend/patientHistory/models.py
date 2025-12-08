from django.db import models
from django.contrib.auth.models import User
from patient.models import PatientProfile, DoctorPatientWorkspace
from doctor.models import DoctorProfile


class MedicalHistoryEntry(models.Model):
    """
    Unified medical history entry that aggregates data from multiple sources
    Categories: condition, medication, allergy, surgery, visit, lab_result
    Sources: INTAKE (AI form), OCR (report analysis), DOCTOR (manual entry), MANUAL (patient entry)
    """
    
    CATEGORY_CHOICES = [
        ('condition', 'Medical Condition'),
        ('medication', 'Medication'),
        ('allergy', 'Allergy'),
        ('surgery', 'Surgery/Procedure'),
        ('visit', 'Doctor Visit'),
        ('lab_result', 'Lab Result'),
    ]
    
    SOURCE_CHOICES = [
        ('INTAKE', 'AI Intake Form'),
        ('OCR', 'OCR Report Analysis'),
        ('DOCTOR', 'Doctor Manual Entry'),
        ('MANUAL', 'Patient Manual Entry'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('resolved', 'Resolved'),
        ('historical', 'Historical'),
        ('inactive', 'Inactive'),
    ]
    
    SEVERITY_CHOICES = [
        ('mild', 'Mild'),
        ('moderate', 'Moderate'),
        ('severe', 'Severe'),
        ('critical', 'Critical'),
    ]
    
    # Core fields
    workspace = models.ForeignKey(
        DoctorPatientWorkspace,
        on_delete=models.CASCADE,
        related_name='medical_history_entries'
    )
    patient = models.ForeignKey(
        PatientProfile,
        on_delete=models.CASCADE,
        related_name='medical_history'
    )
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    source = models.CharField(max_length=10, choices=SOURCE_CHOICES)
    
    # Common fields for all categories
    title = models.CharField(max_length=255, help_text='Main title/name of the entry')
    description = models.TextField(blank=True, help_text='Detailed description')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    
    # Date fields
    start_date = models.DateField(null=True, blank=True, help_text='When it started/was diagnosed')
    end_date = models.DateField(null=True, blank=True, help_text='When it ended/was resolved')
    recorded_date = models.DateField(auto_now_add=True, null=True, blank=True)
    
    # Source tracking
    source_reference_id = models.CharField(
        max_length=100,
        blank=True,
        help_text='ID of source record (intake form ID, report ID, etc.)'
    )
    source_reference_type = models.CharField(
        max_length=50,
        blank=True,
        help_text='Type of source (AIIntakeForm, MedicalReport, etc.)'
    )
    
    # Clinical metadata
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, blank=True, null=True)
    is_chronic = models.BooleanField(default=False)
    requires_monitoring = models.BooleanField(default=False)
    is_critical = models.BooleanField(default=False)
    
    # Category-specific data (stored as JSON)
    category_data = models.JSONField(
        default=dict,
        blank=True,
        help_text='Category-specific structured data'
    )
    
    # Trending & Intelligence (NEW)
    trending_direction = models.CharField(
        max_length=20,
        choices=[
            ('improving', 'Improving'),
            ('worsening', 'Worsening'),
            ('stable', 'Stable'),
            ('unknown', 'Unknown')
        ],
        default='unknown',
        blank=True,
        help_text='Trend analysis for trackable parameters'
    )
    last_value = models.CharField(
        max_length=100,
        blank=True,
        help_text='Most recent value (for lab results/vitals)'
    )
    ai_analysis = models.JSONField(
        default=dict,
        blank=True,
        help_text='AI-generated insights for this specific entry'
    )
    
    # Metadata
    added_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='added_history_entries'
    )
    verified_by_doctor = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)
    
    # Notes and attachments
    doctor_notes = models.TextField(blank=True)
    tags = models.JSONField(default=list, blank=True, help_text='Array of tags for filtering')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-recorded_date', '-created_at']
        verbose_name = 'Medical History Entry'
        verbose_name_plural = 'Medical History Entries'
        indexes = [
            models.Index(fields=['patient', 'category']),
            models.Index(fields=['workspace', 'category']),
            models.Index(fields=['source']),
            models.Index(fields=['status']),
            models.Index(fields=['-recorded_date']),
        ]
    
    def __str__(self):
        return f"{self.patient.full_name} - {self.get_category_display()}: {self.title}"
    
    @property
    def is_active(self):
        return self.status == 'active'
    
    @property
    def duration_text(self):
        """Return duration as human-readable text"""
        if self.start_date and self.end_date:
            days = (self.end_date - self.start_date).days
            if days < 30:
                return f"{days} days"
            elif days < 365:
                return f"{days // 30} months"
            else:
                return f"{days // 365} years"
        elif self.start_date:
            from datetime import date
            days = (date.today() - self.start_date).days
            if days < 30:
                return f"{days} days (ongoing)"
            elif days < 365:
                return f"{days // 30} months (ongoing)"
            else:
                return f"{days // 365} years (ongoing)"
        return "Duration unknown"


class MedicalHistoryTimeline(models.Model):
    """
    Timeline events for tracking changes and updates to medical history
    """
    
    EVENT_TYPE_CHOICES = [
        ('added', 'Entry Added'),
        ('updated', 'Entry Updated'),
        ('verified', 'Verified by Doctor'),
        ('resolved', 'Marked as Resolved'),
        ('flagged', 'Flagged for Review'),
    ]
    
    history_entry = models.ForeignKey(
        MedicalHistoryEntry,
        on_delete=models.CASCADE,
        related_name='timeline_events'
    )
    event_type = models.CharField(max_length=20, choices=EVENT_TYPE_CHOICES)
    event_description = models.TextField()
    event_data = models.JSONField(default=dict, blank=True, help_text='Additional event metadata')
    
    performed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='history_timeline_events'
    )
    performed_by_type = models.CharField(
        max_length=20,
        choices=[('doctor', 'Doctor'), ('patient', 'Patient'), ('system', 'System')],
        default='system'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Medical History Timeline Event'
        verbose_name_plural = 'Medical History Timeline Events'
    
    def __str__(self):
        return f"{self.get_event_type_display()} - {self.history_entry.title}"


class MedicalHistorySummary(models.Model):
    """
    Cached summary of patient's medical history for quick dashboard views
    Automatically updated when history entries change
    """
    
    workspace = models.OneToOneField(
        DoctorPatientWorkspace,
        on_delete=models.CASCADE,
        related_name='medical_history_summary'
    )
    patient = models.OneToOneField(
        PatientProfile,
        on_delete=models.CASCADE,
        related_name='medical_history_summary'
    )
    
    # Counts by category
    total_conditions = models.IntegerField(default=0)
    active_conditions = models.IntegerField(default=0)
    total_medications = models.IntegerField(default=0)
    current_medications = models.IntegerField(default=0)
    total_allergies = models.IntegerField(default=0)
    total_surgeries = models.IntegerField(default=0)
    total_visits = models.IntegerField(default=0)
    total_lab_results = models.IntegerField(default=0)
    
    # Risk indicators
    has_chronic_conditions = models.BooleanField(default=False)
    has_critical_allergies = models.BooleanField(default=False)
    requires_monitoring = models.BooleanField(default=False)
    last_visit_date = models.DateField(null=True, blank=True)
    
    # Summary data
    active_conditions_list = models.JSONField(default=list, blank=True)
    current_medications_list = models.JSONField(default=list, blank=True)
    all_allergies_list = models.JSONField(default=list, blank=True)
    recent_labs_list = models.JSONField(default=list, blank=True)
    
    # Completeness score
    completeness_score = models.IntegerField(
        default=0,
        help_text='Percentage of expected history fields filled (0-100)'
    )
    
    # AI-Generated Clinical Intelligence (NEW)
    ai_clinical_summary = models.TextField(
        blank=True,
        help_text='Groq AI-generated comprehensive clinical summary'
    )
    ai_risk_assessment = models.JSONField(
        default=dict,
        blank=True,
        help_text='AI-identified risk factors with severity levels'
    )
    ai_trends_detected = models.JSONField(
        default=list,
        blank=True,
        help_text='List of trends detected by AI (improving/worsening parameters)'
    )
    ai_focus_points = models.JSONField(
        default=list,
        blank=True,
        help_text='AI-suggested focus points for doctor attention'
    )
    ai_last_generated = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When AI summary was last generated'
    )
    
    # Quick Stats Enhancement (NEW)
    unverified_entries_count = models.IntegerField(
        default=0,
        help_text='Count of entries not yet verified by doctor'
    )
    critical_alerts_count = models.IntegerField(
        default=0,
        help_text='Count of critical items requiring attention'
    )
    
    # Timestamps
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Medical History Summary'
        verbose_name_plural = 'Medical History Summaries'
    
    def __str__(self):
        return f"Medical History Summary - {self.patient.full_name}"
    
    def refresh_summary(self):
        """Recalculate and update summary statistics"""
        entries = self.workspace.medical_history_entries.all()
        
        self.total_conditions = entries.filter(category='condition').count()
        self.active_conditions = entries.filter(category='condition', status='active').count()
        self.total_medications = entries.filter(category='medication').count()
        self.current_medications = entries.filter(category='medication', status='active').count()
        self.total_allergies = entries.filter(category='allergy').count()
        self.total_surgeries = entries.filter(category='surgery').count()
        self.total_visits = entries.filter(category='visit').count()
        self.total_lab_results = entries.filter(category='lab_result').count()
        
        # Risk indicators
        self.has_chronic_conditions = entries.filter(is_chronic=True, status='active').exists()
        self.has_critical_allergies = entries.filter(category='allergy', is_critical=True).exists()
        self.requires_monitoring = entries.filter(requires_monitoring=True, status='active').exists()
        
        # Get last visit date
        last_visit = entries.filter(category='visit').order_by('-start_date').first()
        self.last_visit_date = last_visit.start_date if last_visit else None
        
        # Active conditions list
        active_conditions = entries.filter(category='condition', status='active').values_list('title', flat=True)[:10]
        self.active_conditions_list = list(active_conditions)
        
        # Current medications list
        current_meds = entries.filter(category='medication', status='active').values_list('title', flat=True)[:10]
        self.current_medications_list = list(current_meds)
        
        # All allergies list
        allergies = entries.filter(category='allergy').values_list('title', flat=True)[:20]
        self.all_allergies_list = list(allergies)
        
        # Recent labs (last 30 days)
        from datetime import date, timedelta
        recent_date = date.today() - timedelta(days=30)
        recent_labs = entries.filter(
            category='lab_result',
            start_date__gte=recent_date
        ).values('title', 'start_date', 'category_data')[:5]
        self.recent_labs_list = list(recent_labs)
        
        # Calculate completeness score
        expected_fields = 6  # categories we expect data for
        filled_fields = sum([
            self.total_conditions > 0,
            self.total_medications > 0,
            self.total_allergies > 0,
            self.total_surgeries > 0,
            self.total_visits > 0,
            self.total_lab_results > 0,
        ])
        self.completeness_score = int((filled_fields / expected_fields) * 100)
        
        # Update unverified and critical counts
        self.unverified_entries_count = entries.filter(verified_by_doctor=False).count()
        self.critical_alerts_count = entries.filter(is_critical=True, status='active').count()
        
        self.save()
    
    def generate_ai_summary(self):
        """Generate AI clinical summary using Groq API"""
        from .ai_service import PatientHistoryAIService
        from django.utils import timezone
        
        ai_service = PatientHistoryAIService(self.workspace)
        result = ai_service.generate_clinical_summary()
        
        if result:
            self.ai_clinical_summary = result.get('clinical_summary', '')
            self.ai_risk_assessment = result.get('risk_assessment', {})
            self.ai_trends_detected = result.get('trends_detected', [])
            self.ai_focus_points = result.get('focus_points', [])
            self.ai_last_generated = timezone.now()
            self.save()
        
        return result
    
    def get_lab_trends(self, test_name):
        """Get trending data for specific lab test"""
        entries = self.workspace.medical_history_entries.filter(
            category='lab_result',
            title__icontains=test_name
        ).order_by('start_date')
        
        data_points = []
        for entry in entries:
            if entry.last_value:
                data_points.append({
                    'date': entry.start_date.isoformat() if entry.start_date else None,
                    'value': entry.last_value,
                    'unit': entry.category_data.get('unit', ''),
                    'is_abnormal': entry.category_data.get('is_abnormal', False)
                })
        
        return data_points


class ClinicalTrend(models.Model):
    """Track trends for specific medical parameters over time (lab values, vitals, etc.)"""
    
    TREND_TYPE_CHOICES = [
        ('lab_value', 'Lab Value'),
        ('vital_sign', 'Vital Sign'),
        ('symptom_severity', 'Symptom Severity'),
        ('medication_response', 'Medication Response'),
    ]
    
    TREND_DIRECTION_CHOICES = [
        ('improving', 'Improving'),
        ('worsening', 'Worsening'),
        ('stable', 'Stable'),
        ('fluctuating', 'Fluctuating'),
        ('unknown', 'Unknown'),
    ]
    
    workspace = models.ForeignKey(
        DoctorPatientWorkspace,
        on_delete=models.CASCADE,
        related_name='clinical_trends'
    )
    patient = models.ForeignKey(
        PatientProfile,
        on_delete=models.CASCADE,
        related_name='clinical_trends'
    )
    
    # What we're tracking
    trend_type = models.CharField(
        max_length=50,
        choices=TREND_TYPE_CHOICES,
        help_text='Type of parameter being tracked'
    )
    parameter_name = models.CharField(
        max_length=100,
        help_text='Name of parameter (e.g., HbA1c, Blood Pressure, Glucose)'
    )
    parameter_unit = models.CharField(
        max_length=20,
        blank=True,
        help_text='Unit of measurement (e.g., %, mg/dL, mmHg)'
    )
    
    # Time series data
    data_points = models.JSONField(
        default=list,
        help_text='Array of {date, value, is_abnormal, source} objects'
    )
    
    # Reference range
    reference_range_min = models.FloatField(null=True, blank=True)
    reference_range_max = models.FloatField(null=True, blank=True)
    reference_range_text = models.CharField(
        max_length=100,
        blank=True,
        help_text='Text representation of reference range'
    )
    
    # Analysis
    trend_direction = models.CharField(
        max_length=20,
        choices=TREND_DIRECTION_CHOICES,
        default='unknown'
    )
    latest_value = models.CharField(max_length=100, blank=True)
    latest_value_date = models.DateField(null=True, blank=True)
    is_currently_abnormal = models.BooleanField(default=False)
    
    ai_interpretation = models.TextField(
        blank=True,
        help_text='AI-generated interpretation of the trend'
    )
    clinical_significance = models.TextField(
        blank=True,
        help_text='Clinical significance of this trend'
    )
    
    # Metadata
    last_analyzed = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Linked history entries
    related_entries = models.ManyToManyField(
        MedicalHistoryEntry,
        blank=True,
        related_name='trends'
    )
    
    class Meta:
        ordering = ['-last_analyzed']
        verbose_name = 'Clinical Trend'
        verbose_name_plural = 'Clinical Trends'
        unique_together = ['workspace', 'parameter_name']
        indexes = [
            models.Index(fields=['workspace', 'parameter_name']),
            models.Index(fields=['patient', 'trend_type']),
        ]
    
    def __str__(self):
        return f"{self.patient.full_name} - {self.parameter_name} Trend"
    
    def add_data_point(self, date, value, is_abnormal=False, source=''):
        """Add a new data point to the trend"""
        new_point = {
            'date': date.isoformat() if hasattr(date, 'isoformat') else str(date),
            'value': str(value),
            'is_abnormal': is_abnormal,
            'source': source
        }
        
        # Check if data point already exists for this date
        existing_dates = [point.get('date') for point in self.data_points]
        if new_point['date'] not in existing_dates:
            self.data_points.append(new_point)
            self.data_points.sort(key=lambda x: x['date'])
            
            # Update latest value
            self.latest_value = str(value)
            self.latest_value_date = date if hasattr(date, 'isoformat') else None
            self.is_currently_abnormal = is_abnormal
            
            self.save()
    
    def analyze_trend(self):
        """Analyze the trend direction based on data points"""
        if len(self.data_points) < 2:
            self.trend_direction = 'unknown'
            self.save()
            return
        
        # Get numeric values (if possible)
        try:
            values = [float(point['value']) for point in self.data_points if point.get('value')]
            
            if len(values) < 2:
                self.trend_direction = 'unknown'
            else:
                # Simple linear trend detection
                first_half_avg = sum(values[:len(values)//2]) / (len(values)//2)
                second_half_avg = sum(values[len(values)//2:]) / (len(values) - len(values)//2)
                
                diff_percentage = ((second_half_avg - first_half_avg) / first_half_avg) * 100
                
                # For lab values, determine if increasing is good or bad
                # (This is simplified - in production, you'd have parameter-specific logic)
                if abs(diff_percentage) < 5:
                    self.trend_direction = 'stable'
                elif diff_percentage > 10:
                    # Increasing - check if it's moving away from or toward normal
                    if self.is_currently_abnormal:
                        self.trend_direction = 'worsening'
                    else:
                        self.trend_direction = 'improving'
                elif diff_percentage < -10:
                    # Decreasing
                    if self.is_currently_abnormal:
                        self.trend_direction = 'improving'
                    else:
                        self.trend_direction = 'worsening'
                else:
                    self.trend_direction = 'fluctuating'
                    
        except (ValueError, TypeError, ZeroDivisionError):
            self.trend_direction = 'unknown'
        
        self.save()
    
    def generate_ai_interpretation(self):
        """Generate AI interpretation of this trend using Groq"""
        from .ai_service import PatientHistoryAIService
        
        ai_service = PatientHistoryAIService(self.workspace)
        interpretation = ai_service.analyze_parameter_trend(
            parameter_name=self.parameter_name,
            data_points=self.data_points,
            reference_range=self.reference_range_text,
            current_abnormal=self.is_currently_abnormal
        )
        
        if interpretation:
            self.ai_interpretation = interpretation.get('interpretation', '')
            self.clinical_significance = interpretation.get('clinical_significance', '')
            self.save()
        
        return interpretation
