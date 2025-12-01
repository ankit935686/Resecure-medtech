from django.contrib import admin
from .models import AdminProfile


@admin.register(AdminProfile)
class AdminProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'full_name', 'department', 'profile_completed', 'created_at')
    list_filter = ('profile_completed', 'department', 'created_at')
    search_fields = ('user__username', 'user__email', 'first_name', 'last_name', 'department')
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('User Information', {
            'fields': ('user',)
        }),
        ('Basic Information', {
            'fields': ('first_name', 'last_name', 'phone_number')
        }),
        ('Additional Information', {
            'fields': ('department', 'bio')
        }),
        ('Status', {
            'fields': ('profile_completed',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )
