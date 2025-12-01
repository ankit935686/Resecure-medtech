# Admin and Patient Authentication API Documentation

## Setup Instructions

1. **Create and apply migrations:**
   ```bash
   cd backend
   python manage.py makemigrations
   python manage.py migrate
   ```

2. **Run the development server:**
   ```bash
   python manage.py runserver
   ```

---

## Admin API Endpoints

### Base URL
`http://127.0.0.1:8000/api/admin/`

### 1. Admin Signup
**Endpoint:** `POST /api/admin/signup/`

**Request Body:**
```json
{
  "username": "admin_user",
  "email": "admin@example.com",
  "password": "securepassword123",
  "password_confirm": "securepassword123"
}
```

**Response (201 Created):**
```json
{
  "message": "Admin account created successfully",
  "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b",
  "user": {
    "id": 1,
    "username": "admin_user",
    "email": "admin@example.com",
    "first_name": "",
    "last_name": ""
  },
  "profile": {
    "id": 1,
    "username": "admin_user",
    "email": "admin@example.com",
    "first_name": "",
    "last_name": "",
    "full_name": "",
    "phone_number": "",
    "department": "",
    "bio": "",
    "profile_completed": false,
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z"
  },
  "profile_completed": false,
  "redirect_to": "dashboard"
}
```

**Note:** Admin always redirects to `dashboard` after login/signup.

---

### 2. Admin Login
**Endpoint:** `POST /api/admin/login/`

**Request Body:**
```json
{
  "username": "admin_user",
  "password": "securepassword123"
}
```

**Response (200 OK):**
```json
{
  "message": "Login successful",
  "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b",
  "user": {
    "id": 1,
    "username": "admin_user",
    "email": "admin@example.com",
    "first_name": "",
    "last_name": ""
  },
  "profile": {
    "id": 1,
    "username": "admin_user",
    "email": "admin@example.com",
    "first_name": "",
    "last_name": "",
    "full_name": "",
    "phone_number": "",
    "department": "",
    "bio": "",
    "profile_completed": false,
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z"
  },
  "profile_completed": false,
  "redirect_to": "dashboard"
}
```

---

### 3. Admin Logout
**Endpoint:** `POST /api/admin/logout/`

**Headers:**
```
Authorization: Token <your_token_here>
```

**Response (200 OK):**
```json
{
  "message": "Logout successful"
}
```

---

### 4. Get Admin Profile
**Endpoint:** `GET /api/admin/profile/`

**Headers:**
```
Authorization: Token <your_token_here>
```

**Response (200 OK):**
```json
{
  "id": 1,
  "username": "admin_user",
  "email": "admin@example.com",
  "first_name": "John",
  "last_name": "Admin",
  "full_name": "John Admin",
  "phone_number": "+1234567890",
  "department": "IT",
  "bio": "System administrator",
  "profile_completed": true,
  "created_at": "2024-01-01T12:00:00Z",
  "updated_at": "2024-01-01T13:00:00Z"
}
```

---

### 5. Update Admin Profile
**Endpoint:** `PATCH /api/admin/profile/update/` or `PUT /api/admin/profile/update/`

**Headers:**
```
Authorization: Token <your_token_here>
Content-Type: application/json
```

**Request Body (all fields optional for PATCH):**
```json
{
  "first_name": "John",
  "last_name": "Admin",
  "phone_number": "+1234567890",
  "department": "IT",
  "bio": "System administrator"
}
```

**Response (200 OK):**
```json
{
  "message": "Profile updated successfully",
  "profile": {
    "id": 1,
    "username": "admin_user",
    "email": "admin@example.com",
    "first_name": "John",
    "last_name": "Admin",
    "full_name": "John Admin",
    "phone_number": "+1234567890",
    "department": "IT",
    "bio": "System administrator",
    "profile_completed": true,
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T13:00:00Z"
  },
  "profile_completed": true,
  "redirect_to": "dashboard"
}
```

**Note:** Profile is marked as completed when `first_name` and `last_name` are provided.

---

### 6. Get Current Admin User
**Endpoint:** `GET /api/admin/me/`

**Headers:**
```
Authorization: Token <your_token_here>
```

**Response (200 OK):**
```json
{
  "user": {
    "id": 1,
    "username": "admin_user",
    "email": "admin@example.com",
    "first_name": "John",
    "last_name": "Admin"
  },
  "profile": {
    "id": 1,
    "username": "admin_user",
    "email": "admin@example.com",
    "first_name": "John",
    "last_name": "Admin",
    "full_name": "John Admin",
    "phone_number": "+1234567890",
    "department": "IT",
    "bio": "System administrator",
    "profile_completed": true,
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T13:00:00Z"
  },
  "profile_completed": true,
  "redirect_to": "dashboard"
}
```

---

## Patient API Endpoints

### Base URL
`http://127.0.0.1:8000/api/patient/`

### 1. Patient Signup
**Endpoint:** `POST /api/patient/signup/`

**Request Body:**
```json
{
  "username": "patient_user",
  "email": "patient@example.com",
  "password": "securepassword123",
  "password_confirm": "securepassword123"
}
```

**Response (201 Created):**
```json
{
  "message": "Patient account created successfully",
  "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b",
  "user": {
    "id": 1,
    "username": "patient_user",
    "email": "patient@example.com",
    "first_name": "",
    "last_name": ""
  },
  "profile": {
    "id": 1,
    "username": "patient_user",
    "email": "patient@example.com",
    "first_name": "",
    "last_name": "",
    "full_name": "",
    "phone_number": "",
    "date_of_birth": null,
    "blood_group": "",
    "emergency_contact_name": "",
    "emergency_contact_phone": "",
    "address": "",
    "bio": "",
    "profile_completed": false,
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z"
  },
  "profile_completed": false,
  "redirect_to": "profile"
}
```

