param(
    [string]$VpsIp
)

# 1. Check for IP
if ([string]::IsNullOrEmpty($VpsIp)) {
    $VpsIp = Read-Host "Enter your VPS IP Address"
}

if ([string]::IsNullOrEmpty($VpsIp)) {
    Write-Host "❌ VPS IP is required." -ForegroundColor Red
    exit 1
}

# 2. Build the project
Write-Host "🔨 Building TypeScript..." -ForegroundColor Cyan
& ".\node_modules\.bin\tsc"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed. Aborting deployment." -ForegroundColor Red
    exit 1
}

# 3. Define paths
$LocalBuildPath = ".\data\build"
$RemotePath = "/srv/nakama/data/"

# 4. Deploy
Write-Host "🚀 Deploying compiled code to $VpsIp..." -ForegroundColor Cyan
Write-Host "📂 Copying $LocalBuildPath to root@$VpsIp:$RemotePath ..." -ForegroundColor Yellow

# SCP recursively copies the folder 'build' into 'data/', resulting in 'data/build'
scp -r $LocalBuildPath root@$VpsIp:$RemotePath

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Deployment Successful!" -ForegroundColor Green
    Write-Host "👉 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. ssh root@$VpsIp"
    Write-Host "   2. cd /srv/nakama"
    Write-Host "   3. docker compose restart nakama"
} else {
    Write-Host "❌ SCP Failed. Check your SSH keys or IP address." -ForegroundColor Red
}
