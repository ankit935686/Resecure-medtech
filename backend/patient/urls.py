from django.urls import path
from . import views

app_name = 'patient'

urlpatterns = [
    # Authentication endpoints
    path('signup/', views.patient_signup, name='patient-signup'),
    path('login/', views.patient_login, name='patient-login'),
    path('logout/', views.patient_logout, name='patient-logout'),
    path('google-auth/', views.patient_google_auth, name='patient-google-auth'),
    
    # Profile endpoints (legacy)
    path('profile/', views.PatientProfileView.as_view(), name='patient-profile'),
    path('profile/update/', views.PatientProfileUpdateView.as_view(), name='patient-profile-update'),
    path('me/', views.patient_current_user, name='patient-current-user'),
    
    # Profile Setup Wizard endpoints
    path('setup/consent/', views.submit_consent, name='submit-consent'),
    path('setup/step1/', views.submit_step1_basic_info, name='submit-step1'),
    path('setup/step2/', views.submit_step2_health_snapshot, name='submit-step2'),
    path('setup/step3/', views.submit_step3_preferences, name='submit-step3'),
    path('setup/finish/', views.finish_profile_setup, name='finish-profile-setup'),
    path('setup/status/', views.get_profile_setup_status, name='profile-setup-status'),
    
    # Doctor Linking endpoints
    path('doctors/search/', views.search_doctors, name='search-doctors'),
    path('connections/create/', views.create_connection_request, name='create-connection'),
    path('connections/', views.get_my_connections, name='my-connections'),
    path('connections/doctors/', views.get_connected_doctors, name='connected-doctors'),
    path('connections/<int:connection_id>/remove/', views.remove_connection, name='remove-connection'),
    path('connections/<int:connection_id>/accept/', views.accept_connection_request, name='accept-connection'),
    path('connections/<int:connection_id>/reject/', views.reject_connection_request, name='reject-connection'),

    # Patient-Doctor workspace endpoints
    path('workspaces/', views.list_patient_workspaces, name='patient-workspaces'),
    path('workspaces/<int:connection_id>/', views.get_patient_workspace_detail, name='patient-workspace-detail'),
    
    # QR Code Scanning endpoints
    path('qr/validate/<str:token>/', views.validate_qr_token, name='validate-qr-token'),
    path('qr/scan/<str:token>/', views.scan_qr_code, name='scan-qr-code'),
    
    # AI Intake Form endpoints (Patient Side)
    path('intake-forms/', views.list_patient_intake_forms, name='patient-intake-forms'),
    path('intake-forms/<int:form_id>/', views.get_patient_intake_form_detail, name='patient-intake-form-detail'),
    path('intake-forms/<int:form_id>/response/', views.save_form_response, name='save-form-response'),
    path('intake-forms/<int:form_id>/upload/', views.upload_form_file, name='upload-form-file'),
    path('intake-forms/<int:form_id>/upload/<int:upload_id>/delete/', views.delete_form_upload, name='delete-form-upload'),
    path('intake-forms/notifications/', views.get_intake_form_notifications, name='intake-form-notifications'),
    
    # Dashboard Summary endpoint
    path('dashboard/summary/', views.patient_dashboard_summary, name='patient-dashboard-summary'),
]

