# API — Authentication & User Management

Base path: /api or /

All endpoints below assume JSON requests/responses unless noted otherwise.

## Auth endpoints

### POST /auth/signup
- Purpose: Create user + send verification email
- Body:

```json
{
  "fullname": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

- Response 201:

```json
{
  "success": true,
  "message": "User registered successfully"
}
```

- Errors: 400 validation, 409 email exists

### POST /auth/login
- Purpose: Authenticate and return tokens
- Body:

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

- Response 200:

```json
{
  "success": true,
  "message": "User signed in successfully"
}
```

### POST /auth/refresh
- Purpose: Exchange refresh token for new access token
- Body:

```json
{
  "refreshToken": "<opaque-token>"
}
```

- Response 200:

```json
{
  "success": true,
  "message": "Tokens refreshed"
}
```

### POST /auth/logout
- Purpose: Revoke current session/refresh token
- Auth required: yes (accessToken or refresh token)
- Response: 204 No Content

### GET /auth/providers/:provider/callback
- Purpose: OAuth callback from external provider
- Notes: server-side exchange and user linking/creation

## User management

### GET /users/profile
- Auth required: yes
- Response 200:

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "fullname": "Jane Doe",
    "email": "jane.doe@example.com",
    "role": "USER",
    "skills": [
      "skill-1",
      "skill-2",
      "skill-3"
    ],
    "createdAt": "2025-10-14T12:00:00.000Z",
    "updatedAt": "2025-10-14T12:00:00.000Z"
  }
}
```

### PATCH /users/me
- Body: partial user fields (name, preferences)
- Response 200: updated user

## Auth sequence (login + protected request)

```mermaid
sequenceDiagram
  participant C as Client
  participant S as Server
  participant DB as Database

  C->>S: POST /auth/login (email, password)
  S->>DB: check credentials
  DB-->>S: user row
  S-->>C: { accessToken, refreshToken }

  C->>S: GET /users/me (Authorization: Bearer accessToken)
  S->>S: verify JWT signature & claims
  S->>DB: fetch user by id
  S-->>C: user profile
```

## OAuth callback

```mermaid
sequenceDiagram
  participant B as Browser
  participant S as Server
  participant O as OAuth Provider
  participant DB as Database

  B->>O: user authenticates on provider
  O-->>B: redirect to /auth/providers/:provider/callback?code=...
  B->>S: GET /auth/providers/:provider/callback?code=...
  S->>O: exchange code for tokens
  O-->>S: provider user info
  S->>DB: find or create user, link provider
  S-->>B: set session / tokens and redirect
```

## Errors & codes
- 400 Bad Request — validation  
- 401 Unauthorized — invalid or expired token  
- 403 Forbidden — insufficient rights  
- 404 Not Found — resource missing  
- 429 Too Many Requests — rate limits

## Examples
cURL login:

```bash
curl -X POST https://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"x","password":"y"}'
```

Postman collection: `docs/postman/auth.postman_collection.json` (optional)