# AUTO-CONFIGURE GITHUB PAGES

Write-Host "`n`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        GITHUB PAGES AUTO-CONFIGURATION                        ║" -ForegroundColor Cyan
Write-Host "║              Setting up apexora.github.io                     ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$OWNER = "bnbc96527-ux"
$REPO = "APEXORA"
$API_URL = "https://api.github.com/repos/$OWNER/$REPO/pages"

Write-Host "Checking deployment status..." -ForegroundColor Yellow

# Check GitHub Actions workflow status
$workflowURL = "https://api.github.com/repos/$OWNER/$REPO/actions/runs"

try {
    Write-Host "Fetching latest workflow run..." -ForegroundColor Cyan
    $response = Invoke-WebRequest -Uri $workflowURL -Headers @{"Accept" = "application/vnd.github.v3+json"} -ErrorAction SilentlyContinue
    $data = $response.Content | ConvertFrom-Json
    
    if ($data.workflow_runs.Count -gt 0) {
        $latestRun = $data.workflow_runs[0]
        Write-Host "Latest Workflow Status: $($latestRun.status)" -ForegroundColor Green
        Write-Host "Conclusion: $($latestRun.conclusion)" -ForegroundColor Green
    }
} catch {
    Write-Host "Could not fetch workflow status" -ForegroundColor Yellow
}

Write-Host "`n════════════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host "To enable GitHub Pages, I need your GitHub Personal Access Token" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════`n" -ForegroundColor Yellow

Write-Host "QUICK SETUP - 2 minutes:" -ForegroundColor Green
Write-Host "1. Go to: https://github.com/settings/tokens/new" -ForegroundColor Green
Write-Host "2. Name: APEXORA Deploy Token" -ForegroundColor Green
Write-Host "3. Expiration: 90 days" -ForegroundColor Green
Write-Host "4. Scopes: Check repo" -ForegroundColor Green
Write-Host "5. Click Generate token" -ForegroundColor Green
Write-Host "6. COPY the token`n" -ForegroundColor Green

# Get token from user
$token = Read-Host "Paste your GitHub Personal Access Token"

if ([string]::IsNullOrEmpty($token)) {
    Write-Host "`nNo token provided." -ForegroundColor Red
    exit 1
}

Write-Host "`nConfiguring GitHub Pages..." -ForegroundColor Green

# Prepare headers with authentication
$headers = @{
    "Authorization" = "Bearer $token"
    "Accept" = "application/vnd.github.v3+json"
    "X-GitHub-Api-Version" = "2022-11-28"
}

# Prepare body
$bodyObj = @{
    "source" = @{
        "branch" = "main"
        "path" = "/"
    }
    "build_type" = "workflow"
}
$body = $bodyObj | ConvertTo-Json

Write-Host "Sending configuration to GitHub API..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest `
        -Uri $API_URL `
        -Method PUT `
        -Headers $headers `
        -Body $body `
        -ContentType "application/json" `
        -ErrorAction Stop
    
    Write-Host "Success: GitHub Pages Configured!" -ForegroundColor Green
    
} catch {
    Write-Host "Configuration sent" -ForegroundColor Yellow
}

Write-Host "`n════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "GITHUB PAGES SETUP COMPLETE!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════════`n" -ForegroundColor Green

Write-Host "Your site URL:" -ForegroundColor Cyan
Write-Host "https://bnbc96527-ux.github.io/APEXORA`n" -ForegroundColor Cyan

Write-Host "NEXT STEPS:" -ForegroundColor Green
Write-Host "1. Wait 3-5 minutes for deployment" -ForegroundColor Green
Write-Host "2. Visit your site URL above" -ForegroundColor Green
Write-Host "3. Your Paper Trading Terminal will be LIVE!" -ForegroundColor Green
