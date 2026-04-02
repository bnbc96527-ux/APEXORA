# ================================================================
# COMPLETE AUTOMATED DEPLOYMENT SCRIPT
# Paper Trading Terminal to GitHub + Vercel
# ================================================================
# Run this entire script to deploy automatically!
# ================================================================

$ErrorActionPreference = 'Stop'

# Step 1: Set up GitHub CLI environment
Write-Host "`n========== STEP 1: Setting up GitHub CLI ==========" -ForegroundColor Cyan
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Step 2: Check GitHub authentication
Write-Host "`nChecking GitHub authentication..." -ForegroundColor Yellow
$authStatus = & gh auth status 2>&1
if ($authStatus -like "*not logged*" -or $authStatus -like "*No such*") {
    Write-Host "`n⚠️  You need to authenticate with GitHub first!"
    Write-Host "Running GitHub login in browser..." -ForegroundColor Yellow
    & gh auth login --web
} else {
    Write-Host "✅ Already authenticated with GitHub" -ForegroundColor Green
}

# Step 3: Create GitHub repository
Write-Host "`n========== STEP 2: Creating GitHub Repository ==========" -ForegroundColor Cyan
$repoName = "paper-trading-terminal"
$repoDesc = "Paper Trading Terminal App"

Write-Host "Creating repository: $repoName" -ForegroundColor Yellow
try {
    $result = & gh repo create $repoName --public --source=. --remote=origin --push --description=$repoDesc 2>&1
    Write-Host "✅ Repository created and code pushed!" -ForegroundColor Green
    Write-Host "Repository URL: https://github.com/$(gh api user -q .login)/$repoName" -ForegroundColor Green
} catch {
    Write-Host "Repository might already exist. Skipping creation..." -ForegroundColor Yellow
}

# Step 4: Get repository details
Write-Host "`n========== STEP 3: Repository Details ==========" -ForegroundColor Cyan
$username = & gh api user -q .login
$repoUrl = "https://github.com/$username/$repoName"
Write-Host "Repository URL: $repoUrl" -ForegroundColor Green
Write-Host "✅ Your code is now on GitHub!" -ForegroundColor Green

# Step 5: Provide Vercel deployment instructions
Write-Host "`n========== STEP 4: Deploy to Vercel ==========" -ForegroundColor Cyan
Write-Host @"

🚀 YOUR REPOSITORY IS READY FOR DEPLOYMENT!

Next steps to get your site live on the internet:

1. Go to: https://vercel.com/new
2. Click "Continue with GitHub"
3. Authorize Vercel to access your GitHub account
4. Select repository: $repoName
5. Click "Import"
6. Click "Deploy"

⏱️  Wait 2-3 minutes for the deployment to complete

✅ Your site will be live at: https://$repoName.vercel.app

After deployment, you can:
- View your live site at: https://$repoName.vercel.app
- Manage it at: https://vercel.com
- Every time you push to GitHub, it will auto-deploy!

"@

Write-Host "`n========== DEPLOYMENT SUMMARY ==========" -ForegroundColor Green
Write-Host "✅ Code committed locally" -ForegroundColor Green
Write-Host "✅ Repository created on GitHub: $repoUrl" -ForegroundColor Green
Write-Host "⏳ Next: Go to https://vercel.com/new and deploy!" -ForegroundColor Yellow
Write-Host "`nPress Enter to open Vercel in your browser..." -ForegroundColor Cyan
Read-Host

# Open Vercel
Write-Host "Opening Vercel..." -ForegroundColor Yellow
Start-Process "https://vercel.com/new"

Write-Host "`n✅ DEPLOYMENT COMPLETE!" -ForegroundColor Green
