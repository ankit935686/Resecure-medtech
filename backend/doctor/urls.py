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
]

