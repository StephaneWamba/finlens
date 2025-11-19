# Test Agent and Public API Endpoints
# Tests agent ID: 19bcabc6-1f45-4769-9cf2-7b2b69441c36

param(
    [string]$AgentId = "19bcabc6-1f45-4769-9cf2-7b2b69441c36",
    [string]$CompanyId = "4f0de872-54b7-42ff-97aa-3a8967cf492d",
    [string]$ApiKey = "pub_key_test123",
    [string]$ApiUrl = "http://localhost:4002"
)

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Syntera Widget Agent Test Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Agent ID: $AgentId" -ForegroundColor Yellow
Write-Host "Company ID: $CompanyId" -ForegroundColor Yellow
Write-Host "API URL: $ApiUrl" -ForegroundColor Yellow
Write-Host ""

$headers = @{
    "Authorization" = "Bearer $ApiKey"
    "Content-Type" = "application/json"
}

$testResults = @{
    AgentExists = $false
    GetAgent = $false
    CreateConversation = $false
    SendMessage = $false
    LiveKitToken = $false
    AvatarStream = $false
}

$conversationId = $null

# Test 1: Check Agent Service Health
Write-Host "[1/6] Checking Agent Service Health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/health" -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Agent Service is running" -ForegroundColor Green
        $healthData = $response.Content | ConvertFrom-Json
        Write-Host "   Service: $($healthData.service)" -ForegroundColor Gray
        Write-Host "   Status: $($healthData.status)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Agent Service is not responding" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 2: Get Agent Configuration
Write-Host "[2/6] Testing GET /api/public/agents/:agentId" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/api/public/agents/$AgentId" -Headers $headers -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Success!" -ForegroundColor Green
        $agentData = $response.Content | ConvertFrom-Json
        Write-Host "   Agent Name: $($agentData.name)" -ForegroundColor Cyan
        Write-Host "   Agent ID: $($agentData.id)" -ForegroundColor Cyan
        Write-Host "   Model: $($agentData.model)" -ForegroundColor Cyan
        if ($agentData.avatar_url) {
            Write-Host "   Avatar URL: $($agentData.avatar_url)" -ForegroundColor Cyan
        }
        $testResults.GetAgent = $true
        $testResults.AgentExists = $true
    }
} catch {
    Write-Host "   ❌ Failed" -ForegroundColor Red
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "   Status Code: $statusCode" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $responseBody = $reader.ReadToEnd()
            if ($responseBody) {
                Write-Host "   Response: $responseBody" -ForegroundColor Yellow
                $errorData = $responseBody | ConvertFrom-Json
                if ($errorData.details) {
                    Write-Host "   Details: $($errorData.details)" -ForegroundColor Yellow
                }
            }
        } catch {
            Write-Host "   Could not read error response" -ForegroundColor Red
        }
    }
    
    if ($statusCode -eq 404) {
        Write-Host "   ⚠️  Agent not found. Verify:" -ForegroundColor Yellow
        Write-Host "      - Agent ID exists in agent_configs table" -ForegroundColor Yellow
        Write-Host "      - Company ID matches: $CompanyId" -ForegroundColor Yellow
    }
}
Write-Host ""

# Test 3: Create Conversation
Write-Host "[3/6] Testing POST /api/public/conversations" -ForegroundColor Yellow
if (-not $testResults.AgentExists) {
    Write-Host "   ⏭️  Skipping - Agent not found" -ForegroundColor Gray
} else {
    try {
        $body = @{
            agentId = $AgentId
            channel = "chat"
        } | ConvertTo-Json

        $response = Invoke-WebRequest -Uri "$ApiUrl/api/public/conversations" -Method POST -Headers $headers -Body $body -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "   ✅ Success!" -ForegroundColor Green
            $conversationData = $response.Content | ConvertFrom-Json
            $conversationId = $conversationData.conversation.id
            Write-Host "   Conversation ID: $conversationId" -ForegroundColor Cyan
            Write-Host "   Channel: $($conversationData.conversation.channel)" -ForegroundColor Cyan
            Write-Host "   Status: $($conversationData.conversation.status)" -ForegroundColor Cyan
            $testResults.CreateConversation = $true
        }
    } catch {
        Write-Host "   ❌ Failed" -ForegroundColor Red
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   Status Code: $statusCode" -ForegroundColor Red
        if ($_.Exception.Response) {
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $responseBody = $reader.ReadToEnd()
                if ($responseBody) {
                    Write-Host "   Response: $responseBody" -ForegroundColor Yellow
                }
            } catch {}
        }
    }
}
Write-Host ""

