# PowerShell script to start Cloudflare Tunnel
# This exposes the local agent service (port 4002) to the internet for LiveKit webhooks

Write-Host "Starting Cloudflare Tunnel for Agent Service..." -ForegroundColor Cyan

# Check if cloudflared is installed
$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
    Write-Host "Error: cloudflared is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Install from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/" -ForegroundColor Yellow
    exit 1
}

# Check if tunnel is already authenticated
if (-not (Test-Path ".cloudflare/credentials.json")) {
    Write-Host "Tunnel not authenticated. Running login..." -ForegroundColor Yellow
    Write-Host "Please follow the prompts to authenticate with Cloudflare." -ForegroundColor Yellow
    cloudflared tunnel login
}

# Check if tunnel exists
$tunnelExists = cloudflared tunnel list 2>&1 | Select-String "syntera-agent-service"
if (-not $tunnelExists) {
    Write-Host "Creating tunnel 'syntera-agent-service'..." -ForegroundColor Yellow
    cloudflared tunnel create syntera-agent-service
}

# Start the tunnel
Write-Host "Starting tunnel..." -ForegroundColor Green
Write-Host "The public URL will be displayed below. Use this URL in LiveKit webhook configuration." -ForegroundColor Cyan
Write-Host "Webhook endpoint: https://<tunnel-url>/api/call-recordings/egress-webhook" -ForegroundColor Cyan
Write-Host ""

cloudflared tunnel --config cloudflare-tunnel.yml run syntera-agent-service

