# PowerShell script to start Cloudflare Quick Tunnel (no auth required)
# This is the easiest way to get a public URL for local development
# The URL changes each time you restart the tunnel

Write-Host "Starting Cloudflare Quick Tunnel for Agent Service (port 4002)..." -ForegroundColor Cyan
Write-Host ""
Write-Host "This will create a temporary public URL that forwards to localhost:4002" -ForegroundColor Yellow
Write-Host "The URL will be displayed below. Copy it and use it in LiveKit webhook configuration." -ForegroundColor Yellow
Write-Host ""
Write-Host "Webhook endpoint format: https://<tunnel-url>/api/call-recordings/egress-webhook" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the tunnel" -ForegroundColor Gray
Write-Host ""

# Start quick tunnel (no authentication required)
cloudflared tunnel --url http://localhost:4002


