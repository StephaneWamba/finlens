# Verify Agent Exists in Database
# This script helps debug why the agent might not be found

param(
    [string]$AgentId = "19bcabc6-1f45-4769-9cf2-7b2b69441c36",
    [string]$CompanyId = "4f0de872-54b7-42ff-97aa-3a8967cf492d",
    [string]$ApiUrl = "http://localhost:4002"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Agent Verification Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Testing different scenarios..." -ForegroundColor Yellow
Write-Host ""

# Test 1: Check if route exists (without auth)
Write-Host "[1] Testing route without authentication..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/api/public/agents/$AgentId" -UseBasicParsing -ErrorAction Stop
    Write-Host "   [OK] Route exists (unexpected - should require auth)" -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "   [OK] Route exists and requires authentication (expected)" -ForegroundColor Green
    } elseif ($statusCode -eq 404) {
        Write-Host "   [WARN] Route returns 404 - might not be registered" -ForegroundColor Yellow
    } else {
        Write-Host "   Status: $statusCode" -ForegroundColor Yellow
    }
}
Write-Host ""

# Test 2: Check with API key but wrong format
Write-Host "[2] Testing with invalid API key format..." -ForegroundColor Yellow
try {
    $headers = @{ "Authorization" = "Bearer invalid_key" }
    $response = Invoke-WebRequest -Uri "$ApiUrl/api/public/agents/$AgentId" -Headers $headers -UseBasicParsing -ErrorAction Stop
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "   [OK] Correctly rejects invalid API key format" -ForegroundColor Green
    } else {
        Write-Host "   Status: $statusCode (expected 401)" -ForegroundColor Yellow
    }
}
Write-Host ""

# Test 3: Check with valid API key format
Write-Host "[3] Testing with valid API key format..." -ForegroundColor Yellow
try {
    $headers = @{ "Authorization" = "Bearer pub_key_test123" }
    $response = Invoke-WebRequest -Uri "$ApiUrl/api/public/agents/$AgentId" -Headers $headers -UseBasicParsing -ErrorAction Stop
    Write-Host "   [OK] Success! Agent found" -ForegroundColor Green
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "   [FAIL] Status Code: $statusCode" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $responseBody = $reader.ReadToEnd()
            if ($responseBody) {
                Write-Host "   Response:" -ForegroundColor Yellow
                $responseBody | ConvertFrom-Json | ConvertTo-Json -Depth 3
            } else {
                Write-Host "   Empty response body" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "   Could not parse response" -ForegroundColor Red
        }
    }
    
    if ($statusCode -eq 404) {
        Write-Host ""
        Write-Host "   Debugging 404 Error:" -ForegroundColor Cyan
        Write-Host "   Possible causes:" -ForegroundColor Yellow
        Write-Host "   1. Agent ID doesn't exist in agent_configs table" -ForegroundColor White
        Write-Host "   2. Agent's company_id doesn't match: $CompanyId" -ForegroundColor White
        Write-Host "   3. Middleware can't extract agentId from URL params" -ForegroundColor White
        Write-Host ""
        Write-Host "   To verify in Supabase:" -ForegroundColor Cyan
        Write-Host "   SELECT id, name, company_id FROM agent_configs WHERE id = '$AgentId';" -ForegroundColor Gray
    } elseif ($statusCode -eq 400) {
        Write-Host "   [WARN] Bad Request - Agent ID might not be extracted from URL" -ForegroundColor Yellow
    }
}
Write-Host ""

# Test 4: Try POST with agentId in body
Write-Host "[4] Testing POST /api/public/conversations (agentId in body)..." -ForegroundColor Yellow
try {
    $headers = @{ 
        "Authorization" = "Bearer pub_key_test123"
        "Content-Type" = "application/json"
    }
    $body = @{
        agentId = $AgentId
        channel = "chat"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "$ApiUrl/api/public/conversations" -Method POST -Headers $headers -Body $body -UseBasicParsing -ErrorAction Stop
    Write-Host "   [OK] Success! Conversation created" -ForegroundColor Green
    $conversationData = $response.Content | ConvertFrom-Json
    Write-Host "   Conversation ID: $($conversationData.conversation.id)" -ForegroundColor Cyan
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "   [FAIL] Status Code: $statusCode" -ForegroundColor Red
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
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Verification Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "If agent is still not found, check:" -ForegroundColor Yellow
Write-Host "  1. Agent Service logs for 'Agent not found' warnings" -ForegroundColor White
Write-Host "  2. Supabase agent_configs table directly" -ForegroundColor White
Write-Host "  3. Company ID matches in database" -ForegroundColor White
Write-Host ""
