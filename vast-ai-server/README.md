# Vast.ai GPU Server

Clean, modular FastAPI server for GPU-accelerated PDF processing with MinerU.

## Structure

- **`config.py`** - Configuration management (environment variables)
- **`models.py`** - Pydantic models for API requests/responses
- **`storage.py`** - Supabase storage operations
- **`mineru.py`** - MinerU PDF parsing operations
- **`indexer.py`** - Qdrant indexing operations (chunking, embeddings, vector storage)
- **`queue.py`** - Redis queue management (with in-memory fallback)
- **`worker.py`** - Background worker for processing tasks
- **`main.py`** - FastAPI application and endpoints

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set environment variables:
```bash
export SUPABASE_URL="..."
export SUPABASE_SECRET_KEY="..."
export VOYAGE_API_KEY="..."
export QDRANT_URL="..."
export QDRANT_API_KEY="..."
export REDIS_URL="redis://localhost:6379"  # Optional
export MAX_CONCURRENT_WORKERS=2
export MINERU_BACKEND="vlm-vllm"
```

3. Install Redis (optional, for production queue):
```bash
apt update && apt install -y redis-server
systemctl start redis
```

4. Run the server:
```bash
python -m vast_ai_server.main
# or
python main.py
```

## API Endpoints

- `GET /` - Health check
- `GET /health` - Detailed health check
- `GET /status/{task_id}` - Get task status
- `POST /process` - Process PDF files (returns task_id immediately)

## Features

- ✅ Redis queue for congestion handling
- ✅ Worker pool with configurable concurrency
- ✅ GPU-accelerated MinerU processing
- ✅ Supabase storage integration
- ✅ Qdrant indexing with Voyage AI embeddings
- ✅ Webhook support for async notifications
- ✅ In-memory queue fallback (if Redis unavailable)


