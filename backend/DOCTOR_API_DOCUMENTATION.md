# Doctor Authentication API Documentation

## Setup Instructions

1. **Create and apply migrations:**
   ```bash
   cd backend
   python manage.py makemigrations
   python manage.py migrate
   ```

2. **Create a superuser (optional, for admin access):**
   ```bash
   python manage.py createsuperuser
   ```

3. **Run the development server:**
   ```bash
   python manage.py runserver
   ```

The API will be available at `http://127.0.0.1:8000/api/doctor/`

---

## API Endpoints

### Base URL
`http://127.0.0.1:8000/api/doctor/`

### 1. Doctor Signup
**Endpoint:** `POST /api/doctor/signup/`

**Request Body:**
```json
{
  "username": "dr_john_doe",
  "email": "john.doe@example.com",
  "password": "securepassword123",
  "password_confirm": "securepassword123"
}
```

**Response (201 Created):**
```json
{
  "message": "Doctor account created successfully",
  "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b",
  "user": {
    "id": 1,
    "username": "dr_john_doe",
    "email": "john.doe@example.com",
    "first_name": "",
    "last_name": ""
  },
  "profile": {
    "id": 1,
    "username": "dr_john_doe",
    "email": "john.doe@example.com",
    "first_name": "",
    "last_name": "",
    "full_name": "",
    "phone_number": "",
    "specialization": "",
    "license_number": null,
    "years_of_experience": null,
    "bio": "",
    "hospital_affiliation": "",
    "profile_completed": false,
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z"
  },
  "profile_completed": false,
  "redirect_to": "profile"
}
```

---

### 2. Doctor Login
**Endpoint:** `POST /api/doctor/login/`

**Request Body:**
```json
{
  "username": "dr_john_doe",
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
    "username": "dr_john_doe",
    "email": "john.doe@example.com",
    "first_name": "",
    "last_name": ""
  },
  "profile": {
    "id": 1,
    "username": "dr_john_doe",
    "email": "john.doe@example.com",
    "first_name": "",
    "last_name": "",
    "full_name": "",
    "phone_number": "",
    "specialization": "",
    "license_number": null,
    "years_of_experience": null,
    "bio": "",
    "hospital_affiliation": "",
    "profile_completed": false,
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z"
  },
  "profile_completed": false,
  "redirect_to": "profile"
}
```

---

### 3. Doctor Logout
**Endpoint:** `POST /api/doctor/logout/`

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

### 4. Get Current Doctor Profile
**Endpoint:** `GET /api/doctor/me/`

**Headers:**
```
Authorization: Token <your_token_here>
```

**Response (200 OK):**
```json
{
  "user": {
    "id": 1,
    "username": "dr_john_doe",
    "email": "john.doe@example.com",
    "first_name": "",
    "last_name": ""
  },
  "profile": {
    "id": 1,
    "username": "dr_john_doe",
    "email": "john.doe@example.com",
    "first_name": "",
    "last_name": "",
    "full_name": "",
    "phone_number": "",
    "specialization": "",
    "license_number": null,
    "years_of_experience": null,
    "bio": "",
    "hospital_affiliation": "",
    "profile_completed": false,
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z"
  },
  "profile_completed": false
}
```

---

### 5. Get Doctor Profile
**Endpoint:** `GET /api/doctor/profile/`

**Headers:**
```
Authorization: Token <your_token_here>
```

**Response (200 OK):**
```json
{
  "id": 1,
  "username": "dr_john_doe",
  "email": "john.doe@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "full_name": "John Doe",
  "phone_number": "+1234567890",
  "specialization": "Cardiology",
  "license_number": "MD123456",
  "years_of_experience": 10,
  "bio": "Experienced cardiologist with expertise in heart diseases.",
  "hospital_affiliation": "City General Hospital",
  "profile_completed": true,
  "created_at": "2024-01-01T12:00:00Z",
  "updated_at": "2024-01-01T13:00:00Z"
}
```

---

### 6. Update Doctor Profile
**Endpoint:** `PATCH /api/doctor/profile/update/` or `PUT /api/doctor/profile/update/`

**Headers:**
```
Authorization: Token <your_token_here>
Content-Type: application/json
```

