from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
import datetime
import secrets
import hashlib


class PatientProfile(models.Model):
    """Extended profile for patients with 3-step setup wizard"""
    
    GENDER_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
        ('prefer_not_to_say', 'Prefer not to say'),
    ]
    
    CONTACT_METHOD_CHOICES = [
        ('phone', 'Phone'),
        ('sms', 'SMS'),
        ('email', 'Email'),
        ('app_notification', 'App Notification'),
    ]
    
    LANGUAGE_CHOICES = [
        ('en', 'English'),
        ('hi', 'Hindi'),
        ('es', 'Spanish'),
        ('fr', 'French'),
        ('de', 'German'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='patient_profile')
    
    # Step 0 - Consent
    consent_given = models.BooleanField(default=False)
    consent_timestamp = models.DateTimeField(null=True, blank=True)
    
    # Step 1 - Basic Identity & Contact (Required)
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, choices=GENDER_CHOICES, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    
    # Step 2 - Health Snapshot (Required + short)
    emergency_contact_name = models.CharField(max_length=200, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    known_allergies = models.TextField(blank=True, help_text="Comma-separated list of allergies")
    chronic_conditions = models.TextField(blank=True, help_text="Comma-separated list of chronic conditions")
    current_medications = models.TextField(blank=True, help_text="Current medications")
    prescription_upload = models.FileField(upload_to='patient_prescriptions/', null=True, blank=True, help_text="Upload prescription (max 10MB)")
    
    # Step 3 - Preferences & Quick Setup (Optional)
    preferred_language = models.CharField(max_length=10, choices=LANGUAGE_CHOICES, default='en')
    preferred_contact_method = models.CharField(max_length=20, choices=CONTACT_METHOD_CHOICES, default='email')
    share_data_for_research = models.BooleanField(default=False)
    note_for_doctors = models.CharField(max_length=140, blank=True, help_text="What should your doctor know first?")
    
    # Patient ID - Auto-generated
    patient_id = models.CharField(max_length=20, unique=True, null=True, blank=True, editable=False, help_text="Format: PT-YYYY-XXXXX")
    
    # Legacy fields (keeping for backward compatibility)
    blood_group = models.CharField(max_length=10, blank=True)
    address = models.TextField(blank=True)
    bio = models.TextField(blank=True)
    
    # Profile Completion Status
    profile_completed = models.BooleanField(default=False)
    current_step = models.IntegerField(default=0, help_text="Current step in profile setup (0-3)")
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Patient Profile"
        verbose_name_plural = "Patient Profiles"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.full_name} - {self.patient_id or 'No ID'}"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.user.username
    
    def generate_patient_id(self):
        """Generate unique patient ID in format PT-YYYY-XXXXX"""
        if not self.patient_id:
            year = datetime.datetime.now().year
            # Get the last patient ID created this year
            last_patient = PatientProfile.objects.filter(
                patient_id__startswith=f'PT-{year}-'
            ).order_by('-patient_id').first()
            
            if last_patient and last_patient.patient_id:
                last_number = int(last_patient.patient_id.split('-')[-1])
                new_number = last_number + 1
            else:
                new_number = 1
            
            self.patient_id = f'PT-{year}-{new_number:05d}'
        return self.patient_id
    
    def save(self, *args, **kwargs):
        # Auto-generate patient ID if not present
        if not self.patient_id:
            self.generate_patient_id()
        
        super().save(*args, **kwargs)
    
    @property
    def is_profile_complete(self):
        """Check if minimum required fields are filled"""
        required_fields = [
            self.first_name,
            self.last_name,
            self.date_of_birth,
            self.phone_number,
            self.emergency_contact_name,
            self.emergency_contact_phone,
            self.consent_given
        ]
        return all(required_fields)


class ConnectionToken(models.Model):
    """Model to manage QR code tokens for doctor-patient connections"""
    
    # Generate secure token
    token = models.CharField(max_length=64, unique=True, editable=False)
    
    # Doctor who generated this token
    doctor = models.ForeignKey('doctor.DoctorProfile', on_delete=models.CASCADE, related_name='connection_tokens')
    
    # Token validity
    expires_at = models.DateTimeField(help_text="Token expiration timestamp")
    is_used = models.BooleanField(default=False, help_text="Whether token has been used")
    
    # Connection details (filled when token is used)
    used_by_patient = models.ForeignKey(PatientProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='used_tokens')
    used_at = models.DateTimeField(null=True, blank=True, help_text="When token was used")
    
    # Token metadata
    created_at = models.DateTimeField(auto_now_add=True)
    max_uses = models.IntegerField(default=1, help_text="Maximum number of times token can be used")
    use_count = models.IntegerField(default=0, help_text="Number of times token has been used")
    
    class Meta:
        verbose_name = "Connection Token"
        verbose_name_plural = "Connection Tokens"
        ordering = ['-created_at']
    
    def __str__(self):
        status = "Used" if self.is_used else ("Expired" if self.is_expired else "Active")
        return f"Token for Dr. {self.doctor.display_name or self.doctor.full_name} - {status}"
    
    @classmethod
    def generate_token(cls):
        """Generate a secure random token"""
        random_string = secrets.token_urlsafe(32)
        return hashlib.sha256(random_string.encode()).hexdigest()
    
    @property
    def is_expired(self):
        """Check if token has expired"""
        from django.utils import timezone
        return timezone.now() > self.expires_at
    
    @property
    def is_valid(self):
        """Check if token is valid (not expired, not used, under max uses)"""
        return not self.is_expired and self.use_count < self.max_uses
    
    def mark_as_used(self, patient):
        """Mark token as used by a patient"""
        from django.utils import timezone
        self.use_count += 1
        if self.use_count >= self.max_uses:
            self.is_used = True
        self.used_by_patient = patient
        self.used_at = timezone.now()
        self.save()
    
    def save(self, *args, **kwargs):
        # Generate token if not present
        if not self.token:
            self.token = self.generate_token()
        super().save(*args, **kwargs)


class PatientDoctorConnection(models.Model):
    """Model to manage patient-doctor connections/linking"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('removed', 'Removed'),
    ]
    
    CONNECTION_TYPE_CHOICES = [
        ('request', 'Connection Request'),
        ('qr_code', 'QR Code Scan'),
    ]
    
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name='doctor_connections')
    doctor = models.ForeignKey('doctor.DoctorProfile', on_delete=models.CASCADE, related_name='patient_connections')
    
    # Connection status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Connection type and initiator
    connection_type = models.CharField(max_length=20, choices=CONNECTION_TYPE_CHOICES, default='request', help_text="How the connection was initiated")
    initiated_by = models.CharField(max_length=10, choices=[('patient', 'Patient'), ('doctor', 'Doctor')], default='patient')
    
    # QR code token reference (if connection was via QR)
    qr_token = models.ForeignKey(ConnectionToken, on_delete=models.SET_NULL, null=True, blank=True, related_name='connections')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    
    # Notes
    patient_note = models.TextField(blank=True, help_text="Patient's note when requesting connection")
    doctor_note = models.TextField(blank=True, help_text="Doctor's note when accepting/rejecting")
    
    class Meta:
        verbose_name = "Patient-Doctor Connection"
        verbose_name_plural = "Patient-Doctor Connections"
        unique_together = ['patient', 'doctor']
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.patient.full_name} <-> {self.doctor.full_name} ({self.status})"
    
    def accept_connection(self, note=''):
        """Accept the connection request"""
        self.status = 'accepted'
        self.accepted_at = datetime.datetime.now()
        self.doctor_note = note
        self.save()
    
    def reject_connection(self, note=''):
        """Reject the connection request"""
        self.status = 'rejected'
        self.doctor_note = note
        self.save()
    
    def remove_connection(self):
        """Remove the connection"""
        self.status = 'removed'
        self.save()


@receiver(post_save, sender=User)
def create_patient_profile(sender, instance, created, **kwargs):
    """Create patient profile when a user is created (if they're a patient)"""
    # This will be handled manually in the signup view
    pass
