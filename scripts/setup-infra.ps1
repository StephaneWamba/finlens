# PowerShell script for initial infrastructure setup
# This helps with the first-time setup process

param(
    [string]$Environment = "dev"
)

Write-Host "Syntera Infrastructure Setup" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan

# Check prerequisites
Write-Host "`nChecking prerequisites..." -ForegroundColor Yellow

# Check AWS CLI
try {
    $awsVersion = aws --version 2>&1
    Write-Host "[OK] AWS CLI installed: $awsVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] AWS CLI not found. Install from https://aws.amazon.com/cli/" -ForegroundColor Red
    exit 1
}

# Check Terraform
try {
    $tfVersion = terraform version 2>&1 | Select-Object -First 1
    Write-Host "[OK] Terraform installed: $tfVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Terraform not found. Install from https://www.terraform.io/downloads" -ForegroundColor Red
    exit 1
}

# Check AWS credentials
try {
    $identity = aws sts get-caller-identity 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "AWS credentials not configured"
    }
    Write-Host "[OK] AWS credentials configured" -ForegroundColor Green
    $accountId = ($identity | ConvertFrom-Json).Account
    Write-Host "  Account ID: $accountId" -ForegroundColor Gray
} catch {
    Write-Host "[ERROR] AWS credentials not configured. Run 'aws configure'" -ForegroundColor Red
    exit 1
}

# Change to terraform directory
Push-Location "$PSScriptRoot\..\terraform"

try {
    # Check if backend.hcl exists
    if (-not (Test-Path "backend.hcl")) {
        Write-Host "`nSetting up backend configuration..." -ForegroundColor Yellow
        Copy-Item "backend.hcl.example" "backend.hcl"
        
        # Update bucket name with account ID
        $backendContent = Get-Content "backend.hcl" -Raw
        $backendContent = $backendContent -replace "YOUR_ACCOUNT_ID", $accountId
        Set-Content "backend.hcl" -Value $backendContent -NoNewline
        
        Write-Host "[OK] Created backend.hcl (update region if needed)" -ForegroundColor Green
        
        # Create S3 bucket for state
        $bucketName = "syntera-terraform-state-$accountId"
        Write-Host "`nCreating S3 bucket for Terraform state: $bucketName" -ForegroundColor Yellow
        
        $region = (Get-Content "backend.hcl" | Select-String "region\s*=\s*""([^""]+)""").Matches.Groups[1].Value
        if (-not $region) { $region = "us-east-1" }
        
        $bucketResult = aws s3 mb "s3://$bucketName" --region $region 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Created S3 bucket: $bucketName" -ForegroundColor Green
            aws s3api put-bucket-versioning --bucket $bucketName --versioning-configuration Status=Enabled --region $region 2>&1 | Out-Null
            Write-Host "[OK] Enabled versioning on state bucket" -ForegroundColor Green
        } else {
            Write-Host "[WARN] Bucket may already exist, continuing..." -ForegroundColor Yellow
        }
    } else {
        Write-Host "[OK] backend.hcl already exists" -ForegroundColor Green
    }

    # Check if terraform.tfvars exists
    if (-not (Test-Path "terraform.tfvars")) {
        Write-Host "`nSetting up variables..." -ForegroundColor Yellow
        Copy-Item "terraform.tfvars.example" "terraform.tfvars"
        
        # Generate secure passwords
        $mongodbPassword = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
        $rabbitmqPassword = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
        
        $tfvarsContent = Get-Content "terraform.tfvars" -Raw
        # Replace first occurrence for MongoDB
        $tfvarsContent = $tfvarsContent -replace "mongodb_password\s*=\s*CHANGE_ME_STRONG_PASSWORD", "mongodb_password = $mongodbPassword"
        # Replace second occurrence for RabbitMQ
        $tfvarsContent = $tfvarsContent -replace "rabbitmq_password\s*=\s*CHANGE_ME_STRONG_PASSWORD", "rabbitmq_password = $rabbitmqPassword"
        Set-Content "terraform.tfvars" -Value $tfvarsContent -NoNewline
        
        Write-Host "[OK] Created terraform.tfvars with generated passwords" -ForegroundColor Green
        Write-Host "  [WARN] Save these passwords securely!" -ForegroundColor Yellow
        Write-Host "  MongoDB password: $mongodbPassword" -ForegroundColor Gray
        Write-Host "  RabbitMQ password: $rabbitmqPassword" -ForegroundColor Gray
    } else {
        Write-Host "[OK] terraform.tfvars already exists" -ForegroundColor Green
    }

    # Initialize Terraform
    Write-Host "`nInitializing Terraform..." -ForegroundColor Yellow
    terraform init -backend-config="backend.hcl"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Terraform initialized successfully" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Terraform initialization failed" -ForegroundColor Red
        exit 1
    }

    Write-Host "`n[OK] Setup complete!" -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "  1. Review terraform.tfvars and update if needed" -ForegroundColor White
    Write-Host "  2. Run 'terraform plan' to preview infrastructure" -ForegroundColor White
    Write-Host "  3. Run 'terraform apply' to create infrastructure" -ForegroundColor White
    Write-Host "  4. Use '.\scripts\pause-infra.ps1' to pause when not in use" -ForegroundColor White

} catch {
    Write-Host "`n[ERROR] Setup failed: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

