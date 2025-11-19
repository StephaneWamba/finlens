# PowerShell script to test webhook endpoint accessibility

param(
    [string]$TunnelUrl = "https://contents-marble-hoping-subject.trycloudflare.com"
)

$WebhookUrl = "${TunnelUrl}/api/call-recordings/egress-webhook"
$HealthUrl = "${TunnelUrl}/health"

Write-Host "Testing webhook endpoint: $WebhookUrl" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health check
Write-Host "1. Testing health endpoint..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri $HealthUrl -Method GET -UseBasicParsing
    if ($healthResponse.StatusCode -eq 200) {
        Write-Host "✅ Health check passed (200)" -ForegroundColor Green
    } else {
        Write-Host "❌ Health check failed ($($healthResponse.StatusCode))" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Webhook endpoint (should return 401 - unauthorized)
Write-Host "2. Testing webhook endpoint (should return 401 - unauthorized)..." -ForegroundColor Yellow
try {
    $webhookResponse = Invoke-WebRequest -Uri $WebhookUrl -Method POST `
        -Headers @{
            "Content-Type" = "application/webhook+json"
            "Authorization" = "Bearer invalid-token"
        } `
        -Body '{"test": "data"}' `
        -UseBasicParsing `
        -ErrorAction Stop
    Write-Host "⚠️  Webhook endpoint returned $($webhookResponse.StatusCode) (expected 401)" -ForegroundColor Yellow
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "✅ Webhook endpoint is accessible and verifying signatures (401 = unauthorized, which is expected)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Webhook endpoint returned $statusCode (expected 401)" -ForegroundColor Yellow
    }
}
Write-Host ""

Write-Host "If both tests passed, your tunnel is working correctly!" -ForegroundColor Green
Write-Host "Next: Configure the webhook URL in LiveKit dashboard and start a test call." -ForegroundColor Cyan

