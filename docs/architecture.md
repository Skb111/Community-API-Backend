# Authentication & User Management — Architecture

## Overview
This epic provides authentication and user management features for the backend:
- Signup, login, logout
- Access/refresh token lifecycle
- Email verification and password reset
- Social login (OAuth) via external providers
- User CRUD and profile management

## Responsibilities
- Centralized auth logic and session handling
- Secure credential storage and recovery flows
- Integrations with external identity providers

## System diagram
![System architecture](./assets/monolith_backend.png)

If you prefer inline diagrams while the final PNG is added, here's a mermaid flowchart showing the system components:

```mermaid
flowchart LR
  Client["Client - Web / Mobile"] -->|HTTPS| API[Backend API - Monolith]
  API -->|Read/Write| DB[(PostgreSQL)]
  API -->|Send email| EmailSvc[Email Service]
  API -->|OAuth exchange| OAuth[External OAuth Providers]
  subgraph Monolith
    API
  end
  style Monolith fill:#f9f,stroke:#333,stroke-width:1px
```

## High-level flow (request lifecycle)
1. Client -> POST /auth/signup  
2. Backend validates input, creates user, hashes password, sends verification email  
3. Client -> POST /auth/login -> returns access token (short-lived) and refresh token (long-lived)  
4. Client uses access token to call protected APIs (Authorization: Bearer <access_token>)  
5. When access token expires, client POSTs /auth/refresh with refresh token for a new access token  
6. Logout invalidates refresh token / session

### Signup / Login / Refresh sequence

```mermaid
sequenceDiagram
  participant C as Client
  participant S as Server (API)
  participant DB as PostgreSQL
  participant E as EmailService

  C->>S: POST /auth/signup (email, password)
  S->>DB: create user row (password hashed)
  S->>E: send verification email
  E-->>C: verification link

  C->>S: POST /auth/login (email, password)
  S->>DB: verify credentials
  S-->>C: accessToken (JWT) + refreshToken (opaque)

  C->>S: GET /protected (Authorization: Bearer accessToken)
  S->>DB: validate token/session as needed
  S-->>C: 200 OK

  C->>S: POST /auth/refresh (refreshToken)
  S->>DB: validate & rotate refresh token
  S-->>C: new accessToken (+ new refreshToken)
```

## Directory & service overview
- src/
  - controllers/auth
  - services/auth
  - models/user
  - migrations/
- Database: PostgreSQL
- Local dev: Docker Compose with db and backend services

## Notes
- All tokens must be signed with environment-stored secrets.
- See security.md for crypto, token rotation, and storage guidance.