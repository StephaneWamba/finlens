# API Reference

REST APIs for document management, conversational queries, authentication, and subscriptions.

## Base URL

Replace with your actual Railway deployment URL:

```
https://your-railway-url.up.railway.app/v1
```

Example:

```
https://finlens-backend-production.up.railway.app/v1
```

## Authentication

All API requests require authentication using JWT tokens in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Authentication

#### Sign Up

```http
POST /auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "full_name": "John Doe"
}
```

#### Sign In

```http
POST /auth/signin
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe"
  },
  "expires_in": 3600
}
```

#### Get Current User

```http
GET /auth/me
Authorization: Bearer <token>
```

### Documents

#### Upload Documents

```http
POST /documents/upload
Content-Type: multipart/form-data

files: [file1.pdf, file2.pdf]
descriptions: ["Q1 2024 Financial Report", "Annual Report 2023"]
```

Note: `descriptions` must be a JSON array string in form data.

**Response:**

```json
{
  "total": 2,
  "successful": 2,
  "failed": 0,
  "results": [
    {
      "document_id": "uuid",
      "status": "processing",
      "message": "Document uploaded successfully",
      "metadata": {
        "company": "Apple",
        "year": 2024,
        "document_type": "10-K"
      }
    }
  ]
}
```

#### List Documents

```http
GET /documents?limit=12&offset=0
```

**Response:**

```json
{
  "documents": [
    {
      "id": "uuid",
      "filename": "annual_report.pdf",
      "status": "indexed",
      "description": "2023 Annual Report",
      "pages": 150,
      "uploaded_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 25,
  "limit": 12,
  "offset": 0
}
```

#### Get Document

```http
GET /documents/{document_id}
```

#### Delete Document

```http
DELETE /documents/{document_id}
```

### Chat & Queries

#### Send Query

```http
POST /chat/query
Content-Type: application/json

{
  "query": "What are Apple's revenue trends for the last 3 years?",
  "session_id": "optional-session-uuid",
  "messages": [
    {
      "role": "user",
      "content": "Previous question"
    },
    {
      "role": "assistant",
      "content": "Previous answer"
    }
  ]
}
```

**Response:**

```json
{
  "text": "Apple's revenue has shown consistent growth over the past 3 years...",
  "charts": [
    {
      "type": "line",
      "data": {
        "labels": ["2022", "2023", "2024"],
        "datasets": [...]
      }
    }
  ],
  "sources": [
    {
      "company": "Apple Inc.",
      "ticker": "AAPL",
      "year": 2024,
      "document_type": "10-K",
      "page": 45
    }
  ],
  "metadata": {
    "processing_time": 1.2,
    "chunks_retrieved": 8
  }
}
```

#### Get Chat Sessions

```http
GET /chat/sessions?limit=50&offset=0
```

#### Get Session Messages

```http
GET /chat/sessions/{session_id}
```

### Users & Usage

#### Get User Profile

```http
GET /users/me
```

#### Get Usage Statistics

```http
GET /users/me/usage
```

**Response:**

```json
{
  "queries_used_this_month": 1250,
  "queries_limit": 5000,
  "documents_uploaded": 15,
  "documents_limit": 100,
  "subscription_plan": "pro"
}
```

### Subscriptions

#### Get Subscription

```http
GET /subscriptions/me
```

#### Create Subscription

```http
POST /subscriptions/create
Content-Type: application/json

{
  "price_id": "price_xxx"
}
```

### Health Checks

#### System Health

```http
GET /health
```

**Response:**

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "services": {
    "supabase": "connected",
    "qdrant": "connected",
    "openai": "configured"
  }
}
```

#### Readiness Check

```http
GET /health/ready
```

## Error Responses

All endpoints return standard HTTP status codes:

- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limited
- `500` - Internal Server Error

**Error Response Format:**

```json
{
  "detail": "Error description",
  "error_code": "SPECIFIC_ERROR_CODE"
}
```

## Rate Limits

Rate limiting is subscription-based. Users have monthly query limits based on their subscription tier. When limits are exceeded, requests return `429 Too Many Requests`:

```json
{
  "error": "Usage limit exceeded",
  "queries_used": 5000,
  "query_limit": 5000,
  "message": "You have reached your monthly query limit..."
}
```

## Support

For API support, create an issue at: [GitHub Issues](https://github.com/StephaneWamba/finlens/issues)
