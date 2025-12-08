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
    recorded_date = models.DateField(auto_now_add=True)
    
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
        
        self.save()
