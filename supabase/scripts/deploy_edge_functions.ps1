# Deploie les Edge Functions Supabase requises par Easy Dunya.
# Usage (apres supabase login) :
#   powershell -ExecutionPolicy Bypass -File supabase/scripts/deploy_edge_functions.ps1

$ProjectRef = "prfmqfnaqtmyfyxqjeli"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $Root

$functions = @(
  "create-driver-account",
  "directions",
  "register-passenger",
  "send-fcm",
  "send-push"
)

foreach ($fn in $functions) {
  Write-Host "Deploiement de $fn ..." -ForegroundColor Cyan
  supabase functions deploy $fn --project-ref $ProjectRef
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Echec deploiement $fn (code $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
  }
}

Write-Host "Toutes les Edge Functions sont deployees." -ForegroundColor Green
