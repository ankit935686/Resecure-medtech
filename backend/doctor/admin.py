from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils import timezone
from .models import DoctorProfile


@admin.register(DoctorProfile)
class DoctorProfileAdmin(admin.ModelAdmin):
    list_display = (
        'doctor_id', 'display_name', 'specialization', 
        'profile_status_badge', 'current_step', 'submitted_at', 'verified_at'
    )
    list_filter = ('profile_status', 'current_step', 'specialization', 'consultation_mode', 'created_at')
    search_fields = (
        'user__username', 'user__email', 'first_name', 'last_name', 
        'doctor_id', 'license_number', 'specialization', 'city', 'country'
    )
    readonly_fields = (
        'doctor_id', 'created_at', 'updated_at', 'consent_timestamp',
        'submitted_at', 'verified_at', 'verified_by', 'license_document_preview'
    )
    
    actions = ['verify_doctors', 'reject_doctors']
    
    fieldsets = (
        ('Doctor ID & Status', {
            'fields': ('doctor_id', 'profile_status', 'current_step', 'profile_completed')
        }),
        ('User Account', {
            'fields': ('user',)
        }),
        ('Consent', {
            'fields': ('consent_given', 'consent_timestamp'),
            'classes': ('collapse',)
        }),
        ('Step 1: Basic Professional Info', {
            'fields': (
                'first_name', 'last_name', 'display_name',
                'specialization', 'primary_clinic_hospital',
                'city', 'country'
            )
        }),
        ('Step 2: Credentials', {
            'fields': ('license_number', 'license_document', 'license_document_preview')
        }),
        ('Step 3: Contact & Bio', {
            'fields': (
                'phone_number', 'professional_email',
                'bio', 'consultation_mode'
            )
        }),
        ('Verification', {
            'fields': (
                'verified_by', 'verified_at', 'submitted_at',
                'rejection_reason'
            )
        }),
        ('Legacy Fields', {
            'fields': ('years_of_experience', 'hospital_affiliation'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def profile_status_badge(self, obj):
        """Display profile status with color badge"""
        colors = {
            'draft': 'gray',
            'pending': 'orange',
            'verified': 'green',
            'rejected': 'red',
        }
        color = colors.get(obj.profile_status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px;">{}</span>',
            color,
            obj.get_profile_status_display()
        )
    profile_status_badge.short_description = 'Status'
    
    def license_document_preview(self, obj):
        """Show license document link if available"""
        if obj.license_document:
            return format_html(
                '<a href="{}" target="_blank">View Document</a>',
                obj.license_document.url
            )
        return "No document uploaded"
    license_document_preview.short_description = 'License Document'
    
    def verify_doctors(self, request, queryset):
        """Bulk verify doctors"""
        count = 0
        for doctor in queryset.filter(profile_status='pending'):
            doctor.verify_profile(request.user)
            count += 1
        self.message_user(request, f'{count} doctor(s) verified successfully.')
    verify_doctors.short_description = 'Verify selected doctors'
    
    def reject_doctors(self, request, queryset):
        """Bulk reject doctors"""
        count = 0
        for doctor in queryset.filter(profile_status='pending'):
            doctor.reject_profile(request.user, 'Rejected from admin panel')
            count += 1
        self.message_user(request, f'{count} doctor(s) rejected.')
    reject_doctors.short_description = 'Reject selected doctors'
    
    def get_queryset(self, request):
        """Optimize queries"""
        qs = super().get_queryset(request)
        return qs.select_related('user', 'verified_by')