**Note:** Patient always redirects to `profile` page after login/signup.

---

### 2. Patient Login
**Endpoint:** `POST /api/patient/login/`

**Request Body:**
```json
{
  "username": "patient_user",
  "password": "securepassword123"
}
```

**Response (200 OK):**
```json
{
  "message": "Login successful",
  "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b",
  "user": {
    "id": 1,
    "username": "patient_user",
    "email": "patient@example.com",
    "first_name": "",
    "last_name": ""
  },
  "profile": {
    "id": 1,
    "username": "patient_user",
    "email": "patient@example.com",
    "first_name": "",
    "last_name": "",
    "full_name": "",
    "phone_number": "",
    "date_of_birth": null,
    "blood_group": "",
    "emergency_contact_name": "",
    "emergency_contact_phone": "",
    "address": "",
    "bio": "",
    "profile_completed": false,
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z"
  },
  "profile_completed": false,
  "redirect_to": "profile"
}
```

---

### 3. Patient Logout
**Endpoint:** `POST /api/patient/logout/`

**Headers:**
```
Authorization: Token <your_token_here>
```

**Response (200 OK):**
```json
{
  "message": "Logout successful"
}
```

---

### 4. Get Patient Profile
**Endpoint:** `GET /api/patient/profile/`

**Headers:**
```
Authorization: Token <your_token_here>
```

**Response (200 OK):**
```json
{
  "id": 1,
  "username": "patient_user",
  "email": "patient@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "full_name": "Jane Doe",
  "phone_number": "+1234567890",
  "date_of_birth": "1990-01-15",
  "blood_group": "O+",
  "emergency_contact_name": "John Doe",
  "emergency_contact_phone": "+1234567891",
  "address": "123 Main St, City, State",
  "bio": "",
  "profile_completed": true,
  "created_at": "2024-01-01T12:00:00Z",
  "updated_at": "2024-01-01T13:00:00Z"
}
```

---

### 5. Update Patient Profile
**Endpoint:** `PATCH /api/patient/profile/update/` or `PUT /api/patient/profile/update/`

**Headers:**
```
Authorization: Token <your_token_here>
Content-Type: application/json
```

**Request Body (all fields optional for PATCH):**
```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "phone_number": "+1234567890",
  "date_of_birth": "1990-01-15",
  "blood_group": "O+",
  "emergency_contact_name": "John Doe",
  "emergency_contact_phone": "+1234567891",
  "address": "123 Main St, City, State",
  "bio": "Patient information"
}
```

**Response (200 OK):**
```json
{
  "message": "Profile updated successfully",
  "profile": {
    "id": 1,
    "username": "patient_user",
    "email": "patient@example.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "full_name": "Jane Doe",
    "phone_number": "+1234567890",
    "date_of_birth": "1990-01-15",
    "blood_group": "O+",
    "emergency_contact_name": "John Doe",
    "emergency_contact_phone": "+1234567891",
    "address": "123 Main St, City, State",
    "bio": "Patient information",
    "profile_completed": true,
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T13:00:00Z"
  },
  "profile_completed": true,
  "redirect_to": "profile"
}
```

**Note:** Profile is marked as completed when `first_name`, `last_name`, and `phone_number` are provided.

---

### 6. Get Current Patient User
**Endpoint:** `GET /api/patient/me/`

**Headers:**
```
Authorization: Token <your_token_here>
```

**Response (200 OK):**
```json
{
  "user": {
    "id": 1,
    "username": "patient_user",
    "email": "patient@example.com",
    "first_name": "Jane",
    "last_name": "Doe"
  },
  "profile": {
    "id": 1,
    "username": "patient_user",
    "email": "patient@example.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "full_name": "Jane Doe",
    "phone_number": "+1234567890",
    "date_of_birth": "1990-01-15",
    "blood_group": "O+",
    "emergency_contact_name": "John Doe",
    "emergency_contact_phone": "+1234567891",
    "address": "123 Main St, City, State",
    "bio": "",
    "profile_completed": true,
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T13:00:00Z"
  },
  "profile_completed": true,
  "redirect_to": "profile"
}
```

---

## Testing with cURL

### Admin Signup
```bash
curl -X POST http://127.0.0.1:8000/api/admin/signup/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin_user",
    "email": "admin@example.com",
    "password": "securepassword123",
    "password_confirm": "securepassword123"
  }'
```

### Admin Login
```bash
curl -X POST http://127.0.0.1:8000/api/admin/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin_user",
    "password": "securepassword123"
  }'
```

### Patient Signup
```bash
curl -X POST http://127.0.0.1:8000/api/patient/signup/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "patient_user",
    "email": "patient@example.com",
    "password": "securepassword123",
    "password_confirm": "securepassword123"
  }'
```

### Patient Login
```bash
curl -X POST http://127.0.0.1:8000/api/patient/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "patient_user",
    "password": "securepassword123"
  }'
```

---

## Redirect Behavior

- **Admin**: Always redirects to `dashboard` after login/signup
- **Patient**: Always redirects to `profile` page after login/signup
- **Doctor**: Redirects to `profile` if profile not completed, otherwise `dashboard`

---

## Notes

- All authenticated endpoints require the `Authorization: Token <token>` header
- The token is returned upon successful signup/login
- Profile completion status is automatically updated when required fields are filled
- Password must be at least 8 characters long
- All endpoints follow the same authentication pattern as the doctor endpoints

