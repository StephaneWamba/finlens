# Test Public API Endpoints for Widget
# This script tests the public API endpoints that the widget uses

param(
    [string]$AgentId = "5a2e77c0-aeff-4ea7-af4f-7e7dbed66595",
    [string]$ApiKey = "pub_key_test123",
    [string]$ApiUrl = "http://localhost:4002"
)

Write-Host "=== Syntera Widget Public API Test ===" -ForegroundColor Cyan
Write-Host ""

$headers = @{
    "Authorization" = "Bearer $ApiKey"
    "Content-Type" = "application/json"
}

# Test 1: Get Agent
Write-Host "1. Testing GET /api/public/agents/:agentId" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/api/public/agents/$AgentId" -Headers $headers -UseBasicParsing
    Write-Host "   ✅ Success!" -ForegroundColor Green
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3
} catch {
    Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Red
    }
}
Write-Host ""

# Test 2: Create Conversation
Write-Host "2. Testing POST /api/public/conversations" -ForegroundColor Yellow
$conversationBody = @{
    agentId = $AgentId
    channel = "chat"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/api/public/conversations" -Method POST -Headers $headers -Body $conversationBody -UseBasicParsing
    Write-Host "   ✅ Success!" -ForegroundColor Green
    $conversationData = $response.Content | ConvertFrom-Json
    $conversationData | ConvertTo-Json -Depth 3
    $conversationId = $conversationData.conversation.id
    Write-Host "   Conversation ID: $conversationId" -ForegroundColor Cyan
} catch {
    Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Red
    }
    $conversationId = $null
}
Write-Host ""

# Test 3: Send Message (if conversation was created)
if ($conversationId) {
    Write-Host "3. Testing POST /api/public/messages" -ForegroundColor Yellow
    $messageBody = @{
        conversationId = $conversationId
        content = "Hello! This is a test message from the widget API test script."
    } | ConvertTo-Json

    try {
        $response = Invoke-WebRequest -Uri "$ApiUrl/api/public/messages" -Method POST -Headers $headers -Body $messageBody -UseBasicParsing
        Write-Host "   ✅ Success!" -ForegroundColor Green
        $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3
        Write-Host "   ⏳ Waiting 3 seconds for AI response..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
    } catch {
        Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "   Response: $responseBody" -ForegroundColor Red
        }
    }
    Write-Host ""
}

# Test 4: Get LiveKit Token
if ($conversationId) {
    Write-Host "4. Testing POST /api/public/livekit/token" -ForegroundColor Yellow
    $tokenBody = @{
        conversationId = $conversationId
        agentId = $AgentId
    } | ConvertTo-Json

    try {
        $response = Invoke-WebRequest -Uri "$ApiUrl/api/public/livekit/token" -Method POST -Headers $headers -Body $tokenBody -UseBasicParsing
        Write-Host "   ✅ Success!" -ForegroundColor Green
        $tokenData = $response.Content | ConvertFrom-Json
        Write-Host "   Token: $($tokenData.token.Substring(0, 50))..." -ForegroundColor Cyan
        Write-Host "   URL: $($tokenData.url)" -ForegroundColor Cyan
        Write-Host "   Room: $($tokenData.roomName)" -ForegroundColor Cyan
    } catch {
        Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "   Response: $responseBody" -ForegroundColor Red
        }
    }
    Write-Host ""
}

# Test 5: Get Avatar Stream URL
if ($conversationId) {
    Write-Host "5. Testing GET /api/public/avatar/stream/:conversationId" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "$ApiUrl/api/public/avatar/stream/$conversationId" -Headers $headers -UseBasicParsing
        Write-Host "   ✅ Success!" -ForegroundColor Green
        $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3
    } catch {
        Write-Host "   ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "   Response: $responseBody" -ForegroundColor Red
        }
    }
    Write-Host ""
}

Write-Host "=== Test Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "To test with a different agent ID:" -ForegroundColor Yellow
Write-Host "  .\test-api.ps1 -AgentId 'your-agent-id' -ApiKey 'pub_key_test123'" -ForegroundColor White

