from django.shortcuts import render
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q, Count, Case, When, IntegerField
from datetime import datetime, date, timedelta
import json
import os
import requests

from .models import MedicalHistoryEntry, MedicalHistoryTimeline, MedicalHistorySummary
from .serializers import (
    MedicalHistoryEntrySerializer,
    MedicalHistoryTimelineSerializer,
    MedicalHistorySummarySerializer,
    DoctorAddHistorySerializer,
    BulkHistoryImportSerializer
)
from patient.models import DoctorPatientWorkspace, PatientProfile, IntakeFormResponse, MedicalReport
from doctor.models import DoctorProfile


class HistoryPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


# ==================== DOCTOR VIEWS ====================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def doctor_get_workspace_history(request, workspace_id):
    """
    Get complete medical history for a workspace (doctor view)
    Filters: category, source, status, is_critical, search
    """
    try:
        # Verify doctor access
        doctor_profile = DoctorProfile.objects.get(user=request.user)
        workspace = DoctorPatientWorkspace.objects.get(
            id=workspace_id,
            doctor=doctor_profile
        )
        
        # Get all history entries
        entries = MedicalHistoryEntry.objects.filter(workspace=workspace)
        
        # Apply filters
        category = request.GET.get('category')
        if category:
            entries = entries.filter(category=category)
        
        source = request.GET.get('source')
        if source:
            entries = entries.filter(source=source)
        
        status_filter = request.GET.get('status')
        if status_filter:
            entries = entries.filter(status=status_filter)
        
        is_critical = request.GET.get('is_critical')
        if is_critical == 'true':
            entries = entries.filter(is_critical=True)
        
        requires_monitoring = request.GET.get('requires_monitoring')
        if requires_monitoring == 'true':
            entries = entries.filter(requires_monitoring=True)
        
        is_chronic = request.GET.get('is_chronic')
        if is_chronic == 'true':
            entries = entries.filter(is_chronic=True)
        
        # Search
        search = request.GET.get('search')
        if search:
            entries = entries.filter(
                Q(title__icontains=search) |
                Q(description__icontains=search) |
                Q(doctor_notes__icontains=search)
            )
        
        # Sorting
        sort_by = request.GET.get('sort_by', '-recorded_date')
        entries = entries.order_by(sort_by)
        
        # Pagination
        paginator = HistoryPagination()
        paginated_entries = paginator.paginate_queryset(entries, request)
        serializer = MedicalHistoryEntrySerializer(paginated_entries, many=True)
        
        return paginator.get_paginated_response(serializer.data)
        
    except DoctorProfile.DoesNotExist:
        return Response(
            {'error': 'Doctor profile not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except DoctorPatientWorkspace.DoesNotExist:
        return Response(
            {'error': 'Workspace not found or access denied'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def doctor_get_history_summary(request, workspace_id):
    """
    Get medical history summary for quick dashboard view
    """
    try:
        doctor_profile = DoctorProfile.objects.get(user=request.user)
        workspace = DoctorPatientWorkspace.objects.get(
            id=workspace_id,
            doctor=doctor_profile
        )
        
        # Get or create summary
        summary, created = MedicalHistorySummary.objects.get_or_create(
            workspace=workspace,
            patient=workspace.patient
        )
        
        # Refresh if older than 1 hour
        if created or (datetime.now() - summary.last_updated.replace(tzinfo=None)).seconds > 3600:
            summary.refresh_summary()
        
        serializer = MedicalHistorySummarySerializer(summary)
        return Response(serializer.data)
        
    except DoctorProfile.DoesNotExist:
        return Response(
            {'error': 'Doctor profile not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except DoctorPatientWorkspace.DoesNotExist:
        return Response(
            {'error': 'Workspace not found or access denied'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def doctor_get_history_by_category(request, workspace_id, category):
    """
    Get history entries filtered by specific category
    Useful for focused views (all medications, all conditions, etc.)
    """
    try:
        doctor_profile = DoctorProfile.objects.get(user=request.user)
        workspace = DoctorPatientWorkspace.objects.get(
            id=workspace_id,
            doctor=doctor_profile
        )
        
        # Validate category
        valid_categories = dict(MedicalHistoryEntry.CATEGORY_CHOICES).keys()
        if category not in valid_categories:
            return Response(
                {'error': f'Invalid category. Valid options: {", ".join(valid_categories)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        entries = MedicalHistoryEntry.objects.filter(
            workspace=workspace,
            category=category
        )
        
        # Apply status filter
        status_filter = request.GET.get('status')
        if status_filter:
            entries = entries.filter(status=status_filter)
        
        # Sorting
        sort_by = request.GET.get('sort_by', '-recorded_date')
        entries = entries.order_by(sort_by)
        
        serializer = MedicalHistoryEntrySerializer(entries, many=True)
        return Response({
            'category': category,
            'count': len(serializer.data),
            'entries': serializer.data
        })
        
    except DoctorProfile.DoesNotExist:
        return Response(
            {'error': 'Doctor profile not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except DoctorPatientWorkspace.DoesNotExist:
        return Response(
            {'error': 'Workspace not found or access denied'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def doctor_add_history_entry(request):
    """
    Doctor manually adds a new medical history entry
    """
    try:
        doctor_profile = DoctorProfile.objects.get(user=request.user)
        
        serializer = DoctorAddHistorySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        workspace_id = data.pop('workspace_id')
        
        workspace = DoctorPatientWorkspace.objects.get(
            id=workspace_id,
            doctor=doctor_profile
        )
        
        # Create history entry
        entry = MedicalHistoryEntry.objects.create(
            workspace=workspace,
            patient=workspace.patient,
            source='DOCTOR',
            added_by=request.user,
            **data
        )
        
        # Create timeline event
        MedicalHistoryTimeline.objects.create(
            history_entry=entry,
            event_type='added',
            event_description=f"Doctor added new {entry.get_category_display()}: {entry.title}",
            performed_by=request.user,
            performed_by_type='doctor',
            event_data={
                'category': entry.category,
                'severity': entry.severity,
                'is_critical': entry.is_critical
            }
        )
        
        # Refresh summary
        summary, _ = MedicalHistorySummary.objects.get_or_create(
            workspace=workspace,
            patient=workspace.patient
        )
        summary.refresh_summary()
        
        response_serializer = MedicalHistoryEntrySerializer(entry)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        
    except DoctorProfile.DoesNotExist:
        return Response(
            {'error': 'Doctor profile not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except DoctorPatientWorkspace.DoesNotExist:
        return Response(
            {'error': 'Workspace not found or access denied'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def doctor_update_history_entry(request, entry_id):
    """
    Doctor updates an existing history entry
    """
    try:
        doctor_profile = DoctorProfile.objects.get(user=request.user)
        
        entry = MedicalHistoryEntry.objects.get(id=entry_id)
        
        # Verify doctor has access to this workspace
        if entry.workspace.doctor != doctor_profile:
            return Response(
                {'error': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Track changes
        old_data = {
            'status': entry.status,
            'title': entry.title,
            'severity': entry.severity
        }
        
        # Update entry
        serializer = MedicalHistoryEntrySerializer(
            entry,
            data=request.data,
            partial=True
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        serializer.save()
        
        # Create timeline event
        changes = []
        for key, old_val in old_data.items():
            new_val = getattr(entry, key)
            if old_val != new_val:
                changes.append(f"{key}: {old_val} → {new_val}")
        
        if changes:
            MedicalHistoryTimeline.objects.create(
                history_entry=entry,
                event_type='updated',
                event_description=f"Doctor updated entry: {', '.join(changes)}",
                performed_by=request.user,
                performed_by_type='doctor',
                event_data={'changes': changes}
            )
        
        # Refresh summary
        summary, _ = MedicalHistorySummary.objects.get_or_create(
            workspace=entry.workspace,
            patient=entry.patient
        )
        summary.refresh_summary()
        
        return Response(serializer.data)
        
    except DoctorProfile.DoesNotExist:
        return Response(
            {'error': 'Doctor profile not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except MedicalHistoryEntry.DoesNotExist:
        return Response(
            {'error': 'History entry not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def doctor_verify_entry(request, entry_id):
    """
    Doctor verifies a history entry (marks it as reviewed and accurate)
    """
    try:
        doctor_profile = DoctorProfile.objects.get(user=request.user)
        entry = MedicalHistoryEntry.objects.get(id=entry_id)
        
        if entry.workspace.doctor != doctor_profile:
            return Response(
                {'error': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        entry.verified_by_doctor = True
        entry.verified_at = datetime.now()
        entry.save()
        
        # Create timeline event
        MedicalHistoryTimeline.objects.create(
            history_entry=entry,
            event_type='verified',
            event_description=f"Doctor verified {entry.get_category_display()}: {entry.title}",
            performed_by=request.user,
            performed_by_type='doctor'
        )
        
        serializer = MedicalHistoryEntrySerializer(entry)
        return Response(serializer.data)
        
    except DoctorProfile.DoesNotExist:
        return Response(
            {'error': 'Doctor profile not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except MedicalHistoryEntry.DoesNotExist:
        return Response(
            {'error': 'History entry not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def doctor_delete_history_entry(request, entry_id):
    """
    Doctor deletes a history entry
    """
    try:
        doctor_profile = DoctorProfile.objects.get(user=request.user)
        entry = MedicalHistoryEntry.objects.get(id=entry_id)
        
        if entry.workspace.doctor != doctor_profile:
            return Response(
                {'error': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        workspace = entry.workspace
        patient = entry.patient
        entry_title = entry.title
        entry_category = entry.get_category_display()
        
        entry.delete()
        
        # Refresh summary
        summary, _ = MedicalHistorySummary.objects.get_or_create(
            workspace=workspace,
            patient=patient
        )
        summary.refresh_summary()
        
        return Response(
            {
                'message': f'Deleted {entry_category}: {entry_title}',
                'success': True
            },
            status=status.HTTP_200_OK
        )
        
    except DoctorProfile.DoesNotExist:
        return Response(
            {'error': 'Doctor profile not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except MedicalHistoryEntry.DoesNotExist:
        return Response(
            {'error': 'History entry not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def doctor_get_entry_timeline(request, entry_id):
    """
    Get timeline of changes for a specific history entry
    """
    try:
        doctor_profile = DoctorProfile.objects.get(user=request.user)
        entry = MedicalHistoryEntry.objects.get(id=entry_id)
        
        if entry.workspace.doctor != doctor_profile:
            return Response(
                {'error': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        timeline = MedicalHistoryTimeline.objects.filter(history_entry=entry)
        serializer = MedicalHistoryTimelineSerializer(timeline, many=True)
        
        return Response({
            'entry_id': entry_id,
            'entry_title': entry.title,
            'timeline': serializer.data
        })
        
    except DoctorProfile.DoesNotExist:
        return Response(
            {'error': 'Doctor profile not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except MedicalHistoryEntry.DoesNotExist:
        return Response(
            {'error': 'History entry not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def doctor_get_clinical_summary(request, workspace_id):
    """
    Get focused clinical summary for doctor dashboard
    Shows: Active conditions, current medications, critical allergies, recent labs, monitoring items
    """
    try:
        doctor_profile = DoctorProfile.objects.get(user=request.user)
        workspace = DoctorPatientWorkspace.objects.get(
            id=workspace_id,
            doctor=doctor_profile
        )
        
        # Active conditions
        active_conditions = MedicalHistoryEntry.objects.filter(
            workspace=workspace,
            category='condition',
            status='active'
        ).order_by('-is_chronic', '-is_critical', '-severity')
        
        # Current medications
        current_medications = MedicalHistoryEntry.objects.filter(
            workspace=workspace,
            category='medication',
            status='active'
        ).order_by('-is_critical', 'title')
        
        # All allergies (always important)
        allergies = MedicalHistoryEntry.objects.filter(
            workspace=workspace,
            category='allergy'
        ).order_by('-is_critical', 'title')
        
        # Recent surgeries (last 2 years)
        two_years_ago = date.today() - timedelta(days=730)
        recent_surgeries = MedicalHistoryEntry.objects.filter(
            workspace=workspace,
            category='surgery',
            start_date__gte=two_years_ago
        ).order_by('-start_date')
        
        # Recent visits (last 6 months)
        six_months_ago = date.today() - timedelta(days=180)
        recent_visits = MedicalHistoryEntry.objects.filter(
            workspace=workspace,
            category='visit',
            start_date__gte=six_months_ago
        ).order_by('-start_date')
        
        # Recent lab results (last 3 months)
        three_months_ago = date.today() - timedelta(days=90)
        recent_labs = MedicalHistoryEntry.objects.filter(
            workspace=workspace,
            category='lab_result',
            start_date__gte=three_months_ago
        ).order_by('-start_date')
        
        # Items requiring monitoring
        monitoring_items = MedicalHistoryEntry.objects.filter(
            workspace=workspace,
            requires_monitoring=True,
            status='active'
        ).order_by('-is_critical', 'category')
        
        return Response({
            'workspace_id': workspace_id,
            'patient_name': workspace.patient.full_name,
            'active_conditions': MedicalHistoryEntrySerializer(active_conditions, many=True).data,
            'current_medications': MedicalHistoryEntrySerializer(current_medications, many=True).data,
            'allergies': MedicalHistoryEntrySerializer(allergies, many=True).data,
            'recent_surgeries': MedicalHistoryEntrySerializer(recent_surgeries, many=True).data,
            'recent_visits': MedicalHistoryEntrySerializer(recent_visits, many=True).data,
            'recent_labs': MedicalHistoryEntrySerializer(recent_labs, many=True).data,
            'monitoring_items': MedicalHistoryEntrySerializer(monitoring_items, many=True).data,
            'counts': {
                'active_conditions': active_conditions.count(),
                'current_medications': current_medications.count(),
                'allergies': allergies.count(),
                'recent_surgeries': recent_surgeries.count(),
                'recent_visits': recent_visits.count(),
                'recent_labs': recent_labs.count(),
                'monitoring_items': monitoring_items.count()
            }
        })
        
    except DoctorProfile.DoesNotExist:
        return Response(
            {'error': 'Doctor profile not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except DoctorPatientWorkspace.DoesNotExist:
        return Response(
            {'error': 'Workspace not found or access denied'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def doctor_bulk_import_history(request):
    """
    Bulk import history entries from AI intake forms or OCR reports
    Used by system to automatically populate history from existing sources
    """
    try:
        doctor_profile = DoctorProfile.objects.get(user=request.user)
        
        serializer = BulkHistoryImportSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        workspace = DoctorPatientWorkspace.objects.get(
            id=data['workspace_id'],
            doctor=doctor_profile
        )
        
        created_entries = []
        for entry_data in data['entries']:
            entry = MedicalHistoryEntry.objects.create(
                workspace=workspace,
                patient=workspace.patient,
                source=data['source'],
                source_reference_id=data.get('source_reference_id', ''),
                source_reference_type=data.get('source_reference_type', ''),
                category=entry_data['category'],
                title=entry_data['title'],
                description=entry_data.get('description', ''),
                status=entry_data.get('status', 'active'),
                start_date=entry_data.get('start_date'),
                end_date=entry_data.get('end_date'),
                severity=entry_data.get('severity'),
                is_chronic=entry_data.get('is_chronic', False),
                requires_monitoring=entry_data.get('requires_monitoring', False),
                is_critical=entry_data.get('is_critical', False),
                category_data=entry_data.get('category_data', {}),
                tags=entry_data.get('tags', [])
            )
            created_entries.append(entry)
            
            # Create timeline event
            MedicalHistoryTimeline.objects.create(
                history_entry=entry,
                event_type='added',
                event_description=f"Imported from {data['source']}: {entry.title}",
                performed_by=request.user,
                performed_by_type='system',
                event_data={
                    'source': data['source'],
                    'source_reference_id': data.get('source_reference_id', ''),
                    'bulk_import': True
                }
            )
        
        # Refresh summary
        summary, _ = MedicalHistorySummary.objects.get_or_create(
            workspace=workspace,
            patient=workspace.patient
        )
        summary.refresh_summary()
        
        serializer_response = MedicalHistoryEntrySerializer(created_entries, many=True)
        return Response({
            'message': f'Successfully imported {len(created_entries)} entries',
            'count': len(created_entries),
            'entries': serializer_response.data
        }, status=status.HTTP_201_CREATED)
        
    except DoctorProfile.DoesNotExist:
        return Response(
            {'error': 'Doctor profile not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except DoctorPatientWorkspace.DoesNotExist:
        return Response(
            {'error': 'Workspace not found or access denied'},
            status=status.HTTP_404_NOT_FOUND
        )


# ==================== PATIENT VIEWS ====================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def patient_get_my_history(request):
    """Patient views their complete medical history"""
    try:
        patient_profile = PatientProfile.objects.get(user=request.user)
        entries = MedicalHistoryEntry.objects.filter(patient=patient_profile)
        
        if request.GET.get('category'):
            entries = entries.filter(category=request.GET.get('category'))
        if request.GET.get('source'):
            entries = entries.filter(source=request.GET.get('source'))
        if request.GET.get('status'):
            entries = entries.filter(status=request.GET.get('status'))
        if request.GET.get('search'):
            entries = entries.filter(Q(title__icontains=request.GET.get('search')) | Q(description__icontains=request.GET.get('search')))
        
        entries = entries.order_by(request.GET.get('sort_by', '-recorded_date'))
        paginator = HistoryPagination()
        paginated_entries = paginator.paginate_queryset(entries, request)
        serializer = MedicalHistoryEntrySerializer(paginated_entries, many=True)
        return paginator.get_paginated_response(serializer.data)
    except PatientProfile.DoesNotExist:
        return Response({'error': 'Patient profile not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def patient_get_my_summary(request):
    """Patient gets summary of their medical history"""
    try:
        patient_profile = PatientProfile.objects.get(user=request.user)
        summaries = MedicalHistorySummary.objects.filter(patient=patient_profile)
        
        if not summaries.exists():
            return Response({
                'patient_name': patient_profile.full_name,
                'total_conditions': 0,
                'active_conditions': 0,
                'total_medications': 0,
                'current_medications': 0,
                'total_allergies': 0,
                'total_surgeries': 0,
                'total_visits': 0,
                'total_lab_results': 0,
                'completeness_score': 0,
                'message': 'No medical history recorded yet'
            })
        
        serializer = MedicalHistorySummarySerializer(summaries.first())
        return Response(serializer.data)
    except PatientProfile.DoesNotExist:
        return Response({'error': 'Patient profile not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def patient_get_history_by_category(request, category):
    """Patient views history filtered by category"""
    try:
        patient_profile = PatientProfile.objects.get(user=request.user)
        valid_categories = dict(MedicalHistoryEntry.CATEGORY_CHOICES).keys()
        
        if category not in valid_categories:
            return Response({'error': f'Invalid category. Valid: {", ".join(valid_categories)}'}, status=status.HTTP_400_BAD_REQUEST)
        
        entries = MedicalHistoryEntry.objects.filter(patient=patient_profile, category=category)
        if request.GET.get('status'):
            entries = entries.filter(status=request.GET.get('status'))
        
        entries = entries.order_by(request.GET.get('sort_by', '-recorded_date'))
        serializer = MedicalHistoryEntrySerializer(entries, many=True)
        return Response({'category': category, 'count': len(serializer.data), 'entries': serializer.data})
    except PatientProfile.DoesNotExist:
        return Response({'error': 'Patient profile not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def patient_add_history_entry(request):
    """Patient manually adds medical history entry"""
    try:
        patient_profile = PatientProfile.objects.get(user=request.user)
        workspace = DoctorPatientWorkspace.objects.filter(patient=patient_profile).first()
        
        if not workspace:
            return Response({'error': 'No workspace found. Connect with a doctor first.'}, status=status.HTTP_400_BAD_REQUEST)
        
        category = request.data.get('category')
        title = request.data.get('title')
        
        if not category or not title:
            return Response({'error': 'Category and title required'}, status=status.HTTP_400_BAD_REQUEST)
        
        valid_categories = dict(MedicalHistoryEntry.CATEGORY_CHOICES).keys()
        if category not in valid_categories:
            return Response({'error': f'Invalid category. Valid: {", ".join(valid_categories)}'}, status=status.HTTP_400_BAD_REQUEST)
        
        entry = MedicalHistoryEntry.objects.create(
            workspace=workspace,
            patient=patient_profile,
            source='MANUAL',
            added_by=request.user,
            category=category,
            title=title,
            description=request.data.get('description', ''),
            status=request.data.get('status', 'active'),
            start_date=request.data.get('start_date'),
            end_date=request.data.get('end_date'),
            severity=request.data.get('severity'),
            is_chronic=request.data.get('is_chronic', False),
            requires_monitoring=request.data.get('requires_monitoring', False),
            is_critical=request.data.get('is_critical', False),
            category_data=request.data.get('category_data', {}),
            tags=request.data.get('tags', [])
        )
        
        MedicalHistoryTimeline.objects.create(
            history_entry=entry,
            event_type='added',
            event_description=f"Patient added {entry.get_category_display()}: {entry.title}",
            performed_by=request.user,
            performed_by_type='patient',
            event_data={'category': entry.category, 'patient_added': True}
        )
        
        summary, _ = MedicalHistorySummary.objects.get_or_create(workspace=workspace, patient=patient_profile)
        summary.refresh_summary()
        
        serializer = MedicalHistoryEntrySerializer(entry)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    except PatientProfile.DoesNotExist:
        return Response({'error': 'Patient profile not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def patient_update_history_entry(request, entry_id):
    """Patient updates their own history entry (MANUAL only)"""
    try:
        patient_profile = PatientProfile.objects.get(user=request.user)
        entry = MedicalHistoryEntry.objects.get(id=entry_id, patient=patient_profile)
        
        if entry.source != 'MANUAL':
            return Response({'error': 'Can only update entries you created manually'}, status=status.HTTP_403_FORBIDDEN)
        
        old_data = {'status': entry.status, 'title': entry.title}
        serializer = MedicalHistoryEntrySerializer(entry, data=request.data, partial=True)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        serializer.save()
        
        changes = [f"{k}: {old_data[k]} → {getattr(entry, k)}" for k in old_data if old_data[k] != getattr(entry, k)]
        if changes:
            MedicalHistoryTimeline.objects.create(
                history_entry=entry,
                event_type='updated',
                event_description=f"Patient updated: {', '.join(changes)}",
                performed_by=request.user,
                performed_by_type='patient',
                event_data={'changes': changes}
            )
        
        summary, _ = MedicalHistorySummary.objects.get_or_create(workspace=entry.workspace, patient=entry.patient)
        summary.refresh_summary()
        
        return Response(serializer.data)
    except PatientProfile.DoesNotExist:
        return Response({'error': 'Patient profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except MedicalHistoryEntry.DoesNotExist:
        return Response({'error': 'Entry not found or access denied'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def patient_delete_history_entry(request, entry_id):
    """Patient deletes their own history entry (MANUAL only)"""
    try:
        patient_profile = PatientProfile.objects.get(user=request.user)
        entry = MedicalHistoryEntry.objects.get(id=entry_id, patient=patient_profile)
        
        if entry.source != 'MANUAL':
            return Response({'error': 'Can only delete entries you created manually'}, status=status.HTTP_403_FORBIDDEN)
        
        workspace, patient = entry.workspace, entry.patient
        entry_title, entry_category = entry.title, entry.get_category_display()
        entry.delete()
        
        summary, _ = MedicalHistorySummary.objects.get_or_create(workspace=workspace, patient=patient)
        summary.refresh_summary()
        
        return Response({'message': f'Deleted {entry_category}: {entry_title}', 'success': True})
    except PatientProfile.DoesNotExist:
        return Response({'error': 'Patient profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except MedicalHistoryEntry.DoesNotExist:
        return Response({'error': 'Entry not found or access denied'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def patient_get_entry_timeline(request, entry_id):
    """Patient views timeline of changes for their entry"""
    try:
        patient_profile = PatientProfile.objects.get(user=request.user)
        entry = MedicalHistoryEntry.objects.get(id=entry_id, patient=patient_profile)
        timeline = MedicalHistoryTimeline.objects.filter(history_entry=entry)
        serializer = MedicalHistoryTimelineSerializer(timeline, many=True)
        return Response({'entry_id': entry_id, 'entry_title': entry.title, 'timeline': serializer.data})
    except PatientProfile.DoesNotExist:
        return Response({'error': 'Patient profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except MedicalHistoryEntry.DoesNotExist:
        return Response({'error': 'Entry not found or access denied'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def patient_get_dashboard_view(request):
    """Patient's personalized dashboard view"""
    try:
        patient_profile = PatientProfile.objects.get(user=request.user)
        six_months_ago = date.today() - timedelta(days=180)
        three_months_ago = date.today() - timedelta(days=90)
        
        active_conditions = MedicalHistoryEntry.objects.filter(patient=patient_profile, category='condition', status='active').order_by('-is_chronic', '-severity')
        current_medications = MedicalHistoryEntry.objects.filter(patient=patient_profile, category='medication', status='active').order_by('title')
        allergies = MedicalHistoryEntry.objects.filter(patient=patient_profile, category='allergy').order_by('-is_critical', 'title')
        recent_visits = MedicalHistoryEntry.objects.filter(patient=patient_profile, category='visit', start_date__gte=six_months_ago).order_by('-start_date')
        recent_labs = MedicalHistoryEntry.objects.filter(patient=patient_profile, category='lab_result', start_date__gte=three_months_ago).order_by('-start_date')
        surgeries = MedicalHistoryEntry.objects.filter(patient=patient_profile, category='surgery').order_by('-start_date')
        monitoring_items = MedicalHistoryEntry.objects.filter(patient=patient_profile, requires_monitoring=True, status='active').order_by('-is_critical', 'category')
        
        return Response({
            'patient_name': patient_profile.full_name,
            'active_conditions': MedicalHistoryEntrySerializer(active_conditions, many=True).data,
            'current_medications': MedicalHistoryEntrySerializer(current_medications, many=True).data,
            'allergies': MedicalHistoryEntrySerializer(allergies, many=True).data,
            'recent_visits': MedicalHistoryEntrySerializer(recent_visits, many=True).data,
            'recent_labs': MedicalHistoryEntrySerializer(recent_labs, many=True).data,
            'surgeries': MedicalHistoryEntrySerializer(surgeries, many=True).data,
            'monitoring_items': MedicalHistoryEntrySerializer(monitoring_items, many=True).data,
            'counts': {
                'active_conditions': active_conditions.count(),
                'current_medications': current_medications.count(),
                'allergies': allergies.count(),
                'recent_visits': recent_visits.count(),
                'recent_labs': recent_labs.count(),
                'surgeries': surgeries.count(),
                'monitoring_items': monitoring_items.count()
            }
        })
    except PatientProfile.DoesNotExist:
        return Response({'error': 'Patient profile not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def patient_get_health_overview(request):
    """Patient's health overview with statistics"""
    try:
        patient_profile = PatientProfile.objects.get(user=request.user)
        all_entries = MedicalHistoryEntry.objects.filter(patient=patient_profile)
        
        conditions_count = all_entries.filter(category='condition').count()
        active_conditions_count = all_entries.filter(category='condition', status='active').count()
        medications_count = all_entries.filter(category='medication').count()
        active_medications_count = all_entries.filter(category='medication', status='active').count()
        allergies_count = all_entries.filter(category='allergy').count()
        surgeries_count = all_entries.filter(category='surgery').count()
        visits_count = all_entries.filter(category='visit').count()
        labs_count = all_entries.filter(category='lab_result').count()
        
        intake_count = all_entries.filter(source='INTAKE').count()
        ocr_count = all_entries.filter(source='OCR').count()
        doctor_count = all_entries.filter(source='DOCTOR').count()
        manual_count = all_entries.filter(source='MANUAL').count()
        
        has_chronic = all_entries.filter(is_chronic=True, status='active').exists()
        has_critical_allergies = all_entries.filter(category='allergy', is_critical=True).exists()
        monitoring_count = all_entries.filter(requires_monitoring=True, status='active').count()
        
        last_entry = all_entries.order_by('-created_at').first()
        last_visit = all_entries.filter(category='visit').order_by('-start_date').first()
        
        has_conditions = conditions_count > 0
        has_medications = medications_count > 0
        has_allergies = allergies_count > 0
        has_visits = visits_count > 0
        completeness_score = int((sum([has_conditions, has_medications, has_allergies, has_visits]) / 4) * 100)
        
        return Response({
            'patient_name': patient_profile.full_name,
            'total_entries': all_entries.count(),
            'category_counts': {
                'conditions': conditions_count,
                'active_conditions': active_conditions_count,
                'medications': medications_count,
                'active_medications': active_medications_count,
                'allergies': allergies_count,
                'surgeries': surgeries_count,
                'visits': visits_count,
                'lab_results': labs_count
            },
            'source_breakdown': {
                'from_intake_forms': intake_count,
                'from_reports': ocr_count,
                'from_doctors': doctor_count,
                'manually_added': manual_count
            },
            'health_indicators': {
                'has_chronic_conditions': has_chronic,
                'has_critical_allergies': has_critical_allergies,
                'items_requiring_monitoring': monitoring_count
            },
            'activity': {
                'last_entry_date': last_entry.created_at if last_entry else None,
                'last_visit_date': last_visit.start_date if last_visit else None
            },
            'completeness': {
                'score': completeness_score,
                'has_conditions': has_conditions,
                'has_medications': has_medications,
                'has_allergies': has_allergies,
                'has_visit_history': has_visits
            }
        })
    except PatientProfile.DoesNotExist:
        return Response({'error': 'Patient profile not found'}, status=status.HTTP_404_NOT_FOUND)


# ==================== INTEGRATION HELPER FUNCTIONS ====================

from patient.models import AIIntakeForm, IntakeFormResponse, MedicalReport
import json
import re


def import_from_intake_form(intake_form_id):
    """
    Integration helper: Import medical history from AI Intake Form responses
    Automatically called when intake form is submitted/reviewed
    
    Returns: dict with imported entries count and details
    """
    try:
        intake_form = AIIntakeForm.objects.select_related(
            'workspace', 'patient', 'doctor', 'response'
        ).get(id=intake_form_id)
        
        # Only process submitted or reviewed forms
        if intake_form.status not in ['submitted', 'reviewed']:
            return {'success': False, 'error': 'Form not submitted yet'}
        
        if not hasattr(intake_form, 'response'):
            return {'success': False, 'error': 'No response data found'}
        
        response_data = intake_form.response.response_data
        imported_entries = []
        
        # Extract medical information from response_data
        # Pattern matching for different medical categories
        
        # 1. Extract Conditions/Diagnoses
        conditions_fields = ['current_conditions', 'chronic_conditions', 'medical_history', 
                            'health_conditions', 'diagnoses', 'past_illnesses']
        for field in conditions_fields:
            if field in response_data and response_data[field]:
                conditions_text = response_data[field]
                # Split by common separators
                conditions_list = re.split(r'[,;\n]+', str(conditions_text))
                
                for condition in conditions_list:
                    condition = condition.strip()
                    if condition and len(condition) > 2:
                        entry = MedicalHistoryEntry.objects.create(
                            workspace=intake_form.workspace,
                            patient=intake_form.patient,
                            category='condition',
                            title=condition[:200],
                            description=f'Reported in intake form: {intake_form.title}',
                            source='INTAKE',
                            source_reference_id=f'intake_form_{intake_form.id}',
                            status='active',
                            recorded_date=intake_form.submitted_at or intake_form.created_at,
                            verified_by_doctor=False,
                            category_data={'form_field': field, 'form_title': intake_form.title}
                        )
                        imported_entries.append({
                            'id': entry.id,
                            'category': 'condition',
                            'title': entry.title
                        })
        
        # 2. Extract Medications
        medication_fields = ['current_medications', 'medications', 'prescriptions', 
                            'medicines', 'drugs_taking']
        for field in medication_fields:
            if field in response_data and response_data[field]:
                medications_text = response_data[field]
                medications_list = re.split(r'[,;\n]+', str(medications_text))
                
                for medication in medications_list:
                    medication = medication.strip()
                    if medication and len(medication) > 2:
                        # Try to extract dosage if present
                        dosage_match = re.search(r'(\d+\s*(?:mg|ml|g|mcg|units?))', medication, re.IGNORECASE)
                        dosage = dosage_match.group(1) if dosage_match else ''
                        
                        entry = MedicalHistoryEntry.objects.create(
                            workspace=intake_form.workspace,
                            patient=intake_form.patient,
                            category='medication',
                            title=medication[:200],
                            description=f'Reported in intake form: {intake_form.title}',
                            source='INTAKE',
                            source_reference_id=f'intake_form_{intake_form.id}',
                            status='active',
                            recorded_date=intake_form.submitted_at or intake_form.created_at,
                            verified_by_doctor=False,
                            category_data={
                                'form_field': field,
                                'form_title': intake_form.title,
                                'dosage': dosage,
                                'frequency': 'As reported by patient'
                            }
                        )
                        imported_entries.append({
                            'id': entry.id,
                            'category': 'medication',
                            'title': entry.title
                        })
        
        # 3. Extract Allergies
        allergy_fields = ['allergies', 'drug_allergies', 'food_allergies', 
                         'known_allergies', 'allergy_history']
        for field in allergy_fields:
            if field in response_data and response_data[field]:
                allergies_text = response_data[field]
                allergies_list = re.split(r'[,;\n]+', str(allergies_text))
                
                for allergy in allergies_list:
                    allergy = allergy.strip()
                    if allergy and len(allergy) > 2:
                        # Try to extract severity if mentioned
                        severity = 'unknown'
                        if any(word in allergy.lower() for word in ['severe', 'serious', 'anaphylaxis']):
                            severity = 'severe'
                        elif any(word in allergy.lower() for word in ['mild', 'minor']):
                            severity = 'mild'
                        elif any(word in allergy.lower() for word in ['moderate']):
                            severity = 'moderate'
                        
                        entry = MedicalHistoryEntry.objects.create(
                            workspace=intake_form.workspace,
                            patient=intake_form.patient,
                            category='allergy',
                            title=allergy[:200],
                            description=f'Reported in intake form: {intake_form.title}',
                            source='INTAKE',
                            source_reference_id=f'intake_form_{intake_form.id}',
                            status='active',
                            recorded_date=intake_form.submitted_at or intake_form.created_at,
                            is_critical=True,  # Allergies are always critical
                            verified_by_doctor=False,
                            category_data={
                                'form_field': field,
                                'form_title': intake_form.title,
                                'severity': severity,
                                'allergen_type': 'As reported by patient'
                            }
                        )
                        imported_entries.append({
                            'id': entry.id,
                            'category': 'allergy',
                            'title': entry.title
                        })
        
        # 4. Extract Surgeries/Procedures
        surgery_fields = ['past_surgeries', 'surgical_history', 'procedures', 
                         'operations', 'surgery_history']
        for field in surgery_fields:
            if field in response_data and response_data[field]:
                surgeries_text = response_data[field]
                surgeries_list = re.split(r'[,;\n]+', str(surgeries_text))
                
                for surgery in surgeries_list:
                    surgery = surgery.strip()
                    if surgery and len(surgery) > 2:
                        # Try to extract year if present
                        year_match = re.search(r'(19|20)\d{2}', surgery)
                        surgery_date = None
                        if year_match:
                            try:
                                surgery_date = date(int(year_match.group(0)), 1, 1)
                            except:
                                pass
                        
                        entry = MedicalHistoryEntry.objects.create(
                            workspace=intake_form.workspace,
                            patient=intake_form.patient,
                            category='surgery',
                            title=surgery[:200],
                            description=f'Reported in intake form: {intake_form.title}',
                            source='INTAKE',
                            source_reference_id=f'intake_form_{intake_form.id}',
                            status='historical',
                            recorded_date=surgery_date or intake_form.submitted_at or intake_form.created_at,
                            verified_by_doctor=False,
                            category_data={
                                'form_field': field,
                                'form_title': intake_form.title,
                                'procedure_type': 'As reported by patient'
                            }
                        )
                        imported_entries.append({
                            'id': entry.id,
                            'category': 'surgery',
                            'title': entry.title
                        })
        
        # 5. Use AI analysis data if available
        if intake_form.ai_analysis:
            ai_analysis = intake_form.ai_analysis
            
            # Extract conditions from AI analysis
            if 'conditions' in ai_analysis or 'diagnoses' in ai_analysis:
                ai_conditions = ai_analysis.get('conditions', []) or ai_analysis.get('diagnoses', [])
                for condition_data in ai_conditions:
                    if isinstance(condition_data, dict):
                        condition_name = condition_data.get('name', condition_data.get('condition', ''))
                    else:
                        condition_name = str(condition_data)
                    
                    if condition_name:
                        entry = MedicalHistoryEntry.objects.create(
                            workspace=intake_form.workspace,
                            patient=intake_form.patient,
                            category='condition',
                            title=condition_name[:200],
                            description=f'AI-detected from intake form: {intake_form.title}',
                            source='INTAKE',
                            source_reference_id=f'intake_form_{intake_form.id}_ai',
                            status='active',
                            recorded_date=intake_form.submitted_at or intake_form.created_at,
                            verified_by_doctor=False,
                            category_data={
                                'ai_detected': True,
                                'form_title': intake_form.title,
                                'confidence': condition_data.get('confidence') if isinstance(condition_data, dict) else None
                            }
                        )
                        imported_entries.append({
                            'id': entry.id,
                            'category': 'condition',
                            'title': entry.title
                        })
            
            # Extract symptoms as conditions
            if 'symptoms' in ai_analysis:
                ai_symptoms = ai_analysis.get('symptoms', [])
                for symptom_data in ai_symptoms:
                    if isinstance(symptom_data, dict):
                        symptom_name = symptom_data.get('name', symptom_data.get('symptom', ''))
                    else:
                        symptom_name = str(symptom_data)
                    
                    if symptom_name:
                        entry = MedicalHistoryEntry.objects.create(
                            workspace=intake_form.workspace,
                            patient=intake_form.patient,
                            category='condition',
                            title=f'Symptom: {symptom_name}'[:200],
                            description=f'AI-detected symptom from intake form: {intake_form.title}',
                            source='INTAKE',
                            source_reference_id=f'intake_form_{intake_form.id}_symptom',
                            status='active',
                            recorded_date=intake_form.submitted_at or intake_form.created_at,
                            verified_by_doctor=False,
                            category_data={
                                'ai_detected': True,
                                'type': 'symptom',
                                'form_title': intake_form.title
                            }
                        )
                        imported_entries.append({
                            'id': entry.id,
                            'category': 'condition',
                            'title': entry.title
                        })
        
        # Update or create summary for this workspace
        MedicalHistorySummary.update_summary(intake_form.workspace)
        
        return {
            'success': True,
            'imported_count': len(imported_entries),
            'entries': imported_entries,
            'form_id': intake_form.id,
            'form_title': intake_form.title
        }
        
    except AIIntakeForm.DoesNotExist:
        return {'success': False, 'error': 'Intake form not found'}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def import_from_medical_report(report_id):
    """
    Integration helper: Import medical history from OCR-processed Medical Reports
    Automatically called when OCR processing completes
    
    Returns: dict with imported entries count and details
    """
    try:
        medical_report = MedicalReport.objects.select_related(
            'workspace', 'patient'
        ).get(id=report_id)
        
        # Only process OCR-completed reports
        if not medical_report.ocr_processed:
            return {'success': False, 'error': 'OCR processing not complete'}
        
        imported_entries = []
        
        # 1. Extract Medications from OCR data
        if medical_report.extracted_medications:
            medications = medical_report.extracted_medications
            if isinstance(medications, list):
                for med_data in medications:
                    if isinstance(med_data, dict):
                        med_name = med_data.get('name', med_data.get('medication', ''))
                        dosage = med_data.get('dosage', '')
                        frequency = med_data.get('frequency', '')
                        
                        if med_name:
                            entry = MedicalHistoryEntry.objects.create(
                                workspace=medical_report.workspace,
                                patient=medical_report.patient,
                                category='medication',
                                title=med_name[:200],
                                description=f'Extracted from {medical_report.report_type}: {medical_report.title}',
                                source='OCR',
                                source_reference_id=f'report_{medical_report.id}',
                                status='active',
                                recorded_date=medical_report.report_date,
                                verified_by_doctor=False,
                                category_data={
                                    'dosage': dosage,
                                    'frequency': frequency,
                                    'report_type': medical_report.report_type,
                                    'ocr_confidence': medical_report.ocr_confidence,
                                    'extracted_from': medical_report.title
                                }
                            )
                            imported_entries.append({
                                'id': entry.id,
                                'category': 'medication',
                                'title': entry.title
                            })
            elif isinstance(medications, str):
                # If it's a string, split and parse
                med_list = re.split(r'[,;\n]+', medications)
                for med in med_list:
                    med = med.strip()
                    if med and len(med) > 2:
                        entry = MedicalHistoryEntry.objects.create(
                            workspace=medical_report.workspace,
                            patient=medical_report.patient,
                            category='medication',
                            title=med[:200],
                            description=f'Extracted from {medical_report.report_type}: {medical_report.title}',
                            source='OCR',
                            source_reference_id=f'report_{medical_report.id}',
                            status='active',
                            recorded_date=medical_report.report_date,
                            verified_by_doctor=False,
                            category_data={
                                'report_type': medical_report.report_type,
                                'ocr_confidence': medical_report.ocr_confidence
                            }
                        )
                        imported_entries.append({
                            'id': entry.id,
                            'category': 'medication',
                            'title': entry.title
                        })
        
        # 2. Extract Diagnoses/Conditions
        if medical_report.extracted_diagnoses:
            diagnoses = medical_report.extracted_diagnoses
            if isinstance(diagnoses, list):
                for diag_data in diagnoses:
                    if isinstance(diag_data, dict):
                        diag_name = diag_data.get('name', diag_data.get('diagnosis', diag_data.get('condition', '')))
                        severity = diag_data.get('severity', 'unknown')
                        
                        if diag_name:
                            entry = MedicalHistoryEntry.objects.create(
                                workspace=medical_report.workspace,
                                patient=medical_report.patient,
                                category='condition',
                                title=diag_name[:200],
                                description=f'Diagnosed in {medical_report.report_type}: {medical_report.title}',
                                source='OCR',
                                source_reference_id=f'report_{medical_report.id}',
                                status='active',
                                recorded_date=medical_report.report_date,
                                verified_by_doctor=False,
                                category_data={
                                    'severity': severity,
                                    'report_type': medical_report.report_type,
                                    'ocr_confidence': medical_report.ocr_confidence,
                                    'diagnosed_date': str(medical_report.report_date)
                                }
                            )
                            imported_entries.append({
                                'id': entry.id,
                                'category': 'condition',
                                'title': entry.title
                            })
            elif isinstance(diagnoses, str):
                diag_list = re.split(r'[,;\n]+', diagnoses)
                for diag in diag_list:
                    diag = diag.strip()
                    if diag and len(diag) > 2:
                        entry = MedicalHistoryEntry.objects.create(
                            workspace=medical_report.workspace,
                            patient=medical_report.patient,
                            category='condition',
                            title=diag[:200],
                            description=f'Diagnosed in {medical_report.report_type}: {medical_report.title}',
                            source='OCR',
                            source_reference_id=f'report_{medical_report.id}',
                            status='active',
                            recorded_date=medical_report.report_date,
                            verified_by_doctor=False,
                            category_data={
                                'report_type': medical_report.report_type,
                                'ocr_confidence': medical_report.ocr_confidence
                            }
                        )
                        imported_entries.append({
                            'id': entry.id,
                            'category': 'condition',
                            'title': entry.title
                        })
        
        # 3. Extract Lab Results
        if medical_report.extracted_test_results:
            test_results = medical_report.extracted_test_results
            if isinstance(test_results, list):
                for test_data in test_results:
                    if isinstance(test_data, dict):
                        test_name = test_data.get('test_name', test_data.get('name', ''))
                        result_value = test_data.get('result', test_data.get('value', ''))
                        unit = test_data.get('unit', '')
                        reference_range = test_data.get('reference_range', test_data.get('normal_range', ''))
                        abnormal = test_data.get('abnormal', False)
                        
                        if test_name:
                            entry = MedicalHistoryEntry.objects.create(
                                workspace=medical_report.workspace,
                                patient=medical_report.patient,
                                category='lab_result',
                                title=test_name[:200],
                                description=f'Lab result from {medical_report.report_type}: {medical_report.title}',
                                source='OCR',
                                source_reference_id=f'report_{medical_report.id}',
                                status='historical',
                                recorded_date=medical_report.report_date,
                                is_critical=abnormal,
                                verified_by_doctor=False,
                                category_data={
                                    'test_name': test_name,
                                    'result_value': result_value,
                                    'unit': unit,
                                    'reference_range': reference_range,
                                    'abnormal': abnormal,
                                    'report_type': medical_report.report_type,
                                    'ocr_confidence': medical_report.ocr_confidence
                                }
                            )
                            imported_entries.append({
                                'id': entry.id,
                                'category': 'lab_result',
                                'title': entry.title
                            })
        
        # 4. Extract Vitals
        if medical_report.extracted_vitals:
            vitals = medical_report.extracted_vitals
            if isinstance(vitals, dict):
                for vital_name, vital_value in vitals.items():
                    if vital_value:
                        entry = MedicalHistoryEntry.objects.create(
                            workspace=medical_report.workspace,
                            patient=medical_report.patient,
                            category='lab_result',
                            title=f'Vital: {vital_name}'[:200],
                            description=f'Vital sign from {medical_report.report_type}: {medical_report.title}',
                            source='OCR',
                            source_reference_id=f'report_{medical_report.id}_vital',
                            status='historical',
                            recorded_date=medical_report.report_date,
                            verified_by_doctor=False,
                            category_data={
                                'vital_type': vital_name,
                                'value': str(vital_value),
                                'report_type': medical_report.report_type,
                                'ocr_confidence': medical_report.ocr_confidence
                            }
                        )
                        imported_entries.append({
                            'id': entry.id,
                            'category': 'lab_result',
                            'title': entry.title
                        })
        
        # 5. Create visit entry for the report itself
        if medical_report.report_type in ['consultation', 'discharge_summary']:
            entry = MedicalHistoryEntry.objects.create(
                workspace=medical_report.workspace,
                patient=medical_report.patient,
                category='visit',
                title=medical_report.title[:200],
                description=medical_report.description or f'{medical_report.report_type} on {medical_report.report_date}',
                source='OCR',
                source_reference_id=f'report_{medical_report.id}',
                status='historical',
                recorded_date=medical_report.report_date,
                verified_by_doctor=False,
                category_data={
                    'visit_type': medical_report.report_type,
                    'report_type': medical_report.report_type,
                    'ocr_processed': True,
                    'has_document': True
                }
            )
            imported_entries.append({
                'id': entry.id,
                'category': 'visit',
                'title': entry.title
            })
        
        # Update or create summary for this workspace
        MedicalHistorySummary.update_summary(medical_report.workspace)
        
        return {
            'success': True,
            'imported_count': len(imported_entries),
            'entries': imported_entries,
            'report_id': medical_report.id,
            'report_title': medical_report.title,
            'report_type': medical_report.report_type
        }
        
    except MedicalReport.DoesNotExist:
        return {'success': False, 'error': 'Medical report not found'}
    except Exception as e:
        return {'success': False, 'error': str(e)}


# ==================== INTEGRATION API ENDPOINTS ====================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def trigger_intake_form_import(request, form_id):
    """
    Manually trigger import from intake form
    Can be called by doctor after reviewing form
    """
    try:
        doctor_profile = DoctorProfile.objects.get(user=request.user)
        intake_form = AIIntakeForm.objects.get(id=form_id, doctor=doctor_profile)
        
        result = import_from_intake_form(form_id)
        
        if result['success']:
            return Response({
                'message': 'Successfully imported medical history from intake form',
                'data': result
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'error': result.get('error', 'Import failed')
            }, status=status.HTTP_400_BAD_REQUEST)
            
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except AIIntakeForm.DoesNotExist:
        return Response({'error': 'Intake form not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def trigger_medical_report_import(request, report_id):
    """
    Manually trigger import from medical report
    Can be called by doctor or patient after OCR completes
    """
    try:
        # Verify access (doctor or patient)
        medical_report = None
        try:
            doctor_profile = DoctorProfile.objects.get(user=request.user)
            medical_report = MedicalReport.objects.get(
                id=report_id,
                workspace__doctor=doctor_profile
            )
        except DoctorProfile.DoesNotExist:
            patient_profile = PatientProfile.objects.get(user=request.user)
            medical_report = MedicalReport.objects.get(
                id=report_id,
                patient=patient_profile
            )
        
        result = import_from_medical_report(report_id)
        
        if result['success']:
            return Response({
                'message': 'Successfully imported medical history from report',
                'data': result
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'error': result.get('error', 'Import failed')
            }, status=status.HTTP_400_BAD_REQUEST)
            
    except (DoctorProfile.DoesNotExist, PatientProfile.DoesNotExist):
        return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except MedicalReport.DoesNotExist:
        return Response({'error': 'Medical report not found or no access'}, status=status.HTTP_404_NOT_FOUND)


# ==================== AUTO-IMPORT WITH GROQ AI ====================

def analyze_with_groq_ai(content, content_type):
    """
    Use Groq AI to extract structured medical history from content
    content_type: 'intake_form' or 'medical_report'
    """
    groq_api_key = os.getenv('GROQ_API_KEY')
    if not groq_api_key:
        return {'error': 'GROQ_API_KEY not configured', 'entries': []}
    
    if content_type == 'intake_form':
        prompt = f"""Analyze this patient intake form response and extract structured medical history.

Intake Form Data:
{content}

Extract medical history entries if present:
1. Medical Conditions (chronic diseases, ongoing health issues)
2. Current Medications (with dosage if mentioned)
3. Allergies (drug allergies, food allergies)
4. Past Surgeries (surgical history)
5. Recent Doctor Visits
6. Lab Results mentioned

For each item provide:
- category: one of [condition, medication, allergy, surgery, visit, lab_result]
- title: brief descriptive title
- description: detailed information
- status: active, resolved, or historical
- is_critical: true/false
- severity: low, moderate, high, critical
- notes: additional context

Respond ONLY with valid JSON:
{{
    "entries": [
        {{
            "category": "condition",
            "title": "Condition name",
            "description": "Details",
            "status": "active",
            "is_critical": false,
            "severity": "moderate",
            "notes": "Context"
        }}
    ]
}}"""
    else:  # medical_report
        prompt = f"""Analyze this medical report and extract structured medical history.

Medical Report:
{content}

Extract medical history entries:
1. Diagnoses or Medical Conditions
2. Medications prescribed
3. Allergies noted
4. Procedures or Surgeries
5. Lab Results with values
6. Clinical findings

For each item provide:
- category: one of [condition, medication, allergy, surgery, visit, lab_result]
- title: brief descriptive title
- description: detailed information with values for lab results
- status: active, resolved, or historical
- is_critical: true/false
- severity: low, moderate, high, critical
- notes: reference to report

Respond ONLY with valid JSON:
{{
    "entries": [
        {{
            "category": "lab_result",
            "title": "Test name",
            "description": "Results with values",
            "status": "active",
            "is_critical": false,
            "severity": "low",
            "notes": "From report"
        }}
    ]
}}"""

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {groq_api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "llama-3.1-70b-versatile",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a medical AI that extracts structured medical history. Respond with valid JSON only."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.2,
                "max_tokens": 2500
            },
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            ai_text = result['choices'][0]['message']['content']
            
            # Clean markdown
            if '```json' in ai_text:
                ai_text = ai_text.split('```json')[1].split('```')[0].strip()
            elif '```' in ai_text:
                ai_text = ai_text.split('```')[1].split('```')[0].strip()
            
            return json.loads(ai_text)
        else:
            return {'error': f'Groq API error: {response.status_code}', 'entries': []}
    except Exception as e:
        return {'error': str(e), 'entries': []}


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def auto_sync_workspace(request, workspace_id):
    """
    Auto-sync medical history from all intake forms and reports in workspace
    """
    try:
        workspace = None
        try:
            doctor_profile = DoctorProfile.objects.get(user=request.user)
            workspace = DoctorPatientWorkspace.objects.get(id=workspace_id, doctor=doctor_profile)
        except DoctorProfile.DoesNotExist:
            patient_profile = PatientProfile.objects.get(user=request.user)
            workspace = DoctorPatientWorkspace.objects.get(id=workspace_id, patient=patient_profile)
        
        results = {
            'intake_forms_processed': 0,
            'reports_processed': 0,
            'entries_created': 0,
            'errors': []
        }
        
        # Process completed intake forms
        intake_forms = IntakeFormResponse.objects.filter(form__workspace=workspace, is_complete=True)
        
        for response in intake_forms:
            # Check if already imported
            existing = MedicalHistoryEntry.objects.filter(
                workspace=workspace,
                source='INTAKE',
                source_reference_id=f'intake_form_{response.form.id}'
            ).exists()
            
            if not existing:
                try:
                    content = json.dumps({
                        'form_title': response.form.title,
                        'form_description': response.form.description,
                        'response_data': response.response_data
                    }, indent=2)
                    
                    analysis = analyze_with_groq_ai(content, 'intake_form')
                    
                    if 'error' not in analysis or not analysis['error']:
                        for entry_data in analysis.get('entries', []):
                            MedicalHistoryEntry.objects.create(
                                workspace=workspace,
                                patient=workspace.patient,
                                doctor=workspace.doctor,
                                category=entry_data.get('category', 'visit'),
                                title=entry_data.get('title', 'Untitled Entry'),
                                description=entry_data.get('description', ''),
                                status=entry_data.get('status', 'active'),
                                severity=entry_data.get('severity', 'low'),
                                is_critical=entry_data.get('is_critical', False),
                                verified_by_doctor=False,
                                doctor_notes=entry_data.get('notes', f'From: {response.form.title}'),
                                source='INTAKE',
                                source_reference_id=f'intake_form_{response.form.id}'
                            )
                            results['entries_created'] += 1
                        results['intake_forms_processed'] += 1
                except Exception as e:
                    results['errors'].append(f"Form {response.form.id}: {str(e)}")
        
        # Process OCR-completed reports
        reports = MedicalReport.objects.filter(
            workspace=workspace,
            status__in=['ready_for_review', 'reviewed'],
            ocr_processed=True
        )
        
        for report in reports:
            existing = MedicalHistoryEntry.objects.filter(
                workspace=workspace,
                source='OCR',
                source_reference_id=f'medical_report_{report.id}'
            ).exists()
            
            if not existing:
                try:
                    content = f"""Title: {report.title}
Type: {report.get_report_type_display()}
Date: {report.report_date}

OCR Text:
{report.ocr_text}
"""
                    if report.ai_analysis:
                        content += f"\nAI Analysis:\n{json.dumps(report.ai_analysis, indent=2)}"
                    
                    analysis = analyze_with_groq_ai(content, 'medical_report')
                    
                    if 'error' not in analysis or not analysis['error']:
                        for entry_data in analysis.get('entries', []):
                            MedicalHistoryEntry.objects.create(
                                workspace=workspace,
                                patient=workspace.patient,
                                doctor=workspace.doctor,
                                category=entry_data.get('category', 'lab_result'),
                                title=entry_data.get('title', 'Untitled Entry'),
                                description=entry_data.get('description', ''),
                                recorded_date=report.report_date,
                                status=entry_data.get('status', 'historical'),
                                severity=entry_data.get('severity', 'low'),
                                is_critical=entry_data.get('is_critical', False),
                                verified_by_doctor=False,
                                doctor_notes=entry_data.get('notes', f'From: {report.title}'),
                                source='OCR',
                                source_reference_id=f'medical_report_{report.id}',
                                category_data={'report_id': report.id, 'report_type': report.report_type}
                            )
                            results['entries_created'] += 1
                        results['reports_processed'] += 1
                except Exception as e:
                    results['errors'].append(f"Report {report.id}: {str(e)}")
        
        # Update summary
        if results['entries_created'] > 0:
            update_summary(workspace.patient)
        
        return Response({
            'message': 'Auto-sync completed',
            'results': results
        }, status=status.HTTP_200_OK)
        
    except (DoctorProfile.DoesNotExist, PatientProfile.DoesNotExist):
        return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except DoctorPatientWorkspace.DoesNotExist:
        return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_sync_status(request, workspace_id):
    """Get auto-sync status for workspace"""
    try:
        workspace = None
        try:
            doctor_profile = DoctorProfile.objects.get(user=request.user)
            workspace = DoctorPatientWorkspace.objects.get(id=workspace_id, doctor=doctor_profile)
        except DoctorProfile.DoesNotExist:
            patient_profile = PatientProfile.objects.get(user=request.user)
            workspace = DoctorPatientWorkspace.objects.get(id=workspace_id, patient=patient_profile)
        
        total_forms = IntakeFormResponse.objects.filter(form__workspace=workspace, is_complete=True).count()
        imported_forms = MedicalHistoryEntry.objects.filter(workspace=workspace, source='INTAKE').values('source_reference_id').distinct().count()
        
        total_reports = MedicalReport.objects.filter(workspace=workspace, status__in=['ready_for_review', 'reviewed'], ocr_processed=True).count()
        imported_reports = MedicalHistoryEntry.objects.filter(workspace=workspace, source='OCR').values('source_reference_id').distinct().count()
        
        total_entries = MedicalHistoryEntry.objects.filter(workspace=workspace).count()
        
        return Response({
            'intake_forms': {
                'total_completed': total_forms,
                'imported': imported_forms,
                'pending': total_forms - imported_forms
            },
            'medical_reports': {
                'total_processed': total_reports,
                'imported': imported_reports,
                'pending': total_reports - imported_reports
            },
            'total_entries': total_entries,
            'needs_sync': (total_forms - imported_forms) > 0 or (total_reports - imported_reports) > 0
        }, status=status.HTTP_200_OK)
        
    except (DoctorProfile.DoesNotExist, PatientProfile.DoesNotExist):
        return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except DoctorPatientWorkspace.DoesNotExist:
        return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)


def update_summary(patient):
    """Update medical history summary"""
    try:
        entries = MedicalHistoryEntry.objects.filter(patient=patient)
        
        summary_data = {
            'patient': patient,
            'total_conditions': entries.filter(category='condition').count(),
            'active_conditions': entries.filter(category='condition', status='active').count(),
            'total_medications': entries.filter(category='medication').count(),
            'current_medications': entries.filter(category='medication', status='active').count(),
            'total_allergies': entries.filter(category='allergy').count(),
            'active_allergies': entries.filter(category='allergy', status='active').count(),
            'total_surgeries': entries.filter(category='surgery').count(),
            'past_surgeries': entries.filter(category='surgery').count(),
            'total_visits': entries.filter(category='visit').count(),
            'total_lab_results': entries.filter(category='lab_result').count(),
            'critical_items_count': entries.filter(is_critical=True, status='active').count(),
            'unverified_count': entries.filter(verified_by_doctor=False).count(),
        }
        
        completeness_score = min(100, (
            (summary_data['total_conditions'] > 0) * 20 +
            (summary_data['total_medications'] > 0) * 20 +
            (summary_data['total_allergies'] > 0) * 15 +
            (summary_data['total_surgeries'] > 0) * 15 +
            (summary_data['total_visits'] > 0) * 15 +
            (summary_data['total_lab_results'] > 0) * 15
        ))
        summary_data['completeness_score'] = completeness_score
        
        MedicalHistorySummary.objects.update_or_create(
            patient=patient,
            defaults=summary_data
        )
    except Exception as e:
        print(f"Error updating summary: {str(e)}")


# ==================== NEW ENHANCED API ENDPOINTS ====================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unified_timeline_view(request, workspace_id):
    """
    Get unified timeline merging ALL data sources:
    - AI Intake Forms
    - Medical Reports (OCR processed)
    - Medical History Entries (all categories)
    - Doctor Visits
    
    Returns chronologically sorted timeline items
    """
    try:
        # Verify access
        doctor_profile = DoctorProfile.objects.get(user=request.user)
        workspace = DoctorPatientWorkspace.objects.get(
            id=workspace_id,
            doctor=doctor_profile
        )
        
        timeline_items = []
        
        # 1. Get all medical history entries
        from patient.models import AIIntakeForm, MedicalReport
        
        history_entries = MedicalHistoryEntry.objects.filter(
            workspace=workspace
        ).order_by('-recorded_date')
        
        for entry in history_entries:
            icon_map = {
                'condition': '🏥',
                'medication': '💊',
                'allergy': '⚠️',
                'surgery': '🔬',
                'visit': '👨‍⚕️',
                'lab_result': '🧪',
            }
            
            timeline_items.append({
                'id': f'entry_{entry.id}',
                'date': entry.recorded_date or entry.start_date,
                'type': entry.category,
                'icon': icon_map.get(entry.category, '📄'),
                'title': entry.title,
                'summary': entry.description[:200] if entry.description else '',
                'source': entry.get_source_display(),
                'source_type': 'history_entry',
                'is_abnormal': entry.category_data.get('is_abnormal', False) if entry.category == 'lab_result' else False,
                'is_critical': entry.is_critical,
                'entry_id': entry.id,
                'detail_link': f'/history/entry/{entry.id}/',
                'metadata': {
                    'category': entry.category,
                    'status': entry.status,
                    'verified': entry.verified_by_doctor,
                    'trending': entry.trending_direction if hasattr(entry, 'trending_direction') else 'unknown'
                }
            })
        
        # 2. Get AI Intake Forms
        intake_forms = AIIntakeForm.objects.filter(
            workspace=workspace,
            status__in=['submitted', 'reviewed']
        )
        
        for form in intake_forms:
            timeline_items.append({
                'id': f'intake_{form.id}',
                'date': form.submitted_at or form.created_at,
                'type': 'intake',
                'icon': '📋',
                'title': form.title,
                'summary': f'Patient completed intake form. Status: {form.get_status_display()}',
                'source': 'AI Intake Form',
                'source_type': 'intake_form',
                'is_abnormal': False,
                'is_critical': False,
                'entry_id': form.id,
                'detail_link': f'/intake-form/{form.id}/',
                'metadata': {
                    'status': form.status,
                    'has_ai_analysis': bool(form.ai_analysis)
                }
            })
        
        # 3. Get Medical Reports
        reports = MedicalReport.objects.filter(
            workspace=workspace
        ).order_by('-report_date')
        
        for report in reports:
            timeline_items.append({
                'id': f'report_{report.id}',
                'date': report.report_date,
                'type': 'report',
                'icon': '📄',
                'title': report.title,
                'summary': report.ai_summary[:200] if report.ai_summary else report.description[:200],
                'source': f'OCR Report - {report.get_report_type_display()}',
                'source_type': 'medical_report',
                'is_abnormal': report.is_critical or report.requires_action,
                'is_critical': report.is_critical,
                'entry_id': report.id,
                'detail_link': f'/report/{report.id}/',
                'metadata': {
                    'report_type': report.report_type,
                    'ocr_processed': report.ocr_processed,
                    'ai_processed': report.ai_processed,
                    'reviewed': report.reviewed_by_doctor
                }
            })
        
        # Sort all items by date (newest first)
        timeline_items.sort(key=lambda x: x['date'] if x['date'] else datetime.min.date(), reverse=True)
        
        # Apply filters
        type_filter = request.GET.get('type')
        if type_filter:
            timeline_items = [item for item in timeline_items if item['type'] == type_filter]
        
        critical_only = request.GET.get('critical_only')
        if critical_only == 'true':
            timeline_items = [item for item in timeline_items if item['is_critical']]
        
        # Pagination
        page_size = int(request.GET.get('page_size', 20))
        page = int(request.GET.get('page', 1))
        start = (page - 1) * page_size
        end = start + page_size
        
        paginated_items = timeline_items[start:end]
        
        return Response({
            'timeline_items': paginated_items,
            'total_count': len(timeline_items),
            'page': page,
            'page_size': page_size,
            'total_pages': (len(timeline_items) + page_size - 1) // page_size,
            'date_range': {
                'start': min([item['date'] for item in timeline_items if item['date']]).isoformat() if timeline_items else None,
                'end': max([item['date'] for item in timeline_items if item['date']]).isoformat() if timeline_items else None
            }
        })
        
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except DoctorPatientWorkspace.DoesNotExist:
        return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def clinical_summary_view(request, workspace_id):
    """
    Get AI-generated comprehensive clinical summary
    Includes:
    - Patient overview
    - Active conditions
    - Current medications
    - Risk assessment
    - Trends detected
    - Focus points for doctor
    """
    try:
        doctor_profile = DoctorProfile.objects.get(user=request.user)
        workspace = DoctorPatientWorkspace.objects.get(
            id=workspace_id,
            doctor=doctor_profile
        )
        
        # Get or create summary
        summary, created = MedicalHistorySummary.objects.get_or_create(
            workspace=workspace,
            patient=workspace.patient
        )
        
        # Check if AI summary needs refresh (older than 24 hours or doesn't exist)
        needs_refresh = (
            not summary.ai_clinical_summary or
            not summary.ai_last_generated or
            (datetime.now() - summary.ai_last_generated.replace(tzinfo=None)).days >= 1
        )
        
        force_refresh = request.GET.get('force_refresh') == 'true'
        
        if needs_refresh or force_refresh:
            # Refresh base statistics first
            summary.refresh_summary()
            # Generate AI summary
            summary.generate_ai_summary()
        
        # Calculate patient age
        patient_age = None
        if workspace.patient.date_of_birth:
            from datetime import date
            today = date.today()
            patient_age = today.year - workspace.patient.date_of_birth.year - (
                (today.month, today.day) < (workspace.patient.date_of_birth.month, workspace.patient.date_of_birth.day)
            )
        
        # Build response
        response_data = {
            'generated_at': summary.ai_last_generated or summary.last_updated,
            'patient_name': workspace.patient.full_name,
            'patient_age': patient_age,
            'patient_gender': workspace.patient.gender or 'Unknown',
            
            'clinical_summary': summary.ai_clinical_summary or 'Clinical summary not yet generated',
            
            'active_conditions': summary.active_conditions_list,
            'active_conditions_count': summary.active_conditions,
            
            'current_medications': summary.current_medications_list,
            'medications_count': summary.current_medications,
            
            'allergies': summary.all_allergies_list,
            'allergies_count': summary.total_allergies,
            
            'risk_assessment': summary.ai_risk_assessment or {},
            'trends_detected': summary.ai_trends_detected or [],
            'focus_points': summary.ai_focus_points or [],
            
            'stats': {
                'total_conditions': summary.total_conditions,
                'active_conditions': summary.active_conditions,
                'total_medications': summary.total_medications,
                'current_medications': summary.current_medications,
                'total_allergies': summary.total_allergies,
                'total_surgeries': summary.total_surgeries,
                'total_visits': summary.total_visits,
                'total_lab_results': summary.total_lab_results,
                'has_chronic_conditions': summary.has_chronic_conditions,
                'has_critical_allergies': summary.has_critical_allergies,
                'requires_monitoring': summary.requires_monitoring,
                'last_visit_date': summary.last_visit_date,
                'completeness_score': summary.completeness_score,
                'unverified_entries': summary.unverified_entries_count,
                'critical_alerts': summary.critical_alerts_count
            }
        }
        
        return Response(response_data)
        
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except DoctorPatientWorkspace.DoesNotExist:
        return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def regenerate_ai_summary(request, workspace_id):
    """
    Force regenerate AI clinical summary
    """
    try:
        doctor_profile = DoctorProfile.objects.get(user=request.user)
        workspace = DoctorPatientWorkspace.objects.get(
            id=workspace_id,
            doctor=doctor_profile
        )
        
        summary, _ = MedicalHistorySummary.objects.get_or_create(
            workspace=workspace,
            patient=workspace.patient
        )
        
        # Refresh statistics
        summary.refresh_summary()
        
        # Generate AI summary
        result = summary.generate_ai_summary()
        
        if result:
            return Response({
                'success': True,
                'message': 'AI summary regenerated successfully',
                'generated_at': summary.ai_last_generated
            })
        else:
            return Response({
                'success': False,
                'message': 'Failed to generate AI summary. Check Groq API configuration.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except DoctorPatientWorkspace.DoesNotExist:
        return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def parameter_trend_view(request, workspace_id, parameter_name):
    """
    Get trending data for a specific parameter (e.g., HbA1c, Glucose, Blood Pressure)
    Returns time series data and AI analysis
    """
    try:
        doctor_profile = DoctorProfile.objects.get(user=request.user)
        workspace = DoctorPatientWorkspace.objects.get(
            id=workspace_id,
            doctor=doctor_profile
        )
        
        from .models import ClinicalTrend
        
        # Try to find existing trend
        trend = ClinicalTrend.objects.filter(
            workspace=workspace,
            parameter_name__icontains=parameter_name
        ).first()
        
        if not trend:
            # Create trend from history entries
            lab_entries = MedicalHistoryEntry.objects.filter(
                workspace=workspace,
                category='lab_result',
                title__icontains=parameter_name
            ).order_by('start_date')
            
            if not lab_entries.exists():
                return Response({
                    'error': f'No data found for parameter: {parameter_name}'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Create new trend
            trend = ClinicalTrend.objects.create(
                workspace=workspace,
                patient=workspace.patient,
                trend_type='lab_value',
                parameter_name=parameter_name
            )
            
            # Add data points
            for entry in lab_entries:
                if entry.last_value or entry.category_data.get('value'):
                    value = entry.last_value or entry.category_data.get('value')
                    is_abnormal = entry.category_data.get('is_abnormal', False)
                    trend.add_data_point(
                        date=entry.start_date or entry.recorded_date,
                        value=value,
                        is_abnormal=is_abnormal,
                        source=entry.source
                    )
            
            # Analyze trend
            trend.analyze_trend()
        
        # Generate AI interpretation if not exists
        if not trend.ai_interpretation:
            trend.generate_ai_interpretation()
        
        # Build chart data
        chart_data = {
            'labels': [point['date'] for point in trend.data_points],
            'values': [point['value'] for point in trend.data_points],
            'abnormal_flags': [point['is_abnormal'] for point in trend.data_points]
        }
        
        response_data = {
            'parameter_name': trend.parameter_name,
            'parameter_unit': trend.parameter_unit,
            'data_points': trend.data_points,
            'trend_direction': trend.trend_direction,
            'latest_value': trend.latest_value,
            'latest_date': trend.latest_value_date,
            'is_abnormal': trend.is_currently_abnormal,
            'reference_range': trend.reference_range_text,
            'ai_interpretation': trend.ai_interpretation,
            'clinical_significance': trend.clinical_significance,
            'chart_data': chart_data
        }
        
        return Response(response_data)
        
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except DoctorPatientWorkspace.DoesNotExist:
        return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def category_detailed_view(request, workspace_id, category):
    """
    Get detailed view for specific category with enhanced data
    """
    try:
        doctor_profile = DoctorProfile.objects.get(user=request.user)
        workspace = DoctorPatientWorkspace.objects.get(
            id=workspace_id,
            doctor=doctor_profile
        )
        
        valid_categories = dict(MedicalHistoryEntry.CATEGORY_CHOICES).keys()
        if category not in valid_categories:
            return Response({
                'error': f'Invalid category. Valid: {", ".join(valid_categories)}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        entries = MedicalHistoryEntry.objects.filter(
            workspace=workspace,
            category=category
        ).order_by('-recorded_date')
        
        # Apply filters
        status_filter = request.GET.get('status')
        if status_filter:
            entries = entries.filter(status=status_filter)
        
        serializer = MedicalHistoryEntrySerializer(entries, many=True)
        
        # Calculate statistics
        total_count = entries.count()
        active_count = entries.filter(status='active').count()
        verified_count = entries.filter(verified_by_doctor=True).count()
        critical_count = entries.filter(is_critical=True).count()
        
        return Response({
            'category': category,
            'category_display': dict(MedicalHistoryEntry.CATEGORY_CHOICES)[category],
            'total_count': total_count,
            'active_count': active_count,
            'verified_count': verified_count,
            'critical_count': critical_count,
            'entries': serializer.data
        })
        
    except DoctorProfile.DoesNotExist:
        return Response({'error': 'Doctor profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except DoctorPatientWorkspace.DoesNotExist:
        return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
