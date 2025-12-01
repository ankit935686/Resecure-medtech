from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from .models import AdminProfile


class AdminSignupSerializer(serializers.ModelSerializer):
    """Serializer for admin signup"""
    password = serializers.CharField(write_only=True, min_length=8, style={'input_type': 'password'})
    password_confirm = serializers.CharField(write_only=True, min_length=8, style={'input_type': 'password'})
    email = serializers.EmailField(required=True)
    username = serializers.CharField(required=True)
    
    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password_confirm')
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Passwords don't match."})
        return attrs
    
    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value
    
    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        # create_user automatically hashes the password
        user = User.objects.create_user(password=password, **validated_data)
        
        # Create admin profile
        AdminProfile.objects.create(user=user)
        
        return user


class AdminLoginSerializer(serializers.Serializer):
    """Serializer for admin login"""
    username = serializers.CharField(required=True, allow_blank=False)
    password = serializers.CharField(required=True, allow_blank=False, style={'input_type': 'password'}, write_only=True)
    
    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')
        
        if not username or not password:
            raise serializers.ValidationError({
                'non_field_errors': ["Must include both 'username' and 'password'."]
            })
        
        user = authenticate(username=username, password=password)
        if not user:
            raise serializers.ValidationError({
                'non_field_errors': ["Invalid username or password."]
            })
        
        if not user.is_active:
            raise serializers.ValidationError({
                'non_field_errors': ["User account is disabled."]
            })
        
        # Check if user has an admin profile
        try:
            admin_profile = user.admin_profile
        except AdminProfile.DoesNotExist:
            raise serializers.ValidationError({
                'non_field_errors': ["This account is not associated with an admin profile."]
            })
        
        attrs['user'] = user
        return attrs


class AdminProfileSerializer(serializers.ModelSerializer):
    """Serializer for admin profile"""
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    full_name = serializers.CharField(read_only=True)
    
    class Meta:
        model = AdminProfile
        fields = (
            'id', 'username', 'email', 'first_name', 'last_name', 
            'full_name', 'phone_number', 'department', 'bio',
            'profile_completed', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at', 'profile_completed')


class AdminProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating admin profile"""
    
    class Meta:
        model = AdminProfile
        fields = (
            'first_name', 'last_name', 'phone_number', 'department', 'bio'
        )
    
    def update(self, instance, validated_data):
        # Check if profile is being completed
        required_fields = ['first_name', 'last_name']
        if all(validated_data.get(field) for field in required_fields):
            instance.profile_completed = True
        
        return super().update(instance, validated_data)


class UserSerializer(serializers.ModelSerializer):
    """Basic user serializer"""
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name')

