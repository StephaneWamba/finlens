# Production Deployment Guide

## Overview

This guide covers deploying FinLens to production using Railway (backend) and Vercel (frontend). The architecture uses:

- **Railway**: Backend services, databases, and GPU processing
- **Vercel**: Frontend hosting with API proxying
- **Supabase**: Primary database and file storage
- **Qdrant**: Vector database for embeddings
- **Redis**: Caching and task queuing

## Prerequisites

### Required Accounts
- [Railway](https://railway.app) - Cloud deployment platform
- [Vercel](https://vercel.com) - Frontend hosting
- [Supabase](https://supabase.com) - Database and storage
- [Qdrant Cloud](https://qdrant.tech) - Vector database
- [Stripe](https://stripe.com) - Payment processing (optional)

### System Requirements
- Python 3.12+
- Node.js 18+
- PostgreSQL (via Supabase)
- Redis (via Railway/Upstash)

## Infrastructure Setup

### 1. Supabase Configuration

Create a new Supabase project and configure:

```sql
-- Run migrations from supabase/migrations/
-- This creates users, documents, conversations, and usage tables
```

**Environment Variables:**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SECRET_KEY=your-service-role-key
```

### 2. Qdrant Cloud Setup

Create a Qdrant Cloud cluster:

```bash
# Cluster configuration
# - 1GB RAM minimum
# - 10GB storage minimum
# - Frankfurt region (for EU compliance)
```

**Environment Variables:**
```bash
QDRANT_URL=https://your-cluster.qdrant.cloud
QDRANT_API_KEY=your-api-key
```

### 3. External Services Configuration

**Voyage AI (Embeddings):**
```bash
VOYAGE_API_KEY=your-voyage-key
VOYAGE_EMBEDDING_MODEL=voyage-large-2
```

**OpenAI (LLM):**
```bash
OPENAI_API_KEY=your-openai-key
```

**Stripe (Payments - Optional):**
```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Railway Deployment

### Backend Service

1. **Connect Repository:**
   ```bash
   railway login
   railway link
   ```

2. **Configure Environment Variables:**
   ```bash
   # Database & Storage
   railway variables set SUPABASE_URL="https://..."
   railway variables set SUPABASE_KEY="..."
   railway variables set SUPABASE_SECRET_KEY="..."

   # AI Services
   railway variables set QDRANT_URL="https://..."
   railway variables set QDRANT_API_KEY="..."
   railway variables set VOYAGE_API_KEY="..."
   railway variables set OPENAI_API_KEY="..."

   # Security
   railway variables set SECRET_KEY="your-secret-key"
   railway variables set JWT_SECRET_KEY="your-jwt-secret"

   # Optional Services
   railway variables set VAST_AI_SERVER_URL="http://..."
   railway variables set STRIPE_SECRET_KEY="..."
   ```

3. **Database Setup:**
   ```bash
   # Railway will automatically run database migrations
   # Verify schema with:
   railway run python -c "from backend.config.database.supabase_client import get_supabase; print('Connected')"
   ```

4. **Deploy:**
   ```bash
   railway up
   ```

### GPU Processor Service (Optional)

For document processing acceleration:

1. **Create New Service:**
   ```bash
   railway add --name finlens-gpu-processor
   ```

2. **Configure GPU Environment:**
   ```bash
   # Railway GPU instances available in beta
   # Configure environment variables same as backend
   ```

## Vercel Deployment

### Frontend Deployment

1. **Connect Repository:**
   ```bash
   vercel login
   vercel link
   ```

2. **Configure Environment Variables:**
   ```bash
   # API Configuration
   vercel env add NEXT_PUBLIC_API_URL
   # Set to: https://your-railway-app.railway.app

   # Optional: Analytics, Monitoring
   vercel env add NEXT_PUBLIC_LOGROCKET_APP_ID
   ```

3. **Configure Rewrites:**
   ```json
   // vercel.json (in frontend/ directory)
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://your-railway-app.railway.app/v1/:path*"
       }
     ]
   }
   ```

4. **Deploy:**
   ```bash
   vercel --prod
   ```

## Monitoring & Observability

### Health Checks

Railway automatically monitors:
- HTTP response times
- Error rates
- CPU/Memory usage

**Custom Health Endpoints:**
- `GET /health` - Service health
- `GET /metrics` - Application metrics

### Logging

Logs are available in Railway dashboard:
```bash
railway logs
```

**Log Structure:**
```
timestamp [LEVEL] module - message
2024-01-15 10:30:00,123 [INFO] backend.api.main - Starting FinLens API...
```

### Performance Monitoring

Monitor key metrics:
- API response times (<500ms target)
- Document processing throughput
- Vector search latency
- Database query performance

## Scaling Configuration

### Railway Scaling

**Vertical Scaling:**
```bash
# Increase RAM/CPU via Railway dashboard
# Current: 1GB RAM, 1 vCPU (free tier)
# Production: 4GB RAM, 2 vCPU minimum
```

**Horizontal Scaling:**
- Railway supports automatic scaling
- Configure based on traffic patterns
- Monitor costs vs performance

### Database Scaling

**Supabase Scaling:**
- Start with Pro plan ($25/month)
- Scale to Team plan for high traffic
- Monitor connection limits

**Qdrant Scaling:**
- Scale storage based on document volume
- Monitor vector search latency
- Consider read replicas for high traffic

## Security Configuration

### Environment Variables
- Never commit secrets to code
- Use Railway's encrypted variable storage
- Rotate keys regularly

### Network Security
- HTTPS enabled by default on Railway/Vercel
- CORS configured for frontend domain
- Rate limiting active (100 req/min free tier)

### Data Security
- Supabase RLS (Row Level Security) enabled
- User data isolation
- Encrypted data transmission

## Backup & Recovery

### Database Backups
- Supabase automatic daily backups
- Point-in-time recovery available
- Export data regularly for local backup

### Application Backups
- Code backed up in Git
- Railway maintains deployment history
- Easy rollback to previous versions

## Troubleshooting

### Common Issues

**Database Connection Issues:**
```bash
# Check Supabase connection
railway run python -c "from backend.config.database.supabase_client import get_supabase; print('OK')"
```

**Qdrant Connection Issues:**
```bash
# Test vector database
railway run python -c "from backend.core.ai.vector_db.qdrant_client import get_qdrant_client; print('OK')"
```

**Build Failures:**
```bash
# Check Railway build logs
railway logs --build
```

### Performance Issues

**Slow API Responses:**
- Check database query performance
- Monitor Qdrant search latency
- Review application logs for bottlenecks

**High Memory Usage:**
- Monitor Railway metrics
- Check for memory leaks in async code
- Consider vertical scaling

## Cost Optimization

### Railway Costs
- Free tier: $0/month (512MB RAM, 1GB storage)
- Hobby tier: $5/month (1GB RAM, 5GB storage)
- Pro tier: $10/month (4GB RAM, 10GB storage)

### Supabase Costs
- Pro plan: $25/month (500MB database, 50GB bandwidth)
- Scale based on usage

### Qdrant Costs
- Free tier: 1GB vectors
- Paid tier: $0.10/GB/month

**Estimated Monthly Cost:** $35-50 for small production deployment
