# Test AWS Services Connectivity
# Tests Redis, RabbitMQ, and MongoDB provisioned via Terraform

Write-Host "`nTesting AWS Services Connectivity" -ForegroundColor Cyan
Write-Host ("=" * 60)

# Load environment variables from .env if it exists
if (Test-Path ".env") {
    Write-Host "`nLoading environment variables from .env..." -ForegroundColor Yellow
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

# Extract connection details
$redisUrl = $env:REDIS_URL
$rabbitmqUrl = $env:RABBITMQ_URL
$mongodbUri = $env:MONGODB_URI

Write-Host "`nConnection Strings Found:" -ForegroundColor Yellow
Write-Host "  Redis:    $($redisUrl -replace ':[^:@]+@', ':****@')"
Write-Host "  RabbitMQ: $($rabbitmqUrl -replace ':[^:@]+@', ':****@')"
Write-Host "  MongoDB:  $($mongodbUri -replace ':[^:@]+@', ':****@')"

# Test 1: Redis
Write-Host "`n[1/3] Testing Redis Connection..." -ForegroundColor Cyan
if ($redisUrl) {
    try {
        # Extract host and port from Redis URL
        if ($redisUrl -match 'redis://([^:]+):(\d+)') {
            $redisHost = $matches[1]
            $redisPort = $matches[2]
            
            Write-Host "  Host: $redisHost"
            Write-Host "  Port: $redisPort"
            
            # Test TCP connection
            $tcpClient = New-Object System.Net.Sockets.TcpClient
            $connect = $tcpClient.BeginConnect($redisHost, $redisPort, $null, $null)
            $wait = $connect.AsyncWaitHandle.WaitOne(5000, $false)
            
            if ($wait) {
                try {
                    $tcpClient.EndConnect($connect)
                    Write-Host "  [SUCCESS] TCP Connection successful" -ForegroundColor Green
                    $tcpClient.Close()
                } catch {
                    Write-Host "  [FAILED] TCP Connection failed: $($_.Exception.Message)" -ForegroundColor Red
                }
            } else {
                Write-Host "  [TIMEOUT] TCP Connection timeout (5 seconds)" -ForegroundColor Red
                $tcpClient.Close()
            }
        } else {
            Write-Host "  ⚠️  Could not parse Redis URL" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "  ⚠️  REDIS_URL not set" -ForegroundColor Yellow
}

# Test 2: RabbitMQ
Write-Host "`n[2/3] Testing RabbitMQ Connection..." -ForegroundColor Cyan
if ($rabbitmqUrl) {
    try {
        # Extract host and port from RabbitMQ URL
        if ($rabbitmqUrl -match 'amqps?://[^@]+@([^:]+):(\d+)') {
            $rabbitmqHost = $matches[1]
            $rabbitmqPort = $matches[2]
            
            Write-Host "  Host: $rabbitmqHost"
            Write-Host "  Port: $rabbitmqPort"
            
            # Test TCP connection
            $tcpClient = New-Object System.Net.Sockets.TcpClient
            $connect = $tcpClient.BeginConnect($rabbitmqHost, $rabbitmqPort, $null, $null)
            $wait = $connect.AsyncWaitHandle.WaitOne(5000, $false)
            
            if ($wait) {
                try {
                    $tcpClient.EndConnect($connect)
                    Write-Host "  [SUCCESS] TCP Connection successful" -ForegroundColor Green
                    $tcpClient.Close()
                } catch {
                    Write-Host "  [FAILED] TCP Connection failed: $($_.Exception.Message)" -ForegroundColor Red
                }
            } else {
                Write-Host "  [TIMEOUT] TCP Connection timeout (5 seconds)" -ForegroundColor Red
                $tcpClient.Close()
            }
        } else {
            Write-Host "  ⚠️  Could not parse RabbitMQ URL" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "  ⚠️  RABBITMQ_URL not set" -ForegroundColor Yellow
}

# Test 3: MongoDB
Write-Host "`n[3/3] Testing MongoDB Connection..." -ForegroundColor Cyan
if ($mongodbUri) {
    try {
        # Extract host and port from MongoDB URI
        if ($mongodbUri -match '@([^:]+):(\d+)/') {
            $mongodbHost = $matches[1]
            $mongodbPort = $matches[2]
            
            Write-Host "  Host: $mongodbHost"
            Write-Host "  Port: $mongodbPort"
            
            # Test TCP connection
            $tcpClient = New-Object System.Net.Sockets.TcpClient
            $connect = $tcpClient.BeginConnect($mongodbHost, $mongodbPort, $null, $null)
            $wait = $connect.AsyncWaitHandle.WaitOne(5000, $false)
            
            if ($wait) {
                try {
                    $tcpClient.EndConnect($connect)
                    Write-Host "  [SUCCESS] TCP Connection successful" -ForegroundColor Green
                    $tcpClient.Close()
                } catch {
                    Write-Host "  [FAILED] TCP Connection failed: $($_.Exception.Message)" -ForegroundColor Red
                }
            } else {
                Write-Host "  [TIMEOUT] TCP Connection timeout (5 seconds)" -ForegroundColor Red
                $tcpClient.Close()
            }
        } else {
            Write-Host "  ⚠️  Could not parse MongoDB URI" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "  ⚠️  MONGODB_URI not set" -ForegroundColor Yellow
}

# Summary
Write-Host "`nSummary:" -ForegroundColor Cyan
Write-Host "  Note: These services are in AWS private subnets." -ForegroundColor Yellow
Write-Host "  Direct access requires:" -ForegroundColor Yellow
Write-Host "    1. AWS VPN connection" -ForegroundColor Yellow
Write-Host "    2. Bastion host / SSH tunnel" -ForegroundColor Yellow
Write-Host "    3. VPC peering" -ForegroundColor Yellow
Write-Host "    4. Or running services inside the VPC" -ForegroundColor Yellow

Write-Host "`nConnectivity test complete`n" -ForegroundColor Green

