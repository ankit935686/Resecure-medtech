from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes, parser_classes, authentication_classes
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django.contrib.auth import login
from django.contrib.auth.models import User
from django.views.decorators.csrf import ensure_csrf_cookie
from django.db.models import Q
from datetime import datetime
import os
import json
import requests
import PyPDF2
from typing import Dict, List
from .models import (
    PatientProfile,
    PatientDoctorConnection,
    ConnectionToken,
    DoctorPatientWorkspace,
    MedicalReport,
    ReportComment,
    DoctorPatientTimelineEntry,
)
from doctor.models import DoctorProfile
from django.utils import timezone
from .serializers import (
    PatientSignupSerializer,
    PatientLoginSerializer,
    PatientProfileSerializer,
    PatientProfileUpdateSerializer,
    UserSerializer,
    # Profile Setup Serializers
    ConsentSerializer,
    Step1BasicInfoSerializer,
    Step2HealthSnapshotSerializer,
    Step3PreferencesSerializer,
    PatientProfileSetupSerializer,
    # Doctor Linking Serializers
    DoctorSearchSerializer,
    PatientDoctorConnectionSerializer,
    CreateConnectionRequestSerializer,
    # Workspace Serializers
    DoctorPatientWorkspaceSummarySerializer,
    DoctorPatientWorkspaceDetailSerializer,
    # Medical Report Serializers
    MedicalReportListSerializer,
    MedicalReportDetailSerializer,
    MedicalReportCreateSerializer,
    MedicalReportUpdateSerializer,
    ReportCommentSerializer,
)


# ===========================
# AI Analysis Helper Functions
# ===========================

def analyze_patient_responses(form_data: Dict, response_data: Dict) -> Dict:
    """Analyze patient's responses and generate insights for the doctor"""
    
    insights = {
        'analyzed_at': datetime.now().isoformat(),
        'overall_summary': '',
        'key_findings': [],
        'symptoms_identified': [],
        'conditions_mentioned': [],
        'urgency_level': 'routine',  # routine, moderate, urgent, critical
        'suggested_actions': [],
        'red_flags': [],
        'detailed_analysis': {}
    }
    
    # Extract form fields
    fields = form_data.get('form_schema', {}).get('fields', [])
    
    # Symptom detection keywords
    symptom_keywords = [
        'pain', 'ache', 'hurt', 'sore', 'discomfort', 'burning', 'sharp',
        'fever', 'cough', 'nausea', 'vomiting', 'dizzy', 'headache',
        'fatigue', 'tired', 'weak', 'bleeding', 'swelling', 'rash',
        'difficulty', 'unable', 'breathing', 'chest', 'severe'
    ]
    
    # Urgency keywords
    urgent_keywords = [
        'severe', 'extreme', 'unbearable', 'emergency', 'critical',
        'sudden', 'chest pain', 'difficulty breathing', 'blood',
        'unconscious', 'seizure', 'suicide', 'heart'
    ]
    
    # Chronic condition keywords
    chronic_keywords = [
        'diabetes', 'hypertension', 'asthma', 'copd', 'heart disease',
        'cancer', 'kidney', 'liver', 'arthritis', 'depression', 'anxiety'
    ]
    
    # Analyze each response
    for field in fields:
        field_id = field.get('id')
        field_label = field.get('label', '')
        field_value = response_data.get(field_id, '')
        
        if not field_value:
            continue
        
        answer_lower = str(field_value).lower()
        
        field_analysis = {
            'question': field_label,
            'answer': field_value,
            'sentiment': 'neutral',
            'keywords': [],
            'concerns': [],
            'notes': ''
        }
        
        # Check for symptoms
        found_symptoms = [kw for kw in symptom_keywords if kw in answer_lower]
        if found_symptoms:
            field_analysis['keywords'].extend(found_symptoms)
            field_analysis['sentiment'] = 'concerning'
            insights['symptoms_identified'].extend(found_symptoms)
        
        # Check for urgent indicators
        found_urgent = [kw for kw in urgent_keywords if kw in answer_lower]
        if found_urgent:
            field_analysis['concerns'].extend([f"Urgent keyword: {kw}" for kw in found_urgent])
            field_analysis['sentiment'] = 'critical'
            insights['red_flags'].extend(found_urgent)
        
        # Check for chronic conditions
        found_chronic = [kw for kw in chronic_keywords if kw in answer_lower]
        if found_chronic:
            field_analysis['keywords'].extend(found_chronic)
            insights['conditions_mentioned'].extend(found_chronic)
        
        # Generate notes
        if field_analysis['concerns']:
            field_analysis['notes'] = f"⚠️ This response contains urgent indicators. Requires immediate attention."
        elif found_symptoms:
            field_analysis['notes'] = f"Patient mentions: {', '.join(found_symptoms[:3])}"
        elif found_chronic:
            field_analysis['notes'] = f"Chronic condition mentioned: {', '.join(found_chronic)}"
        
        insights['detailed_analysis'][field_id] = field_analysis
    
    # Remove duplicates
    insights['symptoms_identified'] = list(set(insights['symptoms_identified']))[:10]
    insights['conditions_mentioned'] = list(set(insights['conditions_mentioned']))[:10]
    insights['red_flags'] = list(set(insights['red_flags']))[:10]
    
    # Generate overall summary
    summary_parts = []
    concerning_count = sum(
        1 for analysis in insights['detailed_analysis'].values()
        if analysis.get('sentiment') in ['concerning', 'critical']
    )
    
    if concerning_count > 0:
        summary_parts.append(f"⚠️ {concerning_count} responses require attention.")
    
    if insights['symptoms_identified']:
        summary_parts.append(f"Key symptoms: {', '.join(insights['symptoms_identified'][:5])}")
    
    if insights['red_flags']:
        summary_parts.append(f"🚨 {len(insights['red_flags'])} urgent indicators detected.")
    
    if not summary_parts:
        summary_parts.append("Form completed. Standard follow-up recommended.")
    
    insights['overall_summary'] = " ".join(summary_parts)
    
    # Determine urgency level
    critical_count = sum(
        1 for analysis in insights['detailed_analysis'].values()
        if analysis.get('sentiment') == 'critical'
    )
    
    if critical_count > 0:
        insights['urgency_level'] = 'critical'
        insights['suggested_actions'].append('Immediate doctor review required')
    elif concerning_count >= 3:
        insights['urgency_level'] = 'urgent'
        insights['suggested_actions'].append('Schedule urgent consultation')
    elif concerning_count >= 1:
        insights['urgency_level'] = 'moderate'
        insights['suggested_actions'].append('Schedule follow-up within 1 week')
    else:
        insights['suggested_actions'].append('Routine follow-up as scheduled')
    
    return insights


# ===========================
# OCR Helper Functions
# ===========================

