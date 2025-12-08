from django.contrib import admin
from .models import MedicalHistoryEntry, MedicalHistoryTimeline, MedicalHistorySummary


@admin.register(MedicalHistoryEntry)
class MedicalHistoryEntryAdmin(admin.ModelAdmin):
    list_display = [
        'title', 'patient', 'category', 'source', 'status',
        'is_critical', 'verified_by_doctor', 'recorded_date'
    ]
    list_filter = [
        'category', 'source', 'status', 'is_critical',
        'is_chronic', 'requires_monitoring', 'verified_by_doctor'
    ]
    search_fields = ['title', 'description', 'patient__full_name']
    readonly_fields = ['recorded_date', 'created_at', 'updated_at', 'duration_text', 'is_active']
    fieldsets = (
        ('Basic Information', {
            'fields': ('workspace', 'patient', 'category', 'source', 'title', 'description')
        }),
        ('Status & Dates', {
            'fields': ('status', 'start_date', 'end_date', 'recorded_date', 'duration_text')
        }),
        ('Clinical Information', {
            'fields': ('severity', 'is_chronic', 'requires_monitoring', 'is_critical', 'category_data')
        }),
        ('Source Tracking', {
            'fields': ('source_reference_id', 'source_reference_type')
        }),
        ('Verification', {
            'fields': ('verified_by_doctor', 'verified_at', 'added_by')
        }),
        ('Notes & Tags', {
            'fields': ('doctor_notes', 'tags')
        }),
        ('Metadata', {
            'fields': ('is_active', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(MedicalHistoryTimeline)
class MedicalHistoryTimelineAdmin(admin.ModelAdmin):
    list_display = [
        'history_entry', 'event_type', 'performed_by',
        'performed_by_type', 'created_at'
    ]
    list_filter = ['event_type', 'performed_by_type', 'created_at']
    search_fields = ['event_description', 'history_entry__title']
    readonly_fields = ['created_at']


@admin.register(MedicalHistorySummary)
class MedicalHistorySummaryAdmin(admin.ModelAdmin):
    list_display = [
        'patient', 'total_conditions', 'active_conditions',
        'total_medications', 'current_medications', 'total_allergies',
        'completeness_score', 'last_updated'
    ]
    readonly_fields = [
        'total_conditions', 'active_conditions', 'total_medications',
        'current_medications', 'total_allergies', 'total_surgeries',
        'total_visits', 'total_lab_results', 'has_chronic_conditions',
        'has_critical_allergies', 'requires_monitoring', 'last_visit_date',
        'active_conditions_list', 'current_medications_list',
        'all_allergies_list', 'recent_labs_list', 'completeness_score',
        'last_updated'
    ]
    actions = ['refresh_summaries']
    
    def refresh_summaries(self, request, queryset):
        for summary in queryset:
            summary.refresh_summary()
        self.message_user(request, f'Refreshed {queryset.count()} summaries')
    refresh_summaries.short_description = 'Refresh selected summaries'
