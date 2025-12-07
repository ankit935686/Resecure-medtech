from django.urls import path
from . import views

app_name = 'doctor'

urlpatterns = [
    # Authentication endpoints
    path('signup/', views.doctor_signup, name='doctor-signup'),
    path('login/', views.doctor_login, name='doctor-login'),
    path('logout/', views.doctor_logout, name='doctor-logout'),
    path('google-auth/', views.doctor_google_auth, name='doctor-google-auth'),
    
    # Profile endpoints
    path('profile/', views.DoctorProfileView.as_view(), name='doctor-profile'),
    path('profile/update/', views.DoctorProfileUpdateView.as_view(), name='doctor-profile-update'),
    path('me/', views.doctor_current_user, name='doctor-current-user'),
    
    # 4-Step Profile Setup endpoints
    path('profile/step0/consent/', views.profile_step0_consent, name='profile-step0-consent'),
    path('profile/step1/basic-info/', views.profile_step1_basic_info, name='profile-step1-basic'),
    path('profile/step2/credentials/', views.profile_step2_credentials, name='profile-step2-credentials'),
    path('profile/step3/contact/', views.profile_step3_contact, name='profile-step3-contact'),
    path('profile/submit/', views.profile_submit_verification, name='profile-submit'),
    path('profile/save-draft/', views.profile_save_draft, name='profile-save-draft'),
    path('profile/verification-status/', views.profile_verification_status, name='profile-verification-status'),
    
    # Patient Connection Management endpoints
    path('connections/requests/', views.get_connection_requests, name='connection-requests'),
    path('connections/patients/', views.get_connected_patients, name='connected-patients'),
    path('connections/<int:connection_id>/accept/', views.accept_connection_request, name='accept-connection'),
    path('connections/<int:connection_id>/reject/', views.reject_connection_request, name='reject-connection'),
    path('connections/<int:connection_id>/remove/', views.remove_patient_connection, name='remove-connection'),
    
    # Patient workspace endpoints
    path('workspaces/', views.doctor_list_workspaces, name='doctor-workspaces'),
    path('workspaces/<int:connection_id>/', views.doctor_workspace_detail, name='doctor-workspace-detail'),
    path('workspaces/<int:connection_id>/entries/', views.doctor_workspace_add_entry, name='doctor-workspace-add-entry'),
    
    # QR Code Generation endpoints
    path('qr/generate/', views.generate_qr_token, name='generate-qr'),
    path('qr/tokens/', views.get_my_qr_tokens, name='my-qr-tokens'),
    path('qr/<str:token_str>/delete/', views.delete_qr_token, name='delete-qr-token'),
    
    # Patient Search endpoints
    path('patients/search/', views.search_patients, name='search-patients'),
    path('patients/connect/', views.create_patient_connection, name='create-patient-connection'),
    path('patients/<int:patient_id>/profile/', views.get_patient_profile_detail, name='patient-profile-detail'),
    
    # Dashboard Summary endpoint
    path('dashboard/summary/', views.doctor_dashboard_summary, name='dashboard-summary'),
    
    # AI Intake Form endpoints
    path('intake-forms/create/', views.create_ai_intake_form, name='create-intake-form'),
    path('intake-forms/', views.list_doctor_intake_forms, name='list-intake-forms'),
    path('intake-forms/<int:form_id>/', views.get_intake_form_detail, name='intake-form-detail'),
    path('intake-forms/<int:form_id>/update/', views.update_intake_form, name='update-intake-form'),
    path('intake-forms/<int:form_id>/send/', views.send_intake_form_to_patient, name='send-intake-form'),
    path('intake-forms/<int:form_id>/delete/', views.delete_intake_form, name='delete-intake-form'),
]