def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from PDF file"""
    try:
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text_parts = []
            
            for page in pdf_reader.pages:
                text_parts.append(page.extract_text())
            
            return '\n'.join(text_parts)
    except Exception as e:
        print(f"PDF extraction error: {e}")
        return ""


def extract_medical_info_from_text(text: str) -> Dict:
    """Extract structured medical information from text"""
    
    medical_info = {
        'medications': [],
        'diagnoses': [],
        'test_results': [],
        'vital_signs': {},
        'allergies': [],
        'procedures': []
    }
    
    if not text:
        return medical_info
    
    text_lower = text.lower()
    lines = text.split('\n')
    
    # Common medication keywords
    med_keywords = ['tablet', 'capsule', 'mg', 'ml', 'injection', 'syrup', 
                   'drops', 'cream', 'ointment', 'dose', 'dosage', 'prescription']
    
    # Diagnosis keywords
    diagnosis_keywords = ['diagnosis', 'diagnosed with', 'condition', 'disease']
    
    # Test result keywords
    test_keywords = ['test', 'result', 'report', 'lab', 'blood', 'urine', 
                    'x-ray', 'mri', 'ct scan', 'ultrasound']
    
    # Vital signs patterns
    vital_keywords = {
        'blood_pressure': ['bp', 'blood pressure', 'systolic', 'diastolic'],
        'heart_rate': ['hr', 'heart rate', 'pulse', 'bpm'],
        'temperature': ['temp', 'temperature', '°f', '°c', 'fever'],
        'weight': ['weight', 'kg', 'lbs'],
        'height': ['height', 'cm', 'feet', 'inches']
    }
    
    # Process each line
    for line in lines:
        line_lower = line.lower().strip()
        
        if not line_lower or len(line_lower) < 3:
            continue
        
        # Extract medications
        if any(kw in line_lower for kw in med_keywords):
            medical_info['medications'].append(line.strip())
        
        # Extract diagnoses
        if any(kw in line_lower for kw in diagnosis_keywords):
            medical_info['diagnoses'].append(line.strip())
        
        # Extract test results
        if any(kw in line_lower for kw in test_keywords):
            medical_info['test_results'].append(line.strip())
        
        # Extract vital signs
        for vital, keywords in vital_keywords.items():
            if any(kw in line_lower for kw in keywords):
                medical_info['vital_signs'][vital] = line.strip()
        
        # Extract allergies
        if 'allerg' in line_lower:
            medical_info['allergies'].append(line.strip())
    
    # Clean up - remove duplicates and limit entries
    for key in medical_info:
        if isinstance(medical_info[key], list):
            medical_info[key] = list(set([item for item in medical_info[key] if item and len(item) > 3]))[:10]
    
    return medical_info


def process_document_ocr(upload_instance):
    """Process a single uploaded document with OCR and extract medical information"""
    try:
        file_path = upload_instance.file.path
        file_type = upload_instance.file_type or ''
        
        extracted_text = ''
        
        # Extract text based on file type
        if 'pdf' in file_type.lower():
            extracted_text = extract_text_from_pdf(file_path)
        elif 'image' in file_type.lower():
            # Placeholder for image OCR - would need pytesseract
            extracted_text = "[Image OCR - Install pytesseract for full functionality]"
        
        if extracted_text:
            # Extract medical information
            medical_data = extract_medical_info_from_text(extracted_text)
            
            # Update upload instance
            upload_instance.ocr_processed = True
            upload_instance.ocr_text = extracted_text[:5000]  # Store first 5000 chars
            upload_instance.ocr_medical_data = medical_data
            upload_instance.ocr_confidence = 0.85  # Placeholder confidence
            upload_instance.save()
            
            return {
                'success': True,
                'text_length': len(extracted_text),
                'medical_data': medical_data
            }
    except Exception as e:
        print(f"OCR processing error: {e}")
        return {'success': False, 'error': str(e)}


def aggregate_form_ocr_results(form_instance):
    """Aggregate OCR results from all documents uploaded to a form"""
    from .models import IntakeFormUpload
    
    uploads = IntakeFormUpload.objects.filter(form=form_instance)
    
    aggregated = {
        'total_documents': uploads.count(),
        'processed_documents': 0,
        'all_medications': [],
        'all_diagnoses': [],
        'all_test_results': [],
        'all_allergies': [],
        'vital_signs': {},
        'extracted_texts': []
    }
    
    for upload in uploads:
        if upload.ocr_processed and upload.ocr_medical_data:
            aggregated['processed_documents'] += 1
            
            # Aggregate medical data
            medical_data = upload.ocr_medical_data
            aggregated['all_medications'].extend(medical_data.get('medications', []))
            aggregated['all_diagnoses'].extend(medical_data.get('diagnoses', []))
            aggregated['all_test_results'].extend(medical_data.get('test_results', []))
            aggregated['all_allergies'].extend(medical_data.get('allergies', []))
            
            # Merge vital signs
            if medical_data.get('vital_signs'):
                aggregated['vital_signs'].update(medical_data['vital_signs'])
            
            # Store reference to extracted text
            if upload.ocr_text:
                aggregated['extracted_texts'].append({
                    'file_name': upload.file_name,
                    'text_preview': upload.ocr_text[:200]
                })
    
    # Remove duplicates
    aggregated['all_medications'] = list(set(aggregated['all_medications']))[:20]
    aggregated['all_diagnoses'] = list(set(aggregated['all_diagnoses']))[:20]
    aggregated['all_test_results'] = list(set(aggregated['all_test_results']))[:20]
    aggregated['all_allergies'] = list(set(aggregated['all_allergies']))[:10]
    
    return aggregated


@ensure_csrf_cookie
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def patient_signup(request):
    """Patient signup endpoint"""
    serializer = PatientSignupSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        
        # Authenticate the user to set the backend attribute
        from django.contrib.auth import authenticate
        authenticated_user = authenticate(
            request,
            username=user.username,
            password=request.data.get('password')
        )
        
        if authenticated_user:
            # Log the user in (creates session)
            login(request, authenticated_user)
            
            # Get patient profile
            patient_profile = authenticated_user.patient_profile
            
            return Response({
                'message': 'Patient account created successfully',
                'user': UserSerializer(authenticated_user).data,
                'profile': PatientProfileSerializer(patient_profile).data,
                'profile_completed': patient_profile.profile_completed,
                'redirect_to': 'profile'  # Patient always redirects to profile page
            }, status=status.HTTP_201_CREATED)
        else:
            return Response({'error': 'Failed to authenticate user'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@ensure_csrf_cookie
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def patient_login(request):
    """Patient login endpoint"""
    serializer = PatientLoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data['user']
        
        # Authenticate again to ensure backend attribute is set
        from django.contrib.auth import authenticate
        authenticated_user = authenticate(
            request,
            username=request.data.get('username'),
            password=request.data.get('password')
        )
        
        if authenticated_user:
            # Log the user in (creates session)
            login(request, authenticated_user)
            
            # Get patient profile
            patient_profile = authenticated_user.patient_profile
            
            return Response({
                'message': 'Login successful',
                'user': UserSerializer(authenticated_user).data,
                'profile': PatientProfileSerializer(patient_profile).data,
                'profile_completed': patient_profile.profile_completed,
                'redirect_to': 'profile'  # Patient always redirects to profile page
            }, status=status.HTTP_200_OK)
        else:
            return Response({'error': 'Authentication failed'}, status=status.HTTP_401_UNAUTHORIZED)
    
    # Return detailed error information
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def patient_logout(request):
    """Patient logout endpoint"""
    from django.contrib.auth import logout
    logout(request)
    return Response({'message': 'Logout successful'}, status=status.HTTP_200_OK)


class PatientProfileView(generics.RetrieveAPIView):
    """Get patient profile"""
    serializer_class = PatientProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user.patient_profile


class PatientProfileUpdateView(generics.UpdateAPIView):
    """Update patient profile"""
    serializer_class = PatientProfileUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user.patient_profile
    
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial, context={'request': request})
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        # Return updated profile
        updated_profile = PatientProfileSerializer(instance)
        return Response({
            'message': 'Profile updated successfully',
            'profile': updated_profile.data,
            'profile_completed': instance.profile_completed,
            'redirect_to': 'profile'  # Patient always redirects to profile page
        }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def patient_current_user(request):
    """Get current authenticated patient user"""
    user = request.user
    patient_profile = user.patient_profile
    
    return Response({
        'user': UserSerializer(user).data,
        'profile': PatientProfileSerializer(patient_profile).data,
        'profile_completed': patient_profile.profile_completed,
        'redirect_to': 'profile'  # Patient always redirects to profile page
    }, status=status.HTTP_200_OK)


@ensure_csrf_cookie
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def patient_google_auth(request):
    """Patient Google OAuth authentication"""
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    from django.conf import settings
    
    token = request.data.get('credential')
    
    if not token:
        return Response({'error': 'No credential provided'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Get Google Client ID from settings
        google_client_id = settings.GOOGLE_CLIENT_ID
        
        # Verify the token with Google (with clock skew tolerance)
        idinfo = id_token.verify_oauth2_token(
            token, 
            google_requests.Request(),
            google_client_id,  # Verify with your actual client ID
            clock_skew_in_seconds=10  # Allow 10 seconds clock skew tolerance
        )
        
        # Verify the token is for our client ID
        if idinfo['aud'] != google_client_id:
            return Response({'error': 'Invalid token audience'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get user info from Google
        email = idinfo.get('email')
        google_id = idinfo.get('sub')
        first_name = idinfo.get('given_name', '')
        last_name = idinfo.get('family_name', '')
        
        if not email:
            return Response({'error': 'Email not provided by Google'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user exists
        user = User.objects.filter(email=email).first()
        
        if user:
            # Check if user has patient profile
            try:
                patient_profile = user.patient_profile
            except PatientProfile.DoesNotExist:
                # User exists but not a patient - create patient profile
                patient_profile = PatientProfile.objects.create(
                    user=user,
                    first_name=first_name,
                    last_name=last_name
                )
        else:
            # Create new user
            username = email.split('@')[0] + '_' + google_id[:8]
            user = User.objects.create_user(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name
            )
            user.set_unusable_password()  # No password for OAuth users
            user.save()
            
            # Create patient profile
            patient_profile = PatientProfile.objects.create(
                user=user,
                first_name=first_name,
                last_name=last_name
            )
        
        # Log the user in
        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        
        return Response({
            'message': 'Google authentication successful',
            'user': UserSerializer(user).data,
            'profile': PatientProfileSerializer(patient_profile).data,
            'profile_completed': patient_profile.profile_completed,
            'redirect_to': 'profile'
        }, status=status.HTTP_200_OK)
        
    except ValueError as e:
        return Response({'error': f'Invalid token: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': f'Authentication failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============= PROFILE SETUP WIZARD VIEWS =============

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def submit_consent(request):
    """Step 0 - Submit consent"""
    profile = request.user.patient_profile
    serializer = ConsentSerializer(data=request.data)
    
    if serializer.is_valid():
        profile.consent_given = True
        profile.consent_timestamp = datetime.now()
        profile.current_step = 1
        profile.save()
        
        return Response({
            'message': 'Consent recorded successfully',
            'profile': PatientProfileSetupSerializer(profile).data,
            'next_step': 1
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def submit_step1_basic_info(request):
    """Step 1 - Submit basic identity and contact info"""
    profile = request.user.patient_profile
    
    if not profile.consent_given:
        return Response({
            'error': 'Please complete consent step first'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    serializer = Step1BasicInfoSerializer(profile, data=request.data, partial=False)
    
    if serializer.is_valid():
        serializer.save()
        profile.current_step = 2
        profile.save()
        
        return Response({
            'message': 'Step 1 completed successfully',
            'profile': PatientProfileSetupSerializer(profile).data,
            'next_step': 2
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def submit_step2_health_snapshot(request):
    """Step 2 - Submit health snapshot"""
    profile = request.user.patient_profile
    
    if profile.current_step < 1:
        return Response({
            'error': 'Please complete previous steps first'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    serializer = Step2HealthSnapshotSerializer(profile, data=request.data, partial=False)
    
    if serializer.is_valid():
        serializer.save()
        profile.current_step = 3
        profile.save()
        
        return Response({
            'message': 'Step 2 completed successfully',
            'profile': PatientProfileSetupSerializer(profile).data,
            'next_step': 3
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def submit_step3_preferences(request):
    """Step 3 - Submit preferences (optional)"""
    profile = request.user.patient_profile
    
    if profile.current_step < 2:
        return Response({
            'error': 'Please complete previous steps first'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    serializer = Step3PreferencesSerializer(profile, data=request.data, partial=True)
    
    if serializer.is_valid():
        serializer.save()
        
        # Check if profile is complete
        if profile.is_profile_complete:
            profile.profile_completed = True
        
        profile.current_step = 3
        profile.save()
        
        return Response({
            'message': 'Step 3 completed successfully',
            'profile': PatientProfileSetupSerializer(profile).data,
            'profile_completed': profile.profile_completed,
            'patient_id': profile.patient_id
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def finish_profile_setup(request):
    """Finish profile setup and mark as complete"""
    profile = request.user.patient_profile
    
    if not profile.is_profile_complete:
        return Response({
            'error': 'Please complete all required fields',
            'required_fields': {
                'first_name': bool(profile.first_name),
                'last_name': bool(profile.last_name),
                'date_of_birth': bool(profile.date_of_birth),
                'phone_number': bool(profile.phone_number),
                'emergency_contact_name': bool(profile.emergency_contact_name),
                'emergency_contact_phone': bool(profile.emergency_contact_phone),
                'consent_given': profile.consent_given
            }
        }, status=status.HTTP_400_BAD_REQUEST)
    
    profile.profile_completed = True
    profile.save()
    
    return Response({
        'message': 'Profile setup completed successfully',
        'profile': PatientProfileSetupSerializer(profile).data,
        'patient_id': profile.patient_id,
        'redirect_to': 'dashboard'
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_profile_setup_status(request):
    """Get current profile setup status"""
    profile = request.user.patient_profile
    
    return Response({
        'profile': PatientProfileSetupSerializer(profile).data,
        'current_step': profile.current_step,
        'profile_completed': profile.profile_completed,
        'is_profile_complete': profile.is_profile_complete,
        'patient_id': profile.patient_id
    }, status=status.HTTP_200_OK)


# ============= DOCTOR LINKING VIEWS =============

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def search_doctors(request):
    """Search for doctors by name, specialty, city, or doctor ID"""
    query = request.GET.get('q', '').strip()
    specialty = request.GET.get('specialty', '').strip()
    city = request.GET.get('city', '').strip()
    doctor_id = request.GET.get('doctor_id', '').strip()
    
    # Start with verified doctors only
    doctors = DoctorProfile.objects.filter(profile_status='verified')
    
    if doctor_id:
        # Search by doctor ID (exact match)
        doctors = doctors.filter(doctor_id=doctor_id)
    else:
        # Search by other criteria
        if query:
            doctors = doctors.filter(
                Q(first_name__icontains=query) |
                Q(last_name__icontains=query) |
                Q(display_name__icontains=query) |
                Q(specialization__icontains=query)
            )
        
        if specialty:
            doctors = doctors.filter(specialization__icontains=specialty)
        
        if city:
            doctors = doctors.filter(city__icontains=city)
    
    # Limit results
    doctors = doctors[:20]
    
    serializer = DoctorSearchSerializer(doctors, many=True)
    
    return Response({
        'count': len(serializer.data),
        'doctors': serializer.data
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_connection_request(request):
    """Create a connection request to a doctor"""
    patient_profile = request.user.patient_profile
    
    serializer = CreateConnectionRequestSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    doctor_id = serializer.validated_data.get('doctor_id')
    doctor_profile_id = serializer.validated_data.get('doctor_profile_id')
    patient_note = serializer.validated_data.get('patient_note', '')
    
    # Find the doctor
    try:
        if doctor_id:
            doctor_profile = DoctorProfile.objects.get(doctor_id=doctor_id)
        else:
            doctor_profile = DoctorProfile.objects.get(id=doctor_profile_id)
    except DoctorProfile.DoesNotExist:
        return Response({
            'error': 'Doctor not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Check if doctor is verified
    if not doctor_profile.is_verified:
        return Response({
            'error': 'Cannot connect with unverified doctors'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Check if connection already exists
    existing_connection = PatientDoctorConnection.objects.filter(
        patient=patient_profile,
        doctor=doctor_profile
    ).first()
    
    if existing_connection:
        if existing_connection.status == 'accepted':
            return Response({
                'error': 'You are already connected with this doctor'
            }, status=status.HTTP_400_BAD_REQUEST)
        elif existing_connection.status == 'pending':
            return Response({
                'error': 'Connection request already pending'
            }, status=status.HTTP_400_BAD_REQUEST)
        elif existing_connection.status == 'rejected':
            # Allow re-request after rejection
            existing_connection.status = 'pending'
            existing_connection.patient_note = patient_note
            existing_connection.save()
            
            return Response({
                'message': 'Connection request sent successfully',
                'connection': PatientDoctorConnectionSerializer(existing_connection).data
            }, status=status.HTTP_200_OK)
    
    # Create new connection request
    connection = PatientDoctorConnection.objects.create(
        patient=patient_profile,
        doctor=doctor_profile,
        status='pending',
        initiated_by='patient',
        patient_note=patient_note
    )
    
    return Response({
        'message': 'Connection request sent successfully',
        'connection': PatientDoctorConnectionSerializer(connection).data
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_my_connections(request):
    """Get all connections for the current patient"""
    patient_profile = request.user.patient_profile
    
    connections = PatientDoctorConnection.objects.filter(
        patient=patient_profile
    ).select_related('doctor', 'doctor__user')
    
    serializer = PatientDoctorConnectionSerializer(connections, many=True)
    
    return Response({
        'count': len(serializer.data),
        'connections': serializer.data
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_connected_doctors(request):
    """Get only accepted/connected doctors"""
    patient_profile = request.user.patient_profile
    
    connections = PatientDoctorConnection.objects.filter(
        patient=patient_profile,
        status='accepted'
    ).select_related('doctor', 'doctor__user')
    
    serializer = PatientDoctorConnectionSerializer(connections, many=True)
    
    return Response({
        'count': len(serializer.data),
        'doctors': serializer.data
    }, status=status.HTTP_200_OK)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def remove_connection(request, connection_id):
    """Remove a connection with a doctor"""
    patient_profile = request.user.patient_profile
    
    try:
        connection = PatientDoctorConnection.objects.get(
            id=connection_id,
            patient=patient_profile
        )
    except PatientDoctorConnection.DoesNotExist:
        return Response({
            'error': 'Connection not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    connection.remove_connection()
    
    return Response({
        'message': 'Connection removed successfully'
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def accept_connection_request(request, connection_id):
    """Accept a doctor's connection request"""
    patient_profile = request.user.patient_profile
    
    try:
        connection = PatientDoctorConnection.objects.get(
            id=connection_id,
            patient=patient_profile,
            status='pending'
        )
    except PatientDoctorConnection.DoesNotExist:
        return Response({
            'error': 'Connection request not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Accept the connection
    patient_note = request.data.get('note', '')
    connection.status = 'accepted'
    connection.accepted_at = timezone.now()
    if patient_note:
        connection.patient_note = patient_note
    connection.save()
    
    return Response({
        'message': 'Connection accepted successfully',
        'connection': PatientDoctorConnectionSerializer(connection).data
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def reject_connection_request(request, connection_id):
    """Reject a doctor's connection request"""
    patient_profile = request.user.patient_profile
    
    try:
        connection = PatientDoctorConnection.objects.get(
            id=connection_id,
            patient=patient_profile,
            status='pending'
        )
    except PatientDoctorConnection.DoesNotExist:
        return Response({
            'error': 'Connection request not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Reject the connection
    patient_note = request.data.get('note', '')
    connection.status = 'rejected'
    if patient_note:
        connection.patient_note = patient_note
    connection.save()
    
    return Response({
        'message': 'Connection rejected',
        'connection': PatientDoctorConnectionSerializer(connection).data
    }, status=status.HTTP_200_OK)


# ============= DOCTOR WORKSPACES (PATIENT VIEW) =============

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_patient_workspaces(request):
    """List all doctor-specific workspaces for the patient"""
    patient_profile = request.user.patient_profile

    connections = PatientDoctorConnection.objects.filter(
        patient=patient_profile,
        status='accepted'
    ).select_related('doctor', 'patient')

    if not connections.exists():
        return Response({'count': 0, 'workspaces': []}, status=status.HTTP_200_OK)

    connection_ids = []
    for connection in connections:
        workspace = DoctorPatientWorkspace.ensure_for_connection(connection)
        workspace.sync_metadata()
        connection_ids.append(connection.id)

    workspaces = DoctorPatientWorkspace.objects.filter(
        connection_id__in=connection_ids
    ).select_related('doctor', 'patient', 'connection').prefetch_related('timeline_entries')

    serializer = DoctorPatientWorkspaceSummarySerializer(workspaces, many=True)
    return Response({'count': len(serializer.data), 'workspaces': serializer.data}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_patient_workspace_detail(request, connection_id):
    """Detailed workspace view for a specific doctor"""
    patient_profile = request.user.patient_profile

    try:
        connection = PatientDoctorConnection.objects.select_related('doctor', 'patient').get(
            id=connection_id,
            patient=patient_profile,
            status='accepted'
        )
    except PatientDoctorConnection.DoesNotExist:
        return Response({'error': 'Workspace not found'}, status=status.HTTP_404_NOT_FOUND)

    workspace = DoctorPatientWorkspace.ensure_for_connection(connection)
    workspace.sync_metadata()

    limit = request.GET.get('limit')
    try:
        limit = int(limit) if limit else None
    except ValueError:
        limit = None

    serializer = DoctorPatientWorkspaceDetailSerializer(
        workspace,
        context={'entries_limit': limit}
    )
    return Response(serializer.data, status=status.HTTP_200_OK)


# ============= QR CODE SCANNING =============

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def validate_qr_token(request, token):
    """Validate a QR code token before scanning"""
    try:
        qr_token = ConnectionToken.objects.select_related('doctor').get(token=token)
    except ConnectionToken.DoesNotExist:
        return Response({
            'error': 'Invalid QR code',
            'valid': False
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Check if token is valid
    if not qr_token.is_valid:
        reason = 'expired' if qr_token.is_expired else 'already_used'
        return Response({
            'error': f'QR code is {reason}',
            'valid': False,
            'is_expired': qr_token.is_expired,
            'is_used': qr_token.is_used
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Return doctor info for preview
    doctor = qr_token.doctor
    return Response({
        'valid': True,
        'doctor': {
            'name': doctor.display_name or doctor.full_name,
            'specialization': doctor.specialization,
            'clinic': doctor.primary_clinic_hospital,
            'city': doctor.city,
            'consultation_mode': doctor.consultation_mode
        },
        'expires_at': qr_token.expires_at,
        'time_remaining': (qr_token.expires_at - timezone.now()).total_seconds() / 3600  # in hours
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def scan_qr_code(request, token):
    """Scan QR code and create instant connection with doctor"""
    patient_profile = request.user.patient_profile
    
    # Check if patient profile is complete
    if not patient_profile.is_profile_complete:
        return Response({
            'error': 'Please complete your profile before connecting with doctors',
            'redirect_to': 'profile_setup'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Get the token
    try:
        qr_token = ConnectionToken.objects.select_related('doctor').get(token=token)
    except ConnectionToken.DoesNotExist:
        return Response({
            'error': 'Invalid QR code'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Check if token is valid
    if not qr_token.is_valid:
        reason = 'expired' if qr_token.is_expired else 'already used'
        return Response({
            'error': f'QR code is {reason}'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    doctor = qr_token.doctor
    
    # Check if connection already exists
    existing_connection = PatientDoctorConnection.objects.filter(
        patient=patient_profile,
        doctor=doctor
    ).first()
    
    if existing_connection:
        if existing_connection.status == 'accepted':
            return Response({
                'error': 'You are already connected with this doctor',
                'connection_exists': True
            }, status=status.HTTP_400_BAD_REQUEST)
        elif existing_connection.status == 'pending':
            # Auto-accept if it's a pending request
            existing_connection.status = 'accepted'
            existing_connection.accepted_at = timezone.now()
            existing_connection.connection_type = 'qr_code'
            existing_connection.qr_token = qr_token
            existing_connection.save()
            
            # Mark token as used
            qr_token.mark_as_used(patient_profile)
            
            return Response({
                'message': 'Connection accepted successfully via QR code',
                'connection': PatientDoctorConnectionSerializer(existing_connection).data,
                'doctor': {
                    'name': doctor.display_name or doctor.full_name,
                    'doctor_id': doctor.doctor_id,
                    'specialization': doctor.specialization
                }
            }, status=status.HTTP_200_OK)
        elif existing_connection.status in ['rejected', 'removed']:
            # Update rejected/removed connection to accepted via QR code
            existing_connection.status = 'accepted'
            existing_connection.accepted_at = timezone.now()
            existing_connection.connection_type = 'qr_code'
            existing_connection.qr_token = qr_token
            existing_connection.doctor_note = 'Reconnected via QR code'
            existing_connection.save()
            
            # Mark token as used
            qr_token.mark_as_used(patient_profile)
            
            return Response({
                'message': 'Connection re-established successfully via QR code',
                'connection': PatientDoctorConnectionSerializer(existing_connection).data,
                'doctor': {
                    'name': doctor.display_name or doctor.full_name,
                    'doctor_id': doctor.doctor_id,
                    'specialization': doctor.specialization
                }
            }, status=status.HTTP_200_OK)
    
    # Create new instant connection (auto-accepted for QR scans)
    connection = PatientDoctorConnection.objects.create(
        patient=patient_profile,
        doctor=doctor,
        status='accepted',  # Auto-accept for QR code connections
        accepted_at=timezone.now(),
        initiated_by='patient',
        connection_type='qr_code',
        qr_token=qr_token,
        patient_note='Connected via QR code'
    )
    
    # Mark token as used
    qr_token.mark_as_used(patient_profile)
    
    return Response({
        'message': 'Successfully connected with doctor via QR code',
        'connection': PatientDoctorConnectionSerializer(connection).data,
        'doctor': {
            'name': doctor.display_name or doctor.full_name,
            'doctor_id': doctor.doctor_id,
            'specialization': doctor.specialization,
            'clinic': doctor.primary_clinic_hospital,
            'city': doctor.city
        }
    }, status=status.HTTP_201_CREATED)


# ===========================
# AI Intake Form Views (Patient Side)
# ===========================

from .models import AIIntakeForm, IntakeFormResponse, IntakeFormUpload, DoctorPatientTimelineEntry
from .serializers import (
    PatientIntakeFormListSerializer,
    AIIntakeFormSerializer,
    IntakeFormResponseCreateUpdateSerializer,
    IntakeFormUploadSerializer,
    MedicalReportListSerializer,
    MedicalReportDetailSerializer,
    MedicalReportCreateSerializer,
    MedicalReportUpdateSerializer,
    ReportCommentSerializer,
)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_patient_intake_forms(request):
    """
    List all intake forms sent to the patient
    Query params: status (optional)
    """
    if not hasattr(request.user, 'patient_profile'):
        return Response(
            {'error': 'Only patients can access this endpoint'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    patient_profile = request.user.patient_profile
    
    # Get all forms sent to this patient
    forms = AIIntakeForm.objects.filter(
        patient=patient_profile
    ).exclude(status='draft').select_related(
        'doctor', 'workspace'
    ).prefetch_related('uploads', 'response').order_by('-sent_at')
    
    # Filter by status if provided
    form_status = request.query_params.get('status')
    if form_status:
        forms = forms.filter(status=form_status)
    
    serializer = PatientIntakeFormListSerializer(forms, many=True)
    return Response({'forms': serializer.data}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_patient_intake_form_detail(request, form_id):
    """
    Get detailed view of an intake form for patient to fill
    """
    if not hasattr(request.user, 'patient_profile'):
        return Response(
            {'error': 'Only patients can access this endpoint'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    patient_profile = request.user.patient_profile
    
    try:
        form = AIIntakeForm.objects.select_related(
            'doctor', 'patient', 'workspace'
        ).prefetch_related('uploads', 'response').get(id=form_id)
        
        # Verify access
        if form.patient != patient_profile:
            return Response(
                {'error': 'You do not have access to this form'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Can't view draft forms
        if form.status == 'draft':
            return Response(
                {'error': 'This form has not been sent yet'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = AIIntakeFormSerializer(form, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    except AIIntakeForm.DoesNotExist:
        return Response(
            {'error': 'Intake form not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST', 'PUT', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def save_form_response(request, form_id):
    """
    Save or update patient's response to an intake form
    This allows auto-save functionality
    """
    if not hasattr(request.user, 'patient_profile'):
        return Response(
            {'error': 'Only patients can submit form responses'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    patient_profile = request.user.patient_profile
    
    try:
        form = AIIntakeForm.objects.get(id=form_id)
        
        # Verify access
        if form.patient != patient_profile:
            return Response(
                {'error': 'You do not have access to this form'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Can only respond to sent forms
        if form.status not in ['sent', 'in_progress']:
            return Response(
                {'error': 'This form cannot be filled at this time'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update form status to in_progress if it's sent
        if form.status == 'sent':
            form.status = 'in_progress'
            form.save()
        
        # Get or create response
        response, created = IntakeFormResponse.objects.get_or_create(form=form)
        
        # Update response
        serializer = IntakeFormResponseCreateUpdateSerializer(
            response, 
            data=request.data, 
            partial=True
        )
        
        if serializer.is_valid():
            serializer.save()
            
            # If marked as complete, update form status and run AI analysis
            if response.is_complete and form.status == 'in_progress':
                form.mark_as_submitted()
                
                # Run AI analysis on patient responses
                try:
                    ai_analysis = analyze_patient_responses(
                        {'form_schema': form.form_schema},
                        response.response_data
                    )
                    form.ai_analysis = ai_analysis
                    form.ai_summary = ai_analysis.get('overall_summary', '')
                    
                    # Aggregate OCR results from all uploaded documents
                    ocr_aggregated = aggregate_form_ocr_results(form)
                    form.ocr_results = ocr_aggregated
                    form.ocr_processed = ocr_aggregated.get('processed_documents', 0) > 0
                    
                    form.save()
                except Exception as e:
                    print(f"AI analysis error: {e}")
                
                # Determine urgency for timeline entry
                urgency_level = ai_analysis.get('urgency_level', 'routine') if ai_analysis else 'routine'
                is_critical = urgency_level in ['critical', 'urgent']
                
                # Create timeline entry in workspace
                timeline_summary = f'Patient has completed and submitted the intake form.'
                if ai_analysis and ai_analysis.get('overall_summary'):
                    timeline_summary += f"\n\nAI Analysis: {ai_analysis['overall_summary']}"
                
                DoctorPatientTimelineEntry.objects.create(
                    workspace=form.workspace,
                    entry_type='update',
                    title=f'Intake Form Submitted: {form.title}',
                    summary=timeline_summary,
                    details=f'Form: {form.title}\nCompleted: {response.completion_percentage}% of fields answered\nUrgency: {urgency_level}',
                    visibility='patient',
                    created_by='patient',
                    is_critical=is_critical,
                    highlight_color='red' if urgency_level == 'critical' else 'orange' if urgency_level == 'urgent' else 'green'
                )
            
            return Response({
                'message': 'Response saved successfully',
                'response': serializer.data,
                'form_status': form.status,
                'ai_analysis_complete': form.ai_analysis is not None if response.is_complete else False
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    except AIIntakeForm.DoesNotExist:
        return Response(
            {'error': 'Intake form not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_form_file(request, form_id):
    """
    Upload a file for a specific field in the intake form
    """
    if not hasattr(request.user, 'patient_profile'):
        return Response(
            {'error': 'Only patients can upload files'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    patient_profile = request.user.patient_profile
    
    try:
        form = AIIntakeForm.objects.get(id=form_id)
        
        # Verify access
        if form.patient != patient_profile:
            return Response(
                {'error': 'You do not have access to this form'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Validate required fields
        field_id = request.data.get('field_id')
        field_label = request.data.get('field_label')
        file = request.FILES.get('file')
        
        if not field_id or not file:
            return Response(
                {'error': 'field_id and file are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get upload type from request or default
        upload_type = request.data.get('upload_type', 'document')
        description = request.data.get('description', '')
        
        # Create upload record
        upload = IntakeFormUpload.objects.create(
            form=form,
            field_id=field_id,
            field_label=field_label or field_id,
            file=file,
            file_name=file.name,
            file_size=file.size,
            file_type=file.content_type,
            upload_type=upload_type,
            description=description
        )
        
        # Trigger OCR processing automatically
        ocr_result = {'success': False}
        try:
            ocr_result = process_document_ocr(upload)
        except Exception as e:
            print(f"OCR processing failed: {e}")
        
        serializer = IntakeFormUploadSerializer(upload, context={'request': request})
        return Response({
            'message': 'File uploaded successfully',
            'upload': serializer.data,
            'ocr_processed': ocr_result.get('success', False),
            'medical_data_extracted': bool(ocr_result.get('medical_data'))
        }, status=status.HTTP_201_CREATED)
    
    except AIIntakeForm.DoesNotExist:
        return Response(
            {'error': 'Intake form not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_form_upload(request, form_id, upload_id):
    """
    Delete an uploaded file from the form
    """
    if not hasattr(request.user, 'patient_profile'):
        return Response(
            {'error': 'Only patients can delete uploads'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    patient_profile = request.user.patient_profile
    
    try:
        form = AIIntakeForm.objects.get(id=form_id)
        
        # Verify access to form
        if form.patient != patient_profile:
            return Response(
                {'error': 'You do not have access to this form'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get and delete upload
        upload = IntakeFormUpload.objects.get(id=upload_id, form=form)
        
        # Delete the file from storage
        if upload.file:
            upload.file.delete()
        
        upload.delete()
        
        return Response(
            {'message': 'File deleted successfully'},
            status=status.HTTP_200_OK
        )
    
    except AIIntakeForm.DoesNotExist:
        return Response(
            {'error': 'Intake form not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except IntakeFormUpload.DoesNotExist:
        return Response(
            {'error': 'Upload not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_intake_form_notifications(request):
    """
    Get notifications about intake forms for the patient
    Returns pending forms count and recent form activities
    """
    if not hasattr(request.user, 'patient_profile'):
        return Response(
            {'error': 'Only patients can access this endpoint'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    patient_profile = request.user.patient_profile
    
    # Count pending forms (sent but not started or in progress)
    pending_forms = AIIntakeForm.objects.filter(
        patient=patient_profile,
        status__in=['sent', 'in_progress']
    ).count()
    
    # Get recently sent forms (last 7 days)
    from datetime import timedelta
    seven_days_ago = timezone.now() - timedelta(days=7)
    
    recent_forms = AIIntakeForm.objects.filter(
        patient=patient_profile,
        sent_at__gte=seven_days_ago
    ).select_related('doctor', 'workspace').order_by('-sent_at')[:5]
    
    recent_forms_data = []
    for form in recent_forms:
        recent_forms_data.append({
            'id': form.id,
            'title': form.title,
            'doctor_name': form.doctor.display_name or form.doctor.full_name,
            'status': form.status,
            'sent_at': form.sent_at,
            'is_new': form.status == 'sent'
        })
    
    return Response({
        'pending_count': pending_forms,
        'recent_forms': recent_forms_data
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def patient_dashboard_summary(request):
    """
    Get summary data for patient dashboard including form notifications
    """
    if not hasattr(request.user, 'patient_profile'):
        return Response(
            {'error': 'Only patients can access this endpoint'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    patient_profile = request.user.patient_profile
    
    # Connected doctors count
    connected_doctors = PatientDoctorConnection.objects.filter(
        patient=patient_profile,
        status='accepted'
    ).count()
    
    # Active workspaces
    active_workspaces = DoctorPatientWorkspace.objects.filter(
        patient=patient_profile,
        status='active'
    ).count()
    
    # Pending forms count
    pending_forms = AIIntakeForm.objects.filter(
        patient=patient_profile,
        status__in=['sent', 'in_progress']
    ).count()
    
    # Submitted forms awaiting review
    submitted_forms = AIIntakeForm.objects.filter(
        patient=patient_profile,
        status='submitted'
    ).count()
    
    # Recent activities from all workspaces
    recent_activities = DoctorPatientTimelineEntry.objects.filter(
        workspace__patient=patient_profile,
        visibility='patient'
    ).select_related('workspace__doctor').order_by('-created_at')[:5]
    
    activities_data = []
    for activity in recent_activities:
        activities_data.append({
            'id': activity.id,
            'title': activity.title,
            'summary': activity.summary,
            'entry_type': activity.entry_type,
            'created_at': activity.created_at,
            'doctor_name': activity.workspace.doctor.display_name or activity.workspace.doctor.full_name,
            'is_critical': activity.is_critical
        })
    
    # Get recent form notifications
    from datetime import timedelta
    seven_days_ago = timezone.now() - timedelta(days=7)
    
    recent_forms = AIIntakeForm.objects.filter(
        patient=patient_profile,
        sent_at__gte=seven_days_ago,
        status='sent'
    ).select_related('doctor').order_by('-sent_at')[:3]
    
    form_notifications = []
    for form in recent_forms:
        form_notifications.append({
            'id': form.id,
            'title': form.title,
            'doctor_name': form.doctor.display_name or form.doctor.full_name,
            'sent_at': form.sent_at,
            'type': 'new_form'
        })
    
    return Response({
        'summary': {
            'connected_doctors': connected_doctors,
            'active_workspaces': active_workspaces,
            'pending_forms': pending_forms,
            'submitted_forms': submitted_forms
        },
        'recent_activities': activities_data,
        'form_notifications': form_notifications,
        'patient_info': {
            'name': patient_profile.full_name,
            'patient_id': patient_profile.patient_id,
            'profile_completed': patient_profile.profile_completed
        }
    }, status=status.HTTP_200_OK)


# ============================================================================
# MEDICAL REPORT MANAGEMENT WITH OCR AND AI AUTOMATION
# ============================================================================

def process_medical_report_ocr(file_obj):
    """
    Process OCR on medical report file (PDF or image)
    Returns extracted text and structured medical data
    """
    try:
        file_extension = file_obj.name.lower().split('.')[-1]
        extracted_text = ""
        
        if file_extension == 'pdf':
            # Extract text from PDF using PyPDF2
            try:
                pdf_reader = PyPDF2.PdfReader(file_obj)
                text_parts = []
                
                for page in pdf_reader.pages:
                    text_parts.append(page.extract_text())
                
                extracted_text = '\n'.join(text_parts)
                file_obj.seek(0)  # Reset file pointer
            except Exception as e:
                print(f"PDF extraction error: {e}")
                extracted_text = ""
        else:
            # For images, use Tesseract (if available)
            try:
                import pytesseract
                from PIL import Image
                import io
                
                image = Image.open(io.BytesIO(file_obj.read()))
                extracted_text = pytesseract.image_to_string(image)
                file_obj.seek(0)  # Reset file pointer
            except ImportError:
                return {
                    'success': False,
                    'error': 'Image OCR not available. Please install pytesseract.',
                    'text': '',
                    'medical_data': {}
                }
        
        # Extract structured medical information
        medical_data = extract_medical_info_from_text(extracted_text)
        
        return {
            'success': True,
            'text': extracted_text,
            'medical_data': medical_data,
            'error': None
        }
    
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'text': '',
            'medical_data': {}
        }


def analyze_report_with_ai(ocr_text, medical_data, report_type):
    """
    Analyze medical report using Groq AI
    Returns structured AI analysis with insights and recommendations
    """
    try:
        # Prepare analysis prompt based on report type
        report_type_context = {
            'lab_report': 'laboratory test results and biomarkers',
            'x_ray': 'X-ray imaging findings and interpretations',
            'mri_scan': 'MRI scan results and anatomical observations',
            'ct_scan': 'CT scan findings and diagnostic insights',
            'ultrasound': 'ultrasound examination results',
            'prescription': 'prescription medications and dosage instructions',
            'ecg': 'ECG/EKG cardiac readings and rhythm analysis',
            'blood_test': 'blood test results and blood chemistry',
            'pathology': 'pathology report findings',
            'discharge_summary': 'hospital discharge summary and care instructions',
            'consultation_notes': 'medical consultation notes and observations',
            'other': 'medical document'
        }
        
        context = report_type_context.get(report_type, 'medical document')
        
        prompt = f"""You are a medical AI assistant analyzing a {context}. 
        
OCR Extracted Text:
{ocr_text[:2000]}

Structured Medical Data:
{json.dumps(medical_data, indent=2)}

Please provide a comprehensive analysis including:
1. Key Findings: List the most important medical findings
2. Values Analysis: Analyze any test values (normal/abnormal ranges)
3. Clinical Significance: Explain what these findings mean
4. Risk Assessment: Identify any concerning findings or risks
5. Recommendations: Suggest follow-up actions or consultations needed
6. Summary: Brief overall assessment

Format your response as JSON with these exact keys:
{{
    "key_findings": ["finding1", "finding2", ...],
    "values_analysis": {{"parameter": "analysis", ...}},
    "clinical_significance": "explanation text",
    "risk_assessment": "risk evaluation text",
    "recommendations": ["recommendation1", "recommendation2", ...],
    "summary": "brief summary text"
}}

Be thorough but concise. Focus on medically relevant information."""

        # Call Groq API
        groq_api_key = os.getenv('GROQ_API_KEY')
        if not groq_api_key:
            return Response(
                {'error': 'GROQ_API_KEY not configured'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
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
                        "content": "You are a medical AI assistant specializing in analyzing medical reports and providing clinical insights. Always respond with valid JSON."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.3,
                "max_tokens": 2000
            }
        )
        
        if response.status_code == 200:
            result = response.json()
            ai_text = result['choices'][0]['message']['content']
            
            # Try to parse as JSON
            try:
                # Remove markdown code blocks if present
                if '```json' in ai_text:
                    ai_text = ai_text.split('```json')[1].split('```')[0].strip()
                elif '```' in ai_text:
                    ai_text = ai_text.split('```')[1].split('```')[0].strip()
                
                ai_analysis = json.loads(ai_text)
                
                return {
                    'success': True,
                    'analysis': ai_analysis,
                    'error': None
                }
            except json.JSONDecodeError:
                # If JSON parsing fails, create structured response from text
                return {
                    'success': True,
                    'analysis': {
                        'summary': ai_text,
                        'key_findings': [],
                        'recommendations': [],
                        'clinical_significance': ai_text[:500]
                    },
                    'error': 'AI response was not in JSON format, using text summary'
                }
        else:
            return {
                'success': False,
                'analysis': {},
                'error': f'AI API error: {response.status_code}'
            }
    
    except Exception as e:
        return {
            'success': False,
            'analysis': {},
            'error': str(e)
        }


@api_view(['POST'])
@authentication_classes([TokenAuthentication, SessionAuthentication])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_medical_report(request, workspace_id):
    """
    Patient uploads a medical report to their workspace
    Automatically processes OCR and AI analysis
    """
    try:
        if not hasattr(request.user, 'patient_profile'):
            return Response(
                {'error': 'Patient profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        patient_profile = request.user.patient_profile
        
        # Get workspace and verify patient access
        workspace = DoctorPatientWorkspace.objects.get(
            id=workspace_id,
            patient=patient_profile,
            status='active'
        )
        
        # Validate file upload
        if 'file' not in request.FILES:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        file_obj = request.FILES['file']
        
        # Validate file type
        allowed_extensions = ['pdf', 'jpg', 'jpeg', 'png', 'dcm', 'dicom']
        file_extension = file_obj.name.lower().split('.')[-1]
        
        if file_extension not in allowed_extensions:
            return Response(
                {'error': f'File type not supported. Allowed: {", ".join(allowed_extensions)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get report date, default to today if not provided
        report_date = request.data.get('report_date')
        if not report_date:
            from datetime import date
            report_date = date.today()
        
        # Create medical report instance
        report_data = {
            'workspace': workspace,
            'patient': patient_profile,
            'report_type': request.data.get('report_type', 'other'),
            'title': request.data.get('title', f'Medical Report - {file_obj.name}'),
            'description': request.data.get('description', ''),
            'report_date': report_date,
            'file': file_obj
        }
        
        # Create the report directly
        report = MedicalReport.objects.create(**report_data)
        
        # Update status to processing
        report.status = 'processing'
        report.save()
        
        # Process OCR
        ocr_result = process_medical_report_ocr(file_obj)
        
        if ocr_result['success']:
            report.ocr_text = ocr_result['text']
            # Store medical data in appropriate fields
            medical_data = ocr_result.get('medical_data', {})
            report.extracted_medications = medical_data.get('medications', [])
            report.extracted_diagnoses = medical_data.get('diagnoses', [])
            report.extracted_vitals = medical_data.get('vital_signs', {})
            report.extracted_test_results = medical_data.get('test_results', [])
            report.extracted_allergies = medical_data.get('allergies', [])
            report.ocr_processed = True
            report.ocr_processed_at = timezone.now()
            
            # Process AI analysis
            ai_result = analyze_report_with_ai(
                ocr_result['text'],
                ocr_result['medical_data'],
                report.report_type
            )
            
            if ai_result['success']:
                analysis = ai_result.get('analysis', {})
                report.ai_summary = analysis.get('summary', '')
                report.ai_key_findings = analysis.get('key_findings', [])
                report.ai_recommendations = '\n'.join(analysis.get('recommendations', []))
                report.ai_raw_response = analysis
                report.ai_processed = True
                report.ai_processed_at = timezone.now()
                report.status = 'ready_for_review'
        
        # Update status to ready for review or ocr_complete
        if not report.ai_processed and report.ocr_processed:
            report.status = 'ocr_complete'
        elif not report.ocr_processed:
            report.status = 'uploaded'
        
        report.save()
        
        # Note: Timeline entry is automatically created by the post_save signal
        
        # Return detailed response
        response_serializer = MedicalReportDetailSerializer(report, context={'request': request})
        
        return Response({
            'message': 'Medical report uploaded and processed successfully',
            'report': response_serializer.data,
            'ocr_success': ocr_result.get('success', False),
            'ai_success': report.ai_processed
        }, status=status.HTTP_201_CREATED)
    
    except PatientProfile.DoesNotExist:
        return Response(
            {'error': 'Patient profile not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except DoctorPatientWorkspace.DoesNotExist:
        return Response(
            {'error': 'Workspace not found or access denied'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@authentication_classes([TokenAuthentication, SessionAuthentication])
@permission_classes([permissions.IsAuthenticated])
def list_medical_reports(request, workspace_id):
    """
    List all medical reports in a workspace
    Accessible by both patient and doctor
    """
    try:
        # Determine user role
        is_doctor = hasattr(request.user, 'doctor_profile')
        is_patient = hasattr(request.user, 'patient_profile')
        
        if not is_doctor and not is_patient:
            return Response(
                {'error': 'User profile not found. Please complete your profile setup.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if is_doctor:
            workspace = DoctorPatientWorkspace.objects.get(
                id=workspace_id,
                doctor=request.user.doctor_profile,
                status='active'
            )
        elif is_patient:
            workspace = DoctorPatientWorkspace.objects.get(
                id=workspace_id,
                patient=request.user.patient_profile,
                status='active'
            )
        
        # Get reports for this workspace
        reports = MedicalReport.objects.filter(
            workspace=workspace
        ).select_related('patient').order_by('-uploaded_at')
        
        # Apply filters
        report_type = request.query_params.get('report_type')
        status_filter = request.query_params.get('status')
        is_critical = request.query_params.get('is_critical')
        
        if report_type:
            reports = reports.filter(report_type=report_type)
        if status_filter:
            reports = reports.filter(status=status_filter)
        if is_critical:
            reports = reports.filter(is_critical=is_critical.lower() == 'true')
        
        # Serialize
        serializer = MedicalReportListSerializer(reports, many=True, context={'request': request})
        
        return Response({
            'count': reports.count(),
            'reports': serializer.data
        }, status=status.HTTP_200_OK)
    
    except DoctorPatientWorkspace.DoesNotExist:
        return Response(
            {'error': 'Workspace not found or access denied'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET', 'PATCH'])
@authentication_classes([TokenAuthentication, SessionAuthentication])
@permission_classes([permissions.IsAuthenticated])
def medical_report_detail(request, workspace_id, report_id):
    """
    Get or update a specific medical report
    Patients can update basic info, doctors can review and add notes
    """
    try:
        # Determine user role
        is_doctor = hasattr(request.user, 'doctor_profile')
        is_patient = hasattr(request.user, 'patient_profile')
        
        if not is_doctor and not is_patient:
            return Response(
                {'error': 'User profile not found. Please complete your profile setup.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if is_doctor:
            workspace = DoctorPatientWorkspace.objects.get(
                id=workspace_id,
                doctor=request.user.doctor_profile,
                status='active'
            )
        elif is_patient:
            workspace = DoctorPatientWorkspace.objects.get(
                id=workspace_id,
                patient=request.user.patient_profile,
                status='active'
            )
        
        # Get report
        report = MedicalReport.objects.get(
            id=report_id,
            workspace=workspace
        )
        
        if request.method == 'GET':
            serializer = MedicalReportDetailSerializer(report, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        elif request.method == 'PATCH':
            serializer = MedicalReportUpdateSerializer(
                report,
                data=request.data,
                partial=True,
                context={'request': request}
            )
            
            if serializer.is_valid():
                serializer.save()
                
                # If doctor marked as reviewed, update status and create timeline
                if is_doctor and request.data.get('reviewed_by_doctor'):
                    report.status = 'reviewed'
                    report.save()
                    
                    DoctorPatientTimelineEntry.objects.create(
                        workspace=workspace,
                        entry_type='diagnostic',
                        title=f'Report Reviewed: {report.title}',
                        summary=f'Dr. {workspace.doctor.display_name or workspace.doctor.full_name} reviewed the medical report',
                        details=report.doctor_notes if report.doctor_notes else 'Doctor has reviewed this report',
                        created_by='doctor',
                        visibility='patient',
                        is_critical=report.is_critical,
                        meta={'report_id': report.id, 'report_type': report.report_type}
                    )
                
                response_serializer = MedicalReportDetailSerializer(report, context={'request': request})
                return Response(response_serializer.data, status=status.HTTP_200_OK)
            
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    except DoctorPatientWorkspace.DoesNotExist:
        return Response(
            {'error': 'Workspace not found or access denied'},
            status=status.HTTP_404_NOT_FOUND
        )
    except MedicalReport.DoesNotExist:
        return Response(
            {'error': 'Medical report not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@authentication_classes([TokenAuthentication, SessionAuthentication])
@permission_classes([permissions.IsAuthenticated])
def add_report_comment(request, workspace_id, report_id):
    """
    Add a comment to a medical report
    Both patient and doctor can add comments
    """
    try:
        # Determine user role
        is_doctor = hasattr(request.user, 'doctor_profile')
        is_patient = hasattr(request.user, 'patient_profile')
        
        if not is_doctor and not is_patient:
            return Response(
                {'error': 'User profile not found. Please complete your profile setup.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if is_doctor:
            workspace = DoctorPatientWorkspace.objects.get(
                id=workspace_id,
                doctor=request.user.doctor_profile,
                status='active'
            )
        elif is_patient:
            workspace = DoctorPatientWorkspace.objects.get(
                id=workspace_id,
                patient=request.user.patient_profile,
                status='active'
            )
        
        # Get report
        report = MedicalReport.objects.get(
            id=report_id,
            workspace=workspace
        )
        
        # Create comment
        comment_text = request.data.get('comment')
        if not comment_text:
            return Response(
                {'error': 'Comment text is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        comment = ReportComment.objects.create(
            report=report,
            author_user=request.user,
            author_type='doctor' if is_doctor else 'patient',
            comment=comment_text,
            is_internal=request.data.get('is_internal', False) if is_doctor else False
        )
        
        # Create timeline entry
        user_name = (
            workspace.doctor.display_name or workspace.doctor.full_name
            if is_doctor
            else workspace.patient.full_name
        )
        
        DoctorPatientTimelineEntry.objects.create(
            workspace=workspace,
            entry_type='update',
            title=f'Comment on Report: {report.title}',
            summary=f'{user_name} added a comment',
            details=comment_text[:500],
            created_by='doctor' if is_doctor else 'patient',
            visibility='patient' if not comment.is_internal else 'internal',
            meta={'report_id': report.id, 'comment_id': comment.id}
        )
        
        serializer = ReportCommentSerializer(comment)
        
        return Response({
            'message': 'Comment added successfully',
            'comment': serializer.data
        }, status=status.HTTP_201_CREATED)
    
    except DoctorPatientWorkspace.DoesNotExist:
        return Response(
            {'error': 'Workspace not found or access denied'},
            status=status.HTTP_404_NOT_FOUND
        )
    except MedicalReport.DoesNotExist:
        return Response(
            {'error': 'Medical report not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
