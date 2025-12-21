# MinerU GPU Server Configuration

**Date:** November 25, 2025  
**Server Type:** Vast.ai GPU Server  
**Status:** Production Ready

---

## Hardware Specifications

- **GPU:** NVIDIA GeForce RTX 3090
- **GPU Memory:** 24,576 MB (24 GB)
- **GPU Driver:** 560.35.03
- **CUDA:** Available (compiler version from Oct 29, 2024)
- **Python:** 3.12.3
- **OS:** Linux 6.8.0-51-generic

---

## Environment Variables (.env)

Create a `.env` file in `/root/vast-ai-server/` with the following:

```bash
# Supabase Configuration
SUPABASE_URL=https://yyfeelihmisxyfgsawjo.supabase.co
SUPABASE_SECRET_KEY=sb_secret_uqZ49Aq63ybNgBoj4lr7fw_zpsuIowd
DOCUMENT_STORAGE_BUCKET=user-documents

# MinerU Configuration
MINERU_TIMEOUT_SECONDS=3600
MINERU_BACKEND=vlm-vllm-engine
MINERU_MODEL_SOURCE=huggingface
CUDA_VISIBLE_DEVICES=0

# Server Configuration
PORT=8080
HOST=0.0.0.0

# Queue Configuration
REDIS_URL=redis://localhost:6379
MAX_CONCURRENT_WORKERS=2
WEBHOOK_URL=

# Indexing Configuration
VOYAGE_API_KEY=pa-m8yGn9ddwNVz-lg_tuAV77XYpWi2-Pjwuz31YwTQpyY
VOYAGE_EMBEDDING_MODEL=voyage-large-2
QDRANT_URL=https://5a5736b6-0343-40de-b4a4-c688446a0203.europe-west3-0.gcp.cloud.qdrant.io
QDRANT_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.O79fWnGpt06rAGfAdKkCJ6tF7Pz54_d5fo5qYbG5FYE
COLLECTION_NAME=document_chunks

# Optional API Key
API_KEY=4fa2bb26ab6947b21110c96bd7d9d0c9355f984deacb0f9914beb7bbd0a29df5
```

**Note:** Replace API keys and secrets with your own values.

---

## Key Package Versions

```
fastapi==0.122.0
uvicorn==0.38.0
pydantic (latest)
mineru==2.6.4
mineru_vl_utils==0.1.16
transformers==4.56.2  # CRITICAL: Must be 4.56.2 (not 4.57.2) for vLLM compatibility
qdrant-client==1.16.0
redis==7.1.0
voyageai (latest)
supabase (latest)
python-dotenv (latest)
httpx (latest)
requests (latest)
PyPDF2 (latest)
```

---

## Critical Configuration Details

### 1. MinerU Backend

- **Backend:** `vlm-vllm-engine` (NOT `vlm-vllm` or `vlm-transformers`)
- **Model Source:** `huggingface`
- **Timeout:** 3600 seconds (1 hour)

### 2. Server Port Configuration

- **Internal Port:** Always `8080` (hardcoded in `config.py`)
- **External Port:** Vast.ai maps to `41960` (via `VAST_TCP_PORT_8080`)
- **Host:** `0.0.0.0` (listen on all interfaces)

### 3. Concurrency Settings

- **Max Concurrent Workers:** `2` (optimal for RTX 3090)
- **Worker Semaphore:** Limits parallel processing to prevent GPU OOM

### 4. Transformers Version Fix

**CRITICAL:** Must use `transformers==4.56.2` (NOT 4.57.2)

- Version 4.57.2 causes `AttributeError: 'dict' object has no attribute 'model_type'` with vLLM
- Install with: `pip install transformers==4.56.2`

---

## Installation Steps

1. **Create virtual environment:**

```bash
cd /root/vast-ai-server
python3 -m venv venv
source venv/bin/activate
```

2. **Install dependencies:**

```bash
pip install --upgrade pip
pip install -r requirements.txt
pip install transformers==4.56.2  # CRITICAL: Specific version
```

3. **Install MinerU:**

```bash
pip install mineru
# MinerU will download models on first use
```

4. **Install Redis (if not already installed):**

```bash
# On Ubuntu/Debian:
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
```

5. **Create .env file:**

```bash
# Copy the environment variables above into .env
nano /root/vast-ai-server/.env
```

---

## Key Code Modifications

### 1. config.py - Port Fix

```python
# Always use 8080 internally, ignore VAST_TCP_PORT_8080 (external mapping)
PORT: int = 8080  # Hardcoded, not from environment
```

### 2. mineru.py - Adaptive Retry Loop

- **Issue:** vLLM engine writes files asynchronously after subprocess returns
- **Fix:** Adaptive retry loop with progressive waiting
- **Wait Time:** Base 10s + 1s per MB of PDF (max 60s)
- **Retries:** 6 attempts

### 3. main.py - Lifespan Events

- Replaced deprecated `@app.on_event("startup")` with `lifespan` context manager
- Starts `MAX_CONCURRENT_WORKERS` number of worker loops for parallel processing

### 4. task_queue.py - Base64 Encoding

- Encodes `file_data` (bytes) to base64 for Redis JSON serialization
- Decodes on dequeue

### 5. worker.py - Status Checks

- Checks task status before processing to avoid reprocessing completed/failed tasks
- Always calls `unmark_processing` in finally block

### 6. indexer.py - UUID Point IDs

- Generates UUIDs for Qdrant point IDs (required by Qdrant)
- Stores original string ID in payload as `original_chunk_id`

---

## Starting the Server

```bash
cd /root/vast-ai-server
source venv/bin/activate
export CUDA_VISIBLE_DEVICES=0
nohup python3 main.py > /tmp/server_foreground.log 2>&1 &
```

