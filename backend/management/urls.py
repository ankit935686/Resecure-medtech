from django.urls import path
from . import views

app_name = 'management'

urlpatterns = [
    # Authentication endpoints
    path('signup/', views.admin_signup, name='admin-signup'),
    path('login/', views.admin_login, name='admin-login'),
    path('logout/', views.admin_logout, name='admin-logout'),
    
    # Profile endpoints
    path('profile/', views.AdminProfileView.as_view(), name='admin-profile'),
    path('profile/update/', views.AdminProfileUpdateView.as_view(), name='admin-profile-update'),
    path('me/', views.admin_current_user, name='admin-current-user'),
    
    # Doctor Verification endpoints (Admin only)
    path('doctors/pending/', views.pending_doctors_list, name='pending-doctors'),
    path('doctors/all/', views.all_doctors_list, name='all-doctors'),
    path('doctors/<int:doctor_id>/verify/', views.verify_doctor, name='verify-doctor'),
    path('doctors/<int:doctor_id>/reject/', views.reject_doctor, name='reject-doctor'),
]

