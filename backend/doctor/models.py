from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
import datetime


class DoctorProfile(models.Model):
    """Extended profile for doctors with 4-step verification workflow"""
    
    # Verification Status Choices
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending', 'Pending Verification'),
        ('verified', 'Verified'),
        ('rejected', 'Rejected'),
    ]
    
    CONSULTATION_CHOICES = [
        ('teleconsultation', 'Teleconsultation'),
        ('in_person', 'In-Person'),
        ('both', 'Both'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='doctor_profile')
    
    # Step 0 - Consent
    consent_given = models.BooleanField(default=False)
    consent_timestamp = models.DateTimeField(null=True, blank=True)
    
    # Step 1 - Basic Professional Info
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    display_name = models.CharField(max_length=150, blank=True, help_text="e.g., Dr. John Smith")
    specialization = models.CharField(max_length=200, blank=True)
    primary_clinic_hospital = models.CharField(max_length=200, blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    
    # Step 2 - Credentials & Doctor ID
    license_number = models.CharField(max_length=100, blank=True, unique=True, null=True)
    license_document = models.FileField(upload_to='doctor_licenses/', null=True, blank=True)
    doctor_id = models.CharField(max_length=20, unique=True, null=True, blank=True, editable=False, help_text="Format: DR-YYYY-XXXXX")
    
    # Step 3 - Contact & Bio
    phone_number = models.CharField(max_length=20, blank=True)
    professional_email = models.EmailField(blank=True)
    bio = models.TextField(max_length=280, blank=True, help_text="Short professional bio (max 280 characters)")
    consultation_mode = models.CharField(max_length=20, choices=CONSULTATION_CHOICES, blank=True)
    
    # Profile Status & Verification
    profile_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    profile_completed = models.BooleanField(default=False)
    current_step = models.IntegerField(default=0, help_text="Current step in profile setup (0-4)")
    
    # Admin Verification
    verified_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_doctors')
    verified_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, help_text="Reason for rejection if status is rejected")
    
    # Legacy fields (keeping for backward compatibility)
    years_of_experience = models.IntegerField(null=True, blank=True)
    hospital_affiliation = models.CharField(max_length=200, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(null=True, blank=True, help_text="When profile was submitted for verification")
    
    class Meta:
        verbose_name = "Doctor Profile"
        verbose_name_plural = "Doctor Profiles"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.display_name or self.full_name} - {self.doctor_id or 'No ID'}"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.user.username
    
    def generate_doctor_id(self):
        """Generate unique doctor ID in format DR-YYYY-XXXXX"""
        if not self.doctor_id:
            year = datetime.datetime.now().year
            # Get the last doctor ID created this year
            last_doctor = DoctorProfile.objects.filter(
                doctor_id__startswith=f'DR-{year}-'
            ).order_by('-doctor_id').first()
            
            if last_doctor and last_doctor.doctor_id:
                last_number = int(last_doctor.doctor_id.split('-')[-1])
                new_number = last_number + 1
            else:
                new_number = 1
            
            self.doctor_id = f'DR-{year}-{new_number:05d}'
        return self.doctor_id
    
    def save(self, *args, **kwargs):
        # Auto-generate doctor ID if not present
        if not self.doctor_id:
            self.generate_doctor_id()
        
        # Auto-generate display name if not set
        if not self.display_name and self.first_name and self.last_name:
            self.display_name = f"Dr. {self.first_name} {self.last_name}"
        
        # Set professional email from user email if not set
        if not self.professional_email and self.user:
            self.professional_email = self.user.email
        
        super().save(*args, **kwargs)
    
    def submit_for_verification(self):
        """Submit profile for admin verification"""
        self.profile_status = 'pending'
        self.submitted_at = datetime.datetime.now()
        self.save()
    
    def verify_profile(self, admin_user):
        """Admin verifies the doctor profile"""
        self.profile_status = 'verified'
        self.verified_by = admin_user
        self.verified_at = datetime.datetime.now()
        self.profile_completed = True
        self.save()
    
    def reject_profile(self, admin_user, reason):
        """Admin rejects the doctor profile"""
        self.profile_status = 'rejected'
        self.rejection_reason = reason
        self.verified_by = admin_user
        self.save()
    
    @property
    def is_verified(self):
        return self.profile_status == 'verified'
    
    @property
    def is_pending(self):
        return self.profile_status == 'pending'
    
    @property
    def can_access_dashboard(self):
        """Check if doctor can access full dashboard"""
        return self.profile_status == 'verified' and self.profile_completed


@receiver(post_save, sender=User)
def create_doctor_profile(sender, instance, created, **kwargs):
    """Create doctor profile when a user is created (if they're a doctor)"""
    # This will be handled manually in the signup view
    pass
