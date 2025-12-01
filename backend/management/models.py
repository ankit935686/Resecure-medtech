from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver


class AdminProfile(models.Model):
    """Extended profile for admin users"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='admin_profile')
    
    # Basic Information
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    
    # Additional Details
    department = models.CharField(max_length=200, blank=True)
    bio = models.TextField(blank=True)
    
    # Profile Completion Status
    profile_completed = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Admin Profile"
        verbose_name_plural = "Admin Profiles"
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} - Admin" if self.first_name or self.last_name else f"{self.user.username} - Admin"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.user.username


@receiver(post_save, sender=User)
def create_admin_profile(sender, instance, created, **kwargs):
    """Create admin profile when a user is created (if they're an admin)"""
    # This will be handled manually in the signup view
    pass
