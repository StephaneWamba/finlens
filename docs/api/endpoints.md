# API Endpoints Reference

## Authentication

### POST `/api/v1/auth/login`
Authenticate user and return JWT tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

### POST `/api/v1/auth/refresh`
Refresh access token using refresh token.

## Documents

### POST `/api/v1/documents/upload`
Upload and process financial documents.

**Request (multipart/form-data):**
- `files`: Array of PDF files
- `descriptions`: JSON array of document descriptions

**Response:**
```json
{
  "documents": [
    {
      "id": "uuid",
      "filename": "alphabet_2023.pdf",
      "status": "processing",
      "upload_time": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### GET `/api/v1/documents`
List user's documents with pagination.

**Query Parameters:**
- `limit`: Number of documents (default: 12)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
{
  "documents": [
    {
      "id": "uuid",
      "filename": "alphabet_2023.pdf",
      "status": "indexed",
      "page_count": 150,
      "chunk_count": 1250,
      "company": "Alphabet Inc.",
      "fiscal_year": 2023,
      "upload_time": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 25,
  "limit": 12,
  "offset": 0
}
```

### DELETE `/api/v1/documents/{document_id}`
Delete a document and its associated data.

## Chat

### POST `/api/v1/chat/sessions`
Create a new chat session.

**Request Body:**
```json
{
  "title": "Alphabet Q4 Analysis"
}
```

**Response:**
```json
{
  "session_id": "uuid",
  "title": "Alphabet Q4 Analysis",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### POST `/api/v1/chat/message`
Send a message and get AI response.

**Request Body:**
```json
{
  "session_id": "uuid",
  "message": "What were Alphabet's revenue trends in 2023?",
  "include_sources": true
}
```

**Response:**
```json
{
  "response": "Alphabet's revenue grew 9% YoY to $307.4B in 2023...",
  "sources": [
    {
      "document_id": "uuid",
      "filename": "alphabet_2023_10k.pdf",
      "page_numbers": [15, 23, 45],
      "relevance_score": 0.95
    }
  ],
  "processing_time_ms": 1250
}
```

### GET `/api/v1/chat/sessions`
List user's chat sessions.

**Query Parameters:**
- `limit`: Number of sessions (default: 50)
- `offset`: Pagination offset (default: 0)

## Users

### GET `/api/v1/users/me`
Get current user profile and usage statistics.

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "subscription_plan": "pro",
  "queries_used_this_month": 1250,
  "query_limit": 5000,
  "documents_count": 15,
  "created_at": "2024-01-01T00:00:00Z"
}
```

## Subscriptions

### GET `/api/v1/subscriptions/plans`
Get available subscription plans.

**Response:**
```json
{
  "plans": [
    {
      "id": "free",
      "name": "Free",
      "price": 0,
      "features": {
        "monthly_queries": 100,
        "documents_limit": 5,
        "support_level": "community"
      }
    },
    {
      "id": "pro",
      "name": "Professional",
      "price": 29,
      "features": {
        "monthly_queries": 5000,
        "documents_limit": 100,
        "support_level": "priority"
      }
    }
  ]
}
```

## Error Responses

All endpoints return standardized error responses:

```json
{
  "detail": "Error message description",
  "error_code": "ERROR_CODE",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Common Error Codes
- `AUTHENTICATION_FAILED`: Invalid credentials
- `INSUFFICIENT_PERMISSIONS`: Access denied
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `RESOURCE_NOT_FOUND`: Entity doesn't exist
- `VALIDATION_ERROR`: Invalid input data
- `QUOTA_EXCEEDED`: Usage limit reached
