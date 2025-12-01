from django.urls import path
from . import views

app_name = 'patient'

urlpatterns = [
    # Authentication endpoints
    path('signup/', views.patient_signup, name='patient-signup'),
    path('login/', views.patient_login, name='patient-login'),
    path('logout/', views.patient_logout, name='patient-logout'),
    path('google-auth/', views.patient_google_auth, name='patient-google-auth'),
    
    # Profile endpoints
    path('profile/', views.PatientProfileView.as_view(), name='patient-profile'),
    path('profile/update/', views.PatientProfileUpdateView.as_view(), name='patient-profile-update'),
    path('me/', views.patient_current_user, name='patient-current-user'),
]

