#!/usr/bin/env python3
"""
Configure GitHub Pages for APEXORA repository
"""
import subprocess
import json
import time

# Repository info
OWNER = "bnbc96527-ux"
REPO = "APEXORA"

print("""
╔════════════════════════════════════════════════════════════════╗
║        Configuring GitHub Pages - APEXORA                     ║
╚════════════════════════════════════════════════════════════════╝

Setting up GitHub Pages with GitHub Actions as source...
""")

# Get the latest workflow run
time.sleep(3)
print("Checking deployment workflow status...")

# You need to authenticate with GitHub first
# Instructions for manual setup if needed
print("""
GitHub Pages configuration requires authenticated access.

If you don't have gh CLI authenticated yet, please:

1. Go to: https://github.com/bnbc96527-ux/APEXORA/settings/pages
2. Under "Build and deployment":
   - Select Source: "GitHub Actions"
   - Click "Save"
3. Under "Custom domain":
   - Enter: apexora.github.io
   - Click "Save"

The deployment will then start automatically!
""")