# Test 4: Send Message
Write-Host "[4/6] Testing POST /api/public/messages" -ForegroundColor Yellow
if (-not $conversationId) {
    Write-Host "   ⏭️  Skipping - No conversation created" -ForegroundColor Gray
} else {
    try {
        $body = @{
            conversationId = $conversationId
            content = "Hello! This is a test message from the widget test script."
        } | ConvertTo-Json

        $response = Invoke-WebRequest -Uri "$ApiUrl/api/public/messages" -Method POST -Headers $headers -Body $body -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "   ✅ Success!" -ForegroundColor Green
            $messageData = $response.Content | ConvertFrom-Json
            Write-Host "   Message ID: $($messageData.message.id)" -ForegroundColor Cyan
            Write-Host "   Content: $($messageData.message.content)" -ForegroundColor Cyan
            Write-Host "   ⏳ Waiting 5 seconds for AI response..." -ForegroundColor Yellow
            Start-Sleep -Seconds 5
            Write-Host "   ✅ Message sent (AI response should be generated)" -ForegroundColor Green
            $testResults.SendMessage = $true
        }
    } catch {
        Write-Host "   ❌ Failed" -ForegroundColor Red
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   Status Code: $statusCode" -ForegroundColor Red
        if ($_.Exception.Response) {
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $responseBody = $reader.ReadToEnd()
                if ($responseBody) {
                    Write-Host "   Response: $responseBody" -ForegroundColor Yellow
                }
            } catch {}
        }
    }
}
Write-Host ""

# Test 5: Get LiveKit Token
Write-Host "[5/6] Testing POST /api/public/livekit/token" -ForegroundColor Yellow
if (-not $conversationId) {
    Write-Host "   ⏭️  Skipping - No conversation created" -ForegroundColor Gray
} else {
    try {
        $body = @{
            conversationId = $conversationId
            agentId = $AgentId
        } | ConvertTo-Json

        $response = Invoke-WebRequest -Uri "$ApiUrl/api/public/livekit/token" -Method POST -Headers $headers -Body $body -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "   ✅ Success!" -ForegroundColor Green
            $tokenData = $response.Content | ConvertFrom-Json
            Write-Host "   Token: $($tokenData.token.Substring(0, 50))..." -ForegroundColor Cyan
            Write-Host "   URL: $($tokenData.url)" -ForegroundColor Cyan
            Write-Host "   Room: $($tokenData.roomName)" -ForegroundColor Cyan
            $testResults.LiveKitToken = $true
        }
    } catch {
        Write-Host "   ❌ Failed" -ForegroundColor Red
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   Status Code: $statusCode" -ForegroundColor Red
        if ($_.Exception.Response) {
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $responseBody = $reader.ReadToEnd()
                if ($responseBody) {
                    Write-Host "   Response: $responseBody" -ForegroundColor Yellow
                }
            } catch {}
        }
    }
}
Write-Host ""

# Test 6: Get Avatar Stream URL
Write-Host "[6/6] Testing GET /api/public/avatar/stream/:conversationId" -ForegroundColor Yellow
if (-not $conversationId) {
    Write-Host "   ⏭️  Skipping - No conversation created" -ForegroundColor Gray
} else {
    try {
        $response = Invoke-WebRequest -Uri "$ApiUrl/api/public/avatar/stream/$conversationId" -Headers $headers -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "   ✅ Success!" -ForegroundColor Green
            $streamData = $response.Content | ConvertFrom-Json
            Write-Host "   Stream URL: $($streamData.streamUrl)" -ForegroundColor Cyan
            $testResults.AvatarStream = $true
        }
    } catch {
        Write-Host "   ❌ Failed" -ForegroundColor Red
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   Status Code: $statusCode" -ForegroundColor Red
        if ($_.Exception.Response) {
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $responseBody = $reader.ReadToEnd()
                if ($responseBody) {
                    Write-Host "   Response: $responseBody" -ForegroundColor Yellow
                }
            } catch {}
        }
    }
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$passed = ($testResults.Values | Where-Object { $_ -eq $true }).Count
$total = $testResults.Values.Count

Write-Host "Tests Passed: $passed / $total" -ForegroundColor $(if ($passed -eq $total) { "Green" } else { "Yellow" })
Write-Host ""

foreach ($test in $testResults.GetEnumerator()) {
    $status = if ($test.Value) { "✅ PASS" } else { "❌ FAIL" }
    $color = if ($test.Value) { "Green" } else { "Red" }
    Write-Host "  $($test.Key): $status" -ForegroundColor $color
}

Write-Host ""

if ($testResults.AgentExists) {
    Write-Host "✅ Agent is accessible via public API" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Test widget: Open test.html in browser" -ForegroundColor White
    Write-Host "  2. Serve widget: python -m http.server 8080" -ForegroundColor White
    Write-Host "  3. Open: http://localhost:8080/test.html" -ForegroundColor White
} else {
    Write-Host "❌ Agent not found. Please verify:" -ForegroundColor Red
    Write-Host "  - Agent ID: $AgentId" -ForegroundColor Yellow
    Write-Host "  - Company ID: $CompanyId" -ForegroundColor Yellow
    Write-Host "  - Agent exists in agent_configs table" -ForegroundColor Yellow
    Write-Host "  - Company ID matches in database" -ForegroundColor Yellow
}

Write-Host ""

