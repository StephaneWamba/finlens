# VastAI Server Setup Guide

**Purpose**: Complete guide to recreate the VastAI GPU server environment for FinLens PDF processing.

**Date**: December 2024  
**Status**: Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Server Requirements](#server-requirements)
3. [Initial Setup](#initial-setup)
4. [Python Environment](#python-environment)
5. [Dependencies Installation](#dependencies-installation)
6. [Redis Installation](#redis-installation)
7. [Environment Configuration](#environment-configuration)
8. [GPU Verification](#gpu-verification)
9. [Starting the Server](#starting-the-server)
10. [Public Access Setup](#public-access-setup)
11. [Backend Configuration](#backend-configuration)
12. [Testing](#testing)
13. [Monitoring](#monitoring)
14. [Troubleshooting](#troubleshooting)

---

## Overview

The VastAI server is a GPU-accelerated PDF processing service that:

- Receives PDF files from the FinLens backend (Railway)
- Processes them using MinerU with vLLM backend
- Extracts structured content (content_list.json)
- Indexes chunks into Qdrant vector database
- Uploads results to Supabase Storage

**Architecture**:

- **Backend (Railway)**: Receives user uploads, sends to VastAI server
- **VastAI Server**: GPU processing with MinerU, Redis queue, worker pool
- **Supabase**: Storage for content_list.json files
- **Qdrant**: Vector database for document chunks
- **Voyage AI**: Embedding generation

---

## Server Requirements

### Hardware

- **GPU**: NVIDIA RTX 3090 (24GB VRAM) or similar
- **RAM**: 16GB+ recommended
- **Storage**: 50GB+ free space (for models and temp files)

### Software

- **OS**: Linux (Ubuntu/Debian)
- **Python**: 3.12.3
- **CUDA**: Available (driver 560.35.03+)
- **NVIDIA Drivers**: Latest compatible version

---

## Initial Setup

### 1. Connect to Vast.ai Instance

SSH into your Vast.ai GPU server instance.

### 2. Extract or Copy Files

**Option A: If you have the zip file**

```bash
cd ~
unzip vast-ai-server.zip
cd vast-ai-server
```

**Option B: If copying from local machine**

```bash
cd ~
mkdir -p vast-ai-server
cd vast-ai-server
# Copy all files from vast-ai-server/ directory
```

**Required files**:

- `main.py`
- `config.py`
- `worker.py`
- `mineru.py`
- `task_queue.py`
- `storage.py`
- `indexer.py`
- `models.py`
- `requirements.txt`
- `__init__.py`

---

## Python Environment

### 1. Create Virtual Environment

```bash
cd ~/vast-ai-server

# Create virtual environment with Python 3.12
python3.12 -m venv venv

# Activate virtual environment
source venv/bin/activate
```

### 2. Upgrade pip

```bash
pip install --upgrade pip
```

---

## Dependencies Installation

### 1. Install Base Requirements

```bash
pip install -r requirements.txt
```

### 2. CRITICAL: Install Specific Transformers Version

**MUST be version 4.56.2 (NOT 4.57.2)**

```bash
pip install transformers==4.56.2
```

**Why**: Version 4.57.2 causes `AttributeError: 'dict' object has no attribute 'model_type'` with vLLM.

### 3. Install MinerU

```bash
pip install mineru
pip install mineru_vl_utils==0.1.16
```

**Note**: MinerU will download models on first use (stored in `~/.hf_home/`).

### 4. Verify Key Package Versions

```bash
pip list | grep -E "(fastapi|uvicorn|transformers|mineru|qdrant|redis|voyageai|supabase)"
```

Expected versions:

- `fastapi==0.122.0`
- `uvicorn==0.38.0`
- `transformers==4.56.2` ⚠️ **CRITICAL**
- `mineru==2.6.4`
- `mineru_vl_utils==0.1.16`
- `qdrant-client==1.16.0`
- `redis==7.1.0`

---

## Redis Installation

### 1. Install Redis

```bash
# On Ubuntu/Debian:
sudo apt-get update
sudo apt-get install -y redis-server
```

### 2. Start Redis Service

```bash
sudo systemctl start redis
sudo systemctl enable redis  # Enable on boot
```

### 3. Verify Redis is Running

```bash
redis-cli ping
# Should return: PONG
```

---

## Environment Configuration

### 1. Create .env File

Create `/root/vast-ai-server/.env` (or `~/vast-ai-server/.env`):

```bash
cd ~/vast-ai-server
nano .env
```

### 2. Environment Variables

Copy the following into `.env`:

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

# Optional API Key (for authentication)
API_KEY=4fa2bb26ab6947b21110c96bd7d9d0c9355f984deacb0f9914beb7bbd0a29df5
```

**Important Notes**:

- Replace API keys/secrets with your own values if needed
- `MINERU_BACKEND` must be `vlm-vllm-engine` (NOT `vlm-vllm` or `vlm-transformers`)
- `PORT` is hardcoded to `8080` internally (Vast.ai maps to external port)
- `MAX_CONCURRENT_WORKERS=2` is optimal for RTX 3090

---

## GPU Verification

### 1. Check GPU Availability

```bash
nvidia-smi
```

Expected output should show:

- GPU: NVIDIA GeForce RTX 3090
- GPU Memory: 24,576 MB
- Driver version: 560.35.03 or later

### 2. Verify CUDA in Python

```bash
source venv/bin/activate
python3 -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}'); print(f'GPU count: {torch.cuda.device_count()}'); print(f'GPU name: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"N/A\"}')"
```

Expected output:

```
CUDA available: True
GPU count: 1
GPU name: NVIDIA GeForce RTX 3090
```

---

## Starting the Server

### 1. Navigate to Directory

```bash
cd ~/vast-ai-server
source venv/bin/activate
```

### 2. Set CUDA Device

```bash
export CUDA_VISIBLE_DEVICES=0
```

### 3. Start Server in Background

```bash
nohup python3 main.py > /tmp/server_foreground.log 2>&1 &
```

### 4. Verify Server Started

```bash
# Check if process is running
ps aux | grep "python3 main.py"

# Check health endpoint
sleep 5  # Wait a few seconds for startup
curl http://localhost:8080/health

# View logs
tail -f /tmp/server_foreground.log
```

### 5. Expected Health Check Response

```json
{
  "status": "healthy",
  "gpu_available": true,
  "gpu_count": 1,
  "gpu_name": "NVIDIA GeForce RTX 3090",
  "mineru_backend": "vlm-vllm-engine",
  "supabase_configured": true,
  "redis_configured": true,
  "cuda_visible_devices": "0",
  "queue_length": 0,
  "processing": 0,
  "max_workers": 2
}
```

---

## Public Access Setup

### Option 1: Cloudflare Tunnel (Temporary URL)

```bash
/opt/instance-tools/bin/cloudflared tunnel --url http://localhost:8080 > /tmp/cloudflared.log 2>&1 &

# Get the URL
sleep 3
cat /tmp/cloudflared.log | grep -o 'https://[^ ]*\.trycloudflare\.com'
```

### Option 2: Vast.ai Direct Port

```bash
# Get external IP
curl ifconfig.me

# Get external port (Vast.ai maps internal 8080 to external port)
echo $VAST_TCP_PORT_8080

# URL format: http://<external_ip>:<external_port>
# Example: http://83.27.164.65:41960
```

**Use this URL** in your backend configuration.

---

## Backend Configuration

Update your **Railway backend** `.env` file with:

```bash
VAST_AI_SERVER_URL=http://<your-vast-ai-server-ip>:<port>
# OR
VAST_AI_SERVER_URL=https://<cloudflare-tunnel-url>

VAST_AI_API_KEY=4fa2bb26ab6947b21110c96bd7d9d0c9355f984deacb0f9914beb7bbd0a29df5
```

**Example**:

```bash
VAST_AI_SERVER_URL=http://83.27.164.65:41960
VAST_AI_API_KEY=4fa2bb26ab6947b21110c96bd7d9d0c9355f984deacb0f9914beb7bbd0a29df5
```

---

## Testing

### 1. Health Check

```bash
curl http://localhost:8080/health
```

### 2. Root Endpoint

```bash
curl http://localhost:8080/
```

### 3. Test PDF Processing

```bash
# Single PDF
curl -X POST http://localhost:8080/process \
  -F "files=@test.pdf" \
  -F "user_id=test-user" \
  -F 'document_ids=["test-doc-1"]' \
  -F "upload_to_storage=true" \
  -F "index=true" \
  -H "X-API-Key: 4fa2bb26ab6947b21110c96bd7d9d0c9355f984deacb0f9914beb7bbd0a29df5"
```

**Response**:

```json
{
  "total": 1,
  "tasks": [
    {
      "task_id": "uuid-here",
      "status_url": "/status/uuid-here"
    }
  ]
}
```

### 4. Check Task Status

```bash
curl http://localhost:8080/status/<task_id>
```

### 5. Multiple PDFs Test

```bash
curl -X POST http://localhost:8080/process \
  -F "files=@doc1.pdf" \
  -F "files=@doc2.pdf" \
  -F "user_id=test-user" \
  -F 'document_ids=["doc1", "doc2"]' \
  -F 'metadatas=[{"filename":"doc1.pdf","company":"Test"},{"filename":"doc2.pdf","company":"Test"}]' \
  -F "upload_to_storage=true" \
  -F "index=true" \
  -H "X-API-Key: 4fa2bb26ab6947b21110c96bd7d9d0c9355f984deacb0f9914beb7bbd0a29df5"
```

---

## Monitoring

### 1. View Server Logs

```bash
tail -f /tmp/server_foreground.log
```

### 2. Check Queue Status

```bash
# Queue length
redis-cli LLEN mineru:queue

# Currently processing tasks
redis-cli SCARD mineru:processing

# View all task statuses
redis-cli KEYS "mineru:status:*"
```

### 3. Check GPU Usage

```bash
nvidia-smi

# Continuous monitoring
watch -n 1 nvidia-smi
```

### 4. Check Port Listening

```bash
netstat -tlnp | grep 8080
# OR
ss -tlnp | grep 8080
```

### 5. Check Process Status

```bash
ps aux | grep "python3 main.py"
```

---

## Troubleshooting

### Server Won't Start

**Symptoms**: Server fails to start or crashes immediately

**Solutions**:

1. Check logs: `tail -50 /tmp/server_foreground.log`
2. Verify Redis is running: `redis-cli ping`
3. Check port availability: `netstat -tlnp | grep 8080`
4. Verify Python environment: `which python3` and `python3 --version`
5. Check .env file exists and has correct format

### GPU Not Detected

**Symptoms**: `gpu_available: false` in health check

**Solutions**:

1. Verify GPU: `nvidia-smi`
2. Check CUDA: `python3 -c "import torch; print(torch.cuda.is_available())"`
3. Verify environment variable: `echo $CUDA_VISIBLE_DEVICES`
4. Reinstall PyTorch with CUDA: `pip install torch --index-url https://download.pytorch.org/whl/cu121`

### Transformers Version Error

**Symptoms**: `AttributeError: 'dict' object has no attribute 'model_type'`

**Solution**:

```bash
pip uninstall transformers -y
pip install transformers==4.56.2
```

### MinerU Processing Fails

**Symptoms**: Tasks fail with MinerU errors

**Solutions**:

1. Check MinerU installation: `mineru --version`
2. Verify backend setting: `echo $MINERU_BACKEND` (should be `vlm-vllm-engine`)
3. Check model download: Look for files in `~/.hf_home/`
4. Check logs for specific errors: `tail -100 /tmp/server_foreground.log`
5. Verify timeout is sufficient: `MINERU_TIMEOUT_SECONDS=3600` (1 hour)

### Content List File Not Found

**Symptoms**: `content_list.json not found` error

**Solution**: This is handled by adaptive retry loop in `mineru.py`. For large PDFs, wait longer. The system automatically retries up to 6 times with progressive waiting.

### Redis Connection Failed

**Symptoms**: Server uses in-memory queue instead of Redis

**Solutions**:

1. Check Redis is running: `sudo systemctl status redis`
2. Verify Redis URL: `echo $REDIS_URL` (should be `redis://localhost:6379`)
3. Test connection: `redis-cli ping`
4. Restart Redis: `sudo systemctl restart redis`

### Qdrant Indexing Fails

**Symptoms**: Tasks complete but chunks not indexed

**Solutions**:

1. Verify Qdrant credentials in `.env`
2. Test connection:
   ```python
   from qdrant_client import QdrantClient
   client = QdrantClient(url="<QDRANT_URL>", api_key="<QDRANT_API_KEY>")
   print(client.get_collections())
   ```
3. Check Voyage API key is valid
4. Check logs for specific errors

### Port Binding Issues

**Symptoms**: Server tries to bind to wrong port

**Solution**: Port is hardcoded to `8080` in `config.py`. Vast.ai automatically maps this to external port. Don't use `$VAST_TCP_PORT_8080` in code.

### Task Reprocessing

**Symptoms**: Tasks being processed multiple times

**Solution**: Status checks are implemented in `task_queue.py` and `worker.py`. If issue persists, check Redis status storage.

---

## Critical Configuration Summary

| Setting                  | Value             | Notes                                  |
| ------------------------ | ----------------- | -------------------------------------- |
| **Transformers Version** | `4.56.2`          | ⚠️ MUST be this version                |
| **MinerU Backend**       | `vlm-vllm-engine` | NOT `vlm-vllm` or `vlm-transformers`   |
| **Port**                 | `8080`            | Hardcoded internally                   |
| **Max Workers**          | `2`               | Optimal for RTX 3090                   |
| **Redis**                | Required          | Falls back to in-memory if unavailable |
| **Python**               | `3.12.3`          | Recommended version                    |

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
├── .env                 # Environment variables (CREATE THIS)
├── venv/                # Virtual environment (CREATE THIS)
└── __init__.py          # Package init
```

---

## Quick Start Checklist

- [ ] Extract/copy `vast-ai-server` files to `~/vast-ai-server`
- [ ] Create Python 3.12.3 virtual environment
- [ ] Install `requirements.txt`
- [ ] Install `transformers==4.56.2` (CRITICAL)
- [ ] Install MinerU and mineru_vl_utils
- [ ] Install and start Redis
- [ ] Create `.env` file with all variables
- [ ] Verify GPU with `nvidia-smi` and Python
- [ ] Start server with `nohup python3 main.py > /tmp/server_foreground.log 2>&1 &`
- [ ] Test health endpoint: `curl http://localhost:8080/health`
- [ ] Get public URL (Cloudflare tunnel or Vast.ai port)
- [ ] Update backend `.env` with `VAST_AI_SERVER_URL` and `VAST_AI_API_KEY`
- [ ] Test PDF processing
- [ ] Monitor logs and queue status

---

## Additional Notes

- **Temp Directory Cleanup**: Currently commented out in `worker.py` for debugging. Uncomment for production.
- **Content List Upload**: Currently enabled. Can be disabled by setting `upload_to_storage=false` in API calls.
- **Model Storage**: MinerU models are cached in `~/.hf_home/` after first download.
- **Worker Semaphore**: Limits concurrent processing to prevent GPU OOM errors.
- **Adaptive Retry**: MinerU output file detection uses adaptive retry with progressive waiting for large PDFs.

---

**Last Updated**: December 2024  
**Status**: Production Ready ✅
