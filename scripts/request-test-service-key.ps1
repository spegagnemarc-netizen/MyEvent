$ErrorActionPreference = 'Stop'
$storageTestSecure = Read-Host 'Collez la cle sb_secret_ du projet TEST ahyyknfjsielnqyoxqgh, puis Entree (caracteres invisibles)' -AsSecureString
$storageTestCredential = New-Object System.Management.Automation.PSCredential('ahyyknfjsielnqyoxqgh', $storageTestSecure)
$storageTestPlain = $storageTestCredential.GetNetworkCredential().Password
try {
 if ($storageTestPlain -notmatch '^sb_secret_[A-Za-z0-9_-]+$') { throw 'Mauvaise cle : utilisez la cle moderne sb_secret_ du projet TEST, pas sb_publishable ni la cle Legacy exposee.' }
 $storageTestDestination = Join-Path (Split-Path $PSScriptRoot -Parent) 'work-test-service.credential.xml'
 $storageTestCredential | Export-Clixml -LiteralPath $storageTestDestination
 Write-Host 'Cle TEST enregistree sous protection Windows. Repondez saisi dans le chat.'
} finally { $storageTestPlain = $null }
