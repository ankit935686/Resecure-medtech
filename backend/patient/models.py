from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver


class PatientProfile(models.Model):
    """Extended profile for patients"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='patient_profile')
    
    # Basic Information
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    
    # Medical Information
    blood_group = models.CharField(max_length=10, blank=True)
    emergency_contact_name = models.CharField(max_length=200, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    
    # Additional Details
    address = models.TextField(blank=True)
    bio = models.TextField(blank=True)
    
    # Profile Completion Status
    profile_completed = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Patient Profile"
        verbose_name_plural = "Patient Profiles"
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} - Patient" if self.first_name or self.last_name else f"{self.user.username} - Patient"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.user.username


@receiver(post_save, sender=User)
def create_patient_profile(sender, instance, created, **kwargs):
    """Create patient profile when a user is created (if they're a patient)"""
    # This will be handled manually in the signup view
    pass
