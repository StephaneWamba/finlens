# Deployment Guide

Production deployment on Railway (backend) and Vercel (frontend).

## Prerequisites

| Service          | Purpose                 | Required |
| ---------------- | ----------------------- | -------- |
| **Railway**      | Backend hosting         | Yes      |
| **Vercel**       | Frontend hosting        | Yes      |
| **Supabase**     | PostgreSQL database     | Yes      |
| **Qdrant Cloud** | Vector database         | Yes      |
| **VastAI**       | GPU document processing | Yes      |
| **Redis**        | Task queue              | No       |

## Backend (Railway)

### 1. Configure Environment Variables

```bash
ENVIRONMENT=production
CORS_ORIGINS=https://your-frontend.vercel.app

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SECRET_KEY=your-service-role-key

# Vector Database
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your-qdrant-api-key

# AI Services
OPENAI_API_KEY=sk-...
VOYAGE_API_KEY=pa-...
VOYAGE_EMBEDDING_MODEL=voyage-large-2
EMBEDDING_DIMENSIONS=2048

# GPU Processing
VAST_AI_SERVER_URL=http://your-gpu-server:8080
VAST_AI_API_KEY=your-vast-ai-key

# Optional
REDIS_URL=redis://your-redis:6379
```

### 2. Deploy

```bash
railway up
```

Or connect GitHub repo for automatic deployments.

### 3. Verify

```bash
curl https://your-railway-url.up.railway.app/health
```

## Frontend (Vercel)

### 1. Connect Repository

Import GitHub repository, select `frontend` as root directory.

### 2. Environment Variables

```bash
NEXT_PUBLIC_API_URL=https://your-railway-url.up.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Configure Rewrites

`vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-railway-url.up.railway.app/v1/:path*"
    }
  ]
}
```

Vercel auto-deploys on push to main.

## Database Setup (Supabase)

### Run Migrations

```bash
supabase link --project-ref your-project-ref
supabase db push
```

### Enable RLS

```sql
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents"
ON user_documents FOR SELECT
USING (auth.uid() = user_id);
```

## Vector Database (Qdrant)

1. Create cluster at [Qdrant Cloud](https://cloud.qdrant.io)
2. Note cluster URL and API key
3. Collections auto-created on first use:
   - `document_chunks` (2048 dimensions)
   - `conversation_memory` (2048 dimensions)

## GPU Server (VastAI)

1. Deploy MinerU server on VastAI instance
2. Configure environment variables
3. Update `VAST_AI_SERVER_URL` in Railway

## Monitoring

- Health endpoints: `/health`, `/health/ready`
- Railway: Real-time logs, metrics dashboard
- Structured JSON logs in production

## Scaling

| Component          | Scaling Strategy                 |
| ------------------ | -------------------------------- |
| **Backend**        | Railway auto-scales on traffic   |
| **Frontend**       | Vercel edge network (global CDN) |
| **Database**       | Supabase auto-scaling            |
| **Vector DB**      | Qdrant Cloud cluster scaling     |
| **GPU Processing** | Multiple VastAI instances        |

## Troubleshooting

**Backend not starting**: Check Railway logs for missing env vars or connection failures.

**Frontend API errors**: Verify API rewrites in `vercel.json`.

**Document processing fails**: Check GPU server connectivity and `VAST_AI_SERVER_URL`.

## Security Checklist

- [ ] All API keys in environment variables
- [ ] CORS configured for specific origins
- [ ] Rate limiting enabled
- [ ] Row Level Security enabled
- [ ] HTTPS enforced
- [ ] API authentication required
