"""
AI Service for Patient History Analysis using Groq API
Generates clinical summaries, trend analysis, and risk assessments
"""

import os
import json
import requests
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional
from django.conf import settings


class PatientHistoryAIService:
    """Service class for AI-powered patient history analysis using Groq"""
    
    def __init__(self, workspace):
        """
        Initialize AI service with workspace context
        
        Args:
            workspace: DoctorPatientWorkspace instance
        """
        self.workspace = workspace
        self.patient = workspace.patient
        self.groq_api_url = "https://api.groq.com/openai/v1/chat/completions"
        self.groq_api_key = os.getenv('GROQ_API_KEY', '')
        self.model = "llama-3.3-70b-versatile"  # or "mixtral-8x7b-32768"
    
    def _call_groq_api(self, messages: List[Dict], temperature: float = 0.3) -> Optional[Dict]:
        """
        Make API call to Groq
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            temperature: Model temperature (0-1)
            
        Returns:
            Parsed JSON response or None if error
        """
        if not self.groq_api_key:
            print("Warning: GROQ_API_KEY not set in environment")
            return None
        
        headers = {
            "Authorization": f"Bearer {self.groq_api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 2000,
            "top_p": 1,
            "stream": False
        }
        
        try:
            response = requests.post(
                self.groq_api_url,
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result.get('choices', [{}])[0].get('message', {}).get('content', '')
                
                # Try to parse as JSON if it looks like JSON
                if content.strip().startswith('{'):
                    try:
                        return json.loads(content)
                    except json.JSONDecodeError:
                        return {'text': content}
                return {'text': content}
            else:
                print(f"Groq API Error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"Error calling Groq API: {str(e)}")
            return None
    
    def _collect_patient_data(self) -> Dict:
        """Collect all patient data from history entries"""
        from .models import MedicalHistoryEntry
        
        entries = MedicalHistoryEntry.objects.filter(
            workspace=self.workspace
        ).select_related('patient')
        
        # Organize by category
        conditions = entries.filter(category='condition', status='active')
        medications = entries.filter(category='medication', status='active')
        allergies = entries.filter(category='allergy')
        lab_results = entries.filter(category='lab_result').order_by('-start_date')[:20]
        surgeries = entries.filter(category='surgery')
        visits = entries.filter(category='visit').order_by('-start_date')[:10]
        
        # Calculate age
        age = 'Unknown'
        if self.patient.date_of_birth:
            today = date.today()
            age = today.year - self.patient.date_of_birth.year - (
                (today.month, today.day) < (self.patient.date_of_birth.month, self.patient.date_of_birth.day)
            )
        
        return {
            'patient_info': {
                'name': self.patient.full_name,
                'age': age,
                'gender': self.patient.gender or 'Unknown',
                'patient_id': self.patient.patient_id or 'N/A'
            },
            'active_conditions': [
                {
                    'title': c.title,
                    'since': str(c.start_date) if c.start_date else 'Unknown',
                    'severity': c.severity or 'Unknown',
                    'is_chronic': c.is_chronic,
                    'source': c.source
                }
                for c in conditions[:15]
            ],
            'current_medications': [
                {
                    'title': m.title,
                    'started': str(m.start_date) if m.start_date else 'Unknown',
                    'details': m.category_data.get('dosage', '') + ' ' + m.category_data.get('frequency', ''),
                    'purpose': m.category_data.get('purpose', '')
                }
                for m in medications[:15]
            ],
            'allergies': [
                {
                    'allergen': a.title,
                    'reaction': a.category_data.get('reaction', ''),
                    'severity': a.severity or 'Unknown'
                }
                for a in allergies[:10]
            ],
            'recent_labs': [
                {
                    'test': l.title,
                    'value': l.last_value or l.category_data.get('value', ''),
                    'date': str(l.start_date) if l.start_date else 'Unknown',
                    'abnormal': l.category_data.get('is_abnormal', False),
                    'reference': l.category_data.get('reference_range', '')
                }
                for l in lab_results
            ],
            'surgeries': [
                {
                    'procedure': s.title,
                    'date': str(s.start_date) if s.start_date else 'Unknown'
                }
                for s in surgeries[:10]
            ],
            'recent_visits': [
                {
                    'title': v.title,
                    'date': str(v.start_date) if v.start_date else 'Unknown',
                    'notes': v.description[:200] if v.description else ''
                }
                for v in visits
            ],
            'chronic_flags': entries.filter(is_chronic=True, status='active').count(),
            'critical_flags': entries.filter(is_critical=True, status='active').count(),
            'unverified_count': entries.filter(verified_by_doctor=False).count()
        }
    
    def generate_clinical_summary(self) -> Optional[Dict]:
        """
        Generate comprehensive clinical summary using Groq AI
        
        Returns:
            Dict with clinical_summary, risk_assessment, trends_detected, focus_points
        """
        patient_data = self._collect_patient_data()
        
        # Build prompt
        prompt = f"""You are an expert medical AI assistant. Generate a comprehensive clinical summary for this patient.

PATIENT INFORMATION:
- Name: {patient_data['patient_info']['name']}
- Age: {patient_data['patient_info']['age']}
- Gender: {patient_data['patient_info']['gender']}

ACTIVE MEDICAL CONDITIONS ({len(patient_data['active_conditions'])}):
{json.dumps(patient_data['active_conditions'], indent=2)}

CURRENT MEDICATIONS ({len(patient_data['current_medications'])}):
{json.dumps(patient_data['current_medications'], indent=2)}

ALLERGIES ({len(patient_data['allergies'])}):
{json.dumps(patient_data['allergies'], indent=2)}

RECENT LAB RESULTS:
{json.dumps(patient_data['recent_labs'][:10], indent=2)}

SURGICAL HISTORY:
{json.dumps(patient_data['surgeries'], indent=2)}

RECENT VISITS:
{json.dumps(patient_data['recent_visits'][:5], indent=2)}

FLAGS:
- Chronic conditions: {patient_data['chronic_flags']}
- Critical alerts: {patient_data['critical_flags']}
- Unverified entries: {patient_data['unverified_count']}

Generate a structured clinical summary in JSON format with the following keys:
{{
    "clinical_summary": "Comprehensive 3-4 paragraph clinical overview for doctor",
    "risk_assessment": {{
        "high_risk": ["risk factor 1", "risk factor 2"],
        "moderate_risk": ["risk factor 3"],
        "low_risk": []
    }},
    "trends_detected": [
        {{"parameter": "HbA1c", "direction": "worsening", "note": "Increased from X to Y"}},
        {{"parameter": "Blood Pressure", "direction": "stable", "note": "Well controlled"}}
    ],
    "focus_points": [
        "1. Priority action item for doctor",
        "2. Follow-up needed on X",
        "3. Consider medication adjustment for Y"
    ]
}}

Be specific, clinical, and actionable. Focus on what the doctor needs to know."""

        messages = [
            {
                "role": "system",
                "content": "You are an expert clinical AI assistant. Provide detailed, accurate medical summaries in JSON format."
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
        
        result = self._call_groq_api(messages, temperature=0.3)
        
        if result and isinstance(result, dict):
            # If we got a text response, try to extract JSON
            if 'text' in result:
                text = result['text']
                # Try to find JSON in the text
                try:
                    start = text.find('{')
                    end = text.rfind('}') + 1
                    if start != -1 and end > start:
                        json_str = text[start:end]
                        result = json.loads(json_str)
                except:
                    pass
            
            return result
        
        return None
    
    def analyze_parameter_trend(
        self,
        parameter_name: str,
        data_points: List[Dict],
        reference_range: str = '',
        current_abnormal: bool = False
    ) -> Optional[Dict]:
        """
        Analyze trend for a specific lab parameter
        
        Args:
            parameter_name: Name of the parameter (e.g., "HbA1c")
            data_points: List of {date, value, is_abnormal} dicts
            reference_range: Normal range text
            current_abnormal: Whether current value is abnormal
            
        Returns:
            Dict with interpretation and clinical_significance
        """
        if not data_points:
            return None
        
        prompt = f"""Analyze this lab test trend and provide clinical interpretation.

TEST: {parameter_name}
REFERENCE RANGE: {reference_range or 'Not provided'}
CURRENT STATUS: {'ABNORMAL' if current_abnormal else 'Normal'}

TIME SERIES DATA:
{json.dumps(data_points, indent=2)}

Provide a JSON response with:
{{
    "interpretation": "Clear explanation of the trend for a doctor (2-3 sentences)",
    "clinical_significance": "What this means clinically and any recommended actions",
    "trend_direction": "improving|worsening|stable|fluctuating"
}}

Be specific about values, dates, and clinical implications."""

        messages = [
            {
                "role": "system",
                "content": "You are a clinical laboratory AI specialist. Analyze lab trends and provide actionable insights."
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
        
        result = self._call_groq_api(messages, temperature=0.2)
        
        if result and 'text' in result:
            text = result['text']
            try:
                start = text.find('{')
                end = text.rfind('}') + 1
                if start != -1 and end > start:
                    json_str = text[start:end]
                    return json.loads(json_str)
            except:
                pass
        
        return result
    
    def identify_risk_factors(self) -> List[Dict]:
        """
        Identify medical risk factors from patient history
        
        Returns:
            List of risk factors with severity and explanation
        """
        patient_data = self._collect_patient_data()
        
        prompt = f"""Analyze this patient's medical history and identify risk factors.

PATIENT: {patient_data['patient_info']['age']} year old {patient_data['patient_info']['gender']}

CONDITIONS: {json.dumps(patient_data['active_conditions'], indent=2)}
MEDICATIONS: {json.dumps(patient_data['current_medications'], indent=2)}
RECENT LABS: {json.dumps(patient_data['recent_labs'][:10], indent=2)}

Identify medical risk factors in JSON array format:
[
    {{
        "risk_factor": "Name of risk",
        "severity": "high|moderate|low",
        "explanation": "Brief explanation why this is a risk",
        "recommendation": "What to monitor or do about it"
    }}
]

Focus on cardiovascular, metabolic, and medication interaction risks."""

        messages = [
            {
                "role": "system",
                "content": "You are a clinical risk assessment AI. Identify and prioritize patient risk factors."
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
        
        result = self._call_groq_api(messages, temperature=0.3)
        
        if result:
            if 'text' in result:
                text = result['text']
                try:
                    start = text.find('[')
                    end = text.rfind(']') + 1
                    if start != -1 and end > start:
                        json_str = text[start:end]
                        return json.loads(json_str)
                except:
                    pass
            elif isinstance(result, list):
                return result
        
        return []
    
    def suggest_focus_points(self) -> List[str]:
        """
        Generate doctor focus points for upcoming consultation
        
        Returns:
            List of actionable focus points
        """
        patient_data = self._collect_patient_data()
        
        prompt = f"""Based on this patient's history, suggest 3-5 focus points for the doctor's next consultation.

PATIENT DATA:
{json.dumps(patient_data, indent=2)}

Generate a JSON array of focus points:
[
    "1. Specific actionable focus point with context",
    "2. Another priority item",
    "3. Follow-up needed on X"
]

Be specific, actionable, and prioritize by urgency."""

        messages = [
            {
                "role": "system",
                "content": "You are a clinical workflow AI assistant. Help doctors prioritize patient care."
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
        
        result = self._call_groq_api(messages, temperature=0.4)
        
        if result:
            if 'text' in result:
                text = result['text']
                try:
                    start = text.find('[')
                    end = text.rfind(']') + 1
                    if start != -1 and end > start:
                        json_str = text[start:end]
                        return json.loads(json_str)
                except:
                    pass
            elif isinstance(result, list):
                return result
        
        return []
    
    def analyze_medication_interactions(self, medications: List[str]) -> Dict:
        """
        Check for potential medication interactions
        
        Args:
            medications: List of medication names
            
        Returns:
            Dict with interaction warnings
        """
        if len(medications) < 2:
            return {'interactions': [], 'warnings': []}
        
        prompt = f"""Analyze potential interactions between these medications:

MEDICATIONS:
{json.dumps(medications, indent=2)}

Provide JSON response:
{{
    "interactions": [
        {{
            "drug1": "medication name",
            "drug2": "medication name",
            "severity": "major|moderate|minor",
            "description": "Interaction description",
            "recommendation": "What to do"
        }}
    ],
    "warnings": ["General warning 1", "General warning 2"]
}}"""

        messages = [
            {
                "role": "system",
                "content": "You are a clinical pharmacology AI. Identify medication interactions and provide recommendations."
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
        
        result = self._call_groq_api(messages, temperature=0.2)
        
        if result and 'text' in result:
            text = result['text']
            try:
                start = text.find('{')
                end = text.rfind('}') + 1
                if start != -1 and end > start:
                    json_str = text[start:end]
                    return json.loads(json_str)
            except:
                pass
        
        return result or {'interactions': [], 'warnings': []}