**Verify it's running:**

```bash
curl http://localhost:8080/health
```

---

## API Endpoints

### Health Check

```bash
GET http://localhost:8080/health
```

### Process PDF(s)

```bash
POST http://localhost:8080/process
Content-Type: multipart/form-data

Parameters:
- files: File[] (PDF files)
- user_id: String (required)
- document_ids: String (JSON array, required)
- metadatas: String (JSON array, optional)
- upload_to_storage: Boolean (default: true)
- index: Boolean (default: true)
```

### Check Task Status

```bash
GET http://localhost:8080/status/{task_id}
```

---

## Public Access Setup

### Option 1: Cloudflare Tunnel (Temporary URL)

```bash
/opt/instance-tools/bin/cloudflared tunnel --url http://localhost:8080 > /tmp/cloudflared.log 2>&1 &
# URL will be in /tmp/cloudflared.log
```

### Option 2: Vast.ai Direct Port

- External IP: Check with `curl ifconfig.me`
- External Port: Check `$VAST_TCP_PORT_8080` environment variable
- URL: `http://<external_ip>:<external_port>`

---

## Monitoring

### View Logs

```bash
tail -f /tmp/server_foreground.log
```

### Check Queue Status

```bash
redis-cli LLEN mineru:queue
redis-cli SCARD mineru:processing
```

### Check GPU Usage

```bash
nvidia-smi
```

---

## Known Issues & Solutions

### 1. Transformers Version Compatibility

- **Problem:** vLLM fails with transformers 4.57.2
- **Solution:** Use transformers==4.56.2

### 2. Content List File Not Found

- **Problem:** Large PDFs take time for vLLM to write output
- **Solution:** Adaptive retry loop implemented in mineru.py

### 3. Qdrant Point ID Format

- **Problem:** Qdrant requires UUIDs or integers for point IDs
- **Solution:** Generate UUIDs in indexer.py

### 4. Task Reprocessing

- **Problem:** Tasks being reprocessed after completion
- **Solution:** Status checks in dequeue_task and worker_loop

### 5. Port Binding Issues

- **Problem:** Server trying to bind to external port (41960) instead of 8080
- **Solution:** Hardcoded PORT=8080 in config.py

---

## Performance Tuning

### Optimal Worker Count

- **RTX 3090 (24GB):** 2 concurrent workers
- **Rationale:** Balances GPU memory usage and processing speed
- **Adjust:** Set `MAX_CONCURRENT_WORKERS` in .env

### GPU Memory

- vLLM uses ~70% GPU memory utilization (configurable in MinerU)
- Each worker processes one document at a time
- Parallel processing: 2 documents simultaneously

---

## File Structure

```
/root/vast-ai-server/
├── main.py              # FastAPI application
├── config.py            # Configuration management
├── worker.py            # Background worker logic
├── mineru.py            # MinerU wrapper
├── task_queue.py        # Redis queue management
├── storage.py           # Supabase storage
├── indexer.py           # Qdrant indexing
├── models.py            # Pydantic models
├── requirements.txt     # Python dependencies
├── .env                 # Environment variables
└── venv/                # Virtual environment
```

---

## Testing

### Test with Single PDF

```bash
curl -X POST http://localhost:8080/process \
  -F "files=@test.pdf" \
  -F "user_id=test-user" \
  -F 'document_ids=["test-doc"]' \
  -F "upload_to_storage=true" \
  -F "index=true"
```

### Test with Multiple PDFs

```bash
curl -X POST http://localhost:8080/process \
  -F "files=@doc1.pdf" \
  -F "files=@doc2.pdf" \
  -F "user_id=test-user" \
  -F 'document_ids=["doc1", "doc2"]' \
  -F 'metadatas=[{"filename":"doc1.pdf","company":"Test"},{"filename":"doc2.pdf","company":"Test"}]' \
  -F "upload_to_storage=true" \
  -F "index=true"
```

---

## Troubleshooting

### Server Won't Start

1. Check if port 8080 is in use: `netstat -tlnp | grep 8080`
2. Check logs: `tail -50 /tmp/server_foreground.log`
3. Verify Redis is running: `redis-cli ping`

### GPU Not Detected

1. Check CUDA: `nvidia-smi`
2. Verify environment: `echo $CUDA_VISIBLE_DEVICES`
3. Check PyTorch: `python3 -c "import torch; print(torch.cuda.is_available())"`

### MinerU Processing Fails

1. Check MinerU installation: `mineru --version`
2. Check model download: Look for model files in `~/.hf_home/`
3. Check logs for specific errors

### Indexing Fails

1. Verify Qdrant credentials in .env
2. Test connection: `python3 -c "from qdrant_client import QdrantClient; ..."`
3. Check Voyage API key is valid

---

## Notes

- **Content List Upload:** Currently enabled (can be disabled in worker.py)
- **Temp Directory Cleanup:** Commented out for debugging (uncomment in worker.py for production)
- **Redis:** Required for task queue (falls back to in-memory if unavailable)
- **Supabase:** Optional (for content_list.json storage)
- **Qdrant:** Required for indexing (if `index=true`)

---

## Reproduction Checklist

- [ ] Install Python 3.12.3
- [ ] Install CUDA and GPU drivers
- [ ] Create virtual environment
- [ ] Install requirements.txt
- [ ] Install transformers==4.56.2 (CRITICAL)
- [ ] Install MinerU
- [ ] Install and start Redis
- [ ] Create .env file with all variables
- [ ] Verify GPU detection
- [ ] Start server
- [ ] Test health endpoint
- [ ] Test PDF processing
- [ ] Verify indexing works

---

**Last Updated:** November 25, 2025  
**Server Status:** Production Ready ✅