**Request Body (all fields optional for PATCH):**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "phone_number": "+1234567890",
  "specialization": "Cardiology",
  "license_number": "MD123456",
  "years_of_experience": 10,
  "bio": "Experienced cardiologist with expertise in heart diseases.",
  "hospital_affiliation": "City General Hospital"
}
```

**Response (200 OK):**
```json
{
  "message": "Profile updated successfully",
  "profile": {
    "id": 1,
    "username": "dr_john_doe",
    "email": "john.doe@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "full_name": "John Doe",
    "phone_number": "+1234567890",
    "specialization": "Cardiology",
    "license_number": "MD123456",
    "years_of_experience": 10,
    "bio": "Experienced cardiologist with expertise in heart diseases.",
    "hospital_affiliation": "City General Hospital",
    "profile_completed": true,
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T13:00:00Z"
  },
  "profile_completed": true,
  "redirect_to": "dashboard"
}
```

**Note:** The `profile_completed` field is automatically set to `true` when all required fields (`first_name`, `last_name`, `specialization`, `license_number`) are provided.

---

## Testing with cURL

### Signup
```bash
curl -X POST http://127.0.0.1:8000/api/doctor/signup/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "dr_john_doe",
    "email": "john.doe@example.com",
    "password": "securepassword123",
    "password_confirm": "securepassword123"
  }'
```

### Login
```bash
curl -X POST http://127.0.0.1:8000/api/doctor/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "dr_john_doe",
    "password": "securepassword123"
  }'
```

### Get Profile (replace TOKEN with actual token)
```bash
curl -X GET http://127.0.0.1:8000/api/doctor/profile/ \
  -H "Authorization: Token YOUR_TOKEN_HERE"
```

### Update Profile (replace TOKEN with actual token)
```bash
curl -X PATCH http://127.0.0.1:8000/api/doctor/profile/update/ \
  -H "Authorization: Token YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "specialization": "Cardiology",
    "license_number": "MD123456"
  }'
```

---

## Testing with Postman

1. **Signup Request:**
   - Method: POST
   - URL: `http://127.0.0.1:8000/api/doctor/signup/`
   - Headers: `Content-Type: application/json`
   - Body (raw JSON):
     ```json
     {
       "username": "dr_john_doe",
       "email": "john.doe@example.com",
       "password": "securepassword123",
       "password_confirm": "securepassword123"
     }
     ```

2. **Login Request:**
   - Method: POST
   - URL: `http://127.0.0.1:8000/api/doctor/login/`
   - Headers: `Content-Type: application/json`
   - Body (raw JSON):
     ```json
     {
       "username": "dr_john_doe",
       "password": "securepassword123"
     }
     ```

3. **Get Profile:**
   - Method: GET
   - URL: `http://127.0.0.1:8000/api/doctor/profile/`
   - Headers: 
     - `Authorization: Token YOUR_TOKEN_HERE`
     - `Content-Type: application/json`

4. **Update Profile:**
   - Method: PATCH
   - URL: `http://127.0.0.1:8000/api/doctor/profile/update/`
   - Headers:
     - `Authorization: Token YOUR_TOKEN_HERE`
     - `Content-Type: application/json`
   - Body (raw JSON):
     ```json
     {
       "first_name": "John",
       "last_name": "Doe",
       "phone_number": "+1234567890",
       "specialization": "Cardiology",
       "license_number": "MD123456",
       "years_of_experience": 10,
       "bio": "Experienced cardiologist",
       "hospital_affiliation": "City General Hospital"
     }
     ```

---

## Error Responses

### 400 Bad Request (Validation Error)
```json
{
  "username": ["A user with this username already exists."],
  "email": ["A user with this email already exists."],
  "password": ["Passwords don't match."]
}
```

### 401 Unauthorized
```json
{
  "detail": "Authentication credentials were not provided."
}
```

### 400 Bad Request (Login Error)
```json
{
  "non_field_errors": ["Invalid username or password."]
}
```

---

## Notes

- All authenticated endpoints require the `Authorization: Token <token>` header
- The token is returned upon successful signup/login
- Profile completion status determines the `redirect_to` field in responses
- License numbers must be unique across all doctor profiles
- Password must be at least 8 characters long

