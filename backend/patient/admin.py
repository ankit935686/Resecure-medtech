from django.contrib import admin
from .models import PatientProfile


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
