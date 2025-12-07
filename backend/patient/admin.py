from django.contrib import admin
from .models import (
    PatientProfile, 
    AIIntakeForm, 
    IntakeFormResponse, 
    IntakeFormUpload
)


@admin.register(PatientProfile)
class PatientProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'full_name', 'phone_number', 'blood_group', 'profile_completed', 'created_at')
    list_filter = ('profile_completed', 'blood_group', 'created_at')
    search_fields = ('user__username', 'user__email', 'first_name', 'last_name', 'phone_number')
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('User Information', {
            'fields': ('user',)
        }),
        ('Basic Information', {
            'fields': ('first_name', 'last_name', 'phone_number', 'date_of_birth')
        }),
        ('Medical Information', {
            'fields': ('blood_group', 'emergency_contact_name', 'emergency_contact_phone')
        }),
        ('Additional Information', {
            'fields': ('address', 'bio')
        }),
        ('Status', {
            'fields': ('profile_completed',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(AIIntakeForm)
class AIIntakeFormAdmin(admin.ModelAdmin):
    list_display = ('title', 'doctor', 'patient', 'status', 'created_at', 'sent_at', 'submitted_at')
    list_filter = ('status', 'created_at', 'sent_at')
    search_fields = ('title', 'doctor__user__username', 'patient__user__username', 'description')
    readonly_fields = ('created_at', 'updated_at', 'sent_at', 'submitted_at', 'reviewed_at', 'ai_raw_response')
    
    fieldsets = (
        ('Relations', {
            'fields': ('workspace', 'doctor', 'patient')
        }),
        ('Form Details', {
            'fields': ('title', 'description', 'status')
        }),
        ('AI Generation', {
            'fields': ('doctor_prompt', 'ai_raw_response', 'form_schema')
        }),
        ('Summary', {
            'fields': ('ai_summary',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'sent_at', 'submitted_at', 'reviewed_at')
        }),
    )


@admin.register(IntakeFormResponse)
class IntakeFormResponseAdmin(admin.ModelAdmin):
    list_display = ('form', 'is_complete', 'completion_percentage', 'started_at', 'completed_at')
    list_filter = ('is_complete', 'started_at', 'completed_at')
    search_fields = ('form__title', 'form__patient__user__username')
    readonly_fields = ('started_at', 'last_saved_at', 'completion_percentage')
    
    fieldsets = (
        ('Form', {
            'fields': ('form',)
        }),
        ('Response Data', {
            'fields': ('response_data', 'is_complete', 'completion_percentage')
        }),
        ('Timestamps', {
            'fields': ('started_at', 'last_saved_at', 'completed_at')
        }),
    )


@admin.register(IntakeFormUpload)
class IntakeFormUploadAdmin(admin.ModelAdmin):
    list_display = ('file_name', 'form', 'field_label', 'upload_type', 'file_size', 'uploaded_at')
    list_filter = ('upload_type', 'uploaded_at')
    search_fields = ('file_name', 'field_label', 'form__title')
    readonly_fields = ('uploaded_at', 'file_name', 'file_size')
    
    fieldsets = (
        ('Form Reference', {
            'fields': ('form', 'field_id', 'field_label')
        }),
        ('File Details', {
            'fields': ('file', 'file_name', 'file_size', 'file_type', 'upload_type')
        }),
        ('Metadata', {
            'fields': ('description', 'uploaded_at')
        }),
    )
