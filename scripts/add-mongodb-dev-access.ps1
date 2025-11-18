# PowerShell script to add your IP to MongoDB security group for development access

param(
    [string]$YourIP = "",
    [string]$Region = "us-east-1"
)

# Get your public IP if not provided
if ([string]::IsNullOrEmpty($YourIP)) {
    Write-Host "🔍 Getting your public IP address..." -ForegroundColor Cyan
    try {
        $YourIP = (Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing).Content.Trim()
        Write-Host "✅ Your IP: $YourIP" -ForegroundColor Green
    } catch {
        Write-Host "❌ Could not get your IP. Please provide it manually:" -ForegroundColor Red
        Write-Host "   .\add-mongodb-dev-access.ps1 -YourIP 'YOUR_IP_HERE'" -ForegroundColor Yellow
        exit 1
    }
}

# Get security group ID for MongoDB
Write-Host "`n🔍 Finding MongoDB security group..." -ForegroundColor Cyan

$SecurityGroupName = "syntera-mongodb-sg-dev"
$SecurityGroup = Get-EC2SecurityGroup -Region $Region | Where-Object { $_.GroupName -eq $SecurityGroupName }

if (-not $SecurityGroup) {
    Write-Host "❌ Security group '$SecurityGroupName' not found!" -ForegroundColor Red
    Write-Host "   Make sure infrastructure is deployed and region is correct." -ForegroundColor Yellow
    exit 1
}

$SecurityGroupId = $SecurityGroup.GroupId
Write-Host "✅ Found security group: $SecurityGroupId" -ForegroundColor Green

# Check if rule already exists
$ExistingRule = $SecurityGroup.IpPermissions | Where-Object {
    $_.FromPort -eq 27017 -and 
    $_.ToPort -eq 27017 -and 
    $_.IpRanges.CidrIp -eq "$YourIP/32"
}

if ($ExistingRule) {
    Write-Host "`n⚠️  Rule already exists for IP $YourIP/32" -ForegroundColor Yellow
    Write-Host "   No changes needed." -ForegroundColor Green
    exit 0
}

# Add ingress rule
Write-Host "`n➕ Adding ingress rule for $YourIP/32 on port 27017..." -ForegroundColor Cyan

try {
    Grant-EC2SecurityGroupIngress `
        -GroupId $SecurityGroupId `
        -IpProtocol tcp `
        -FromPort 27017 `
        -ToPort 27017 `
        -CidrIp "$YourIP/32" `
        -Region $Region `
        -Description "Development access - $(Get-Date -Format 'yyyy-MM-dd')"

    Write-Host "✅ Successfully added rule!" -ForegroundColor Green
    Write-Host "`n📝 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Download MongoDB certificate (see docs/DOWNLOAD_MONGODB_CERTIFICATE.md)" -ForegroundColor White
    Write-Host "   2. Run: npm run db:seed" -ForegroundColor White
} catch {
    Write-Host "❌ Error adding rule: $_" -ForegroundColor Red
    exit 1
}

