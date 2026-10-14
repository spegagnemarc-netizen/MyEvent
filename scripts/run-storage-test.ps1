$ErrorActionPreference = 'Stop'
$storageTestRoot = Split-Path $PSScriptRoot -Parent
$storageTestResult = Join-Path $storageTestRoot 'docs/orevami/storage-test-result.json'
if (Test-Path -LiteralPath $storageTestResult) {
 Write-Host 'Un resultat existe deja. Aucun nouveau controle lance : indiquez-le dans le chat.'
 return
}
$storageTestCredentialPath = Join-Path $storageTestRoot 'work-test-service.credential.xml'
if (-not (Test-Path -LiteralPath $storageTestCredentialPath)) {
 & (Join-Path $PSScriptRoot 'request-test-service-key.ps1')
}
$storageTestSaved = Import-Clixml -LiteralPath $storageTestCredentialPath
try {
 $env:OREVAMI_STORAGE_TEST_SECRET = $storageTestSaved.GetNetworkCredential().Password
 Push-Location $storageTestRoot
 try { node scripts/validate-event-storage-test.mjs } finally { Pop-Location }
} finally {
 Remove-Item Env:OREVAMI_STORAGE_TEST_SECRET -ErrorAction SilentlyContinue
}
