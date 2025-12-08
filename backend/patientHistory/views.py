from django.shortcuts import render
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q, Count, Case, When, IntegerField
from datetime import datetime, date, timedelta

from .models import MedicalHistoryEntry, MedicalHistoryTimeline, MedicalHistorySummary
from .serializers import (
    MedicalHistoryEntrySerializer,
    MedicalHistoryTimelineSerializer,
    MedicalHistorySummarySerializer,
    DoctorAddHistorySerializer,
    BulkHistoryImportSerializer
)
from patient.models import DoctorPatientWorkspace, PatientProfile
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
                            source_reference=f'intake_form_{intake_form.id}',
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
                            source_reference=f'intake_form_{intake_form.id}',
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
                            source_reference=f'intake_form_{intake_form.id}',
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
                            source_reference=f'intake_form_{intake_form.id}',
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
                            source_reference=f'intake_form_{intake_form.id}_ai',
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
                            source_reference=f'intake_form_{intake_form.id}_symptom',
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
                                source_reference=f'report_{medical_report.id}',
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
                            source_reference=f'report_{medical_report.id}',
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
                                source_reference=f'report_{medical_report.id}',
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
                            source_reference=f'report_{medical_report.id}',
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
                                source_reference=f'report_{medical_report.id}',
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
                            source_reference=f'report_{medical_report.id}_vital',
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
                source_reference=f'report_{medical_report.id}',
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
