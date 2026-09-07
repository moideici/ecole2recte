# Installe, verifie et prepare le projet. Ne se connecte a aucun compte.
# Lancement : powershell -ExecutionPolicy Bypass -File DEMARRER\demarrer.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

function Etape($texte) { Write-Host "`n— $texte" -ForegroundColor White }
function Echec($texte) { Write-Host "`n$texte" -ForegroundColor Red; exit 1 }

Etape 'Verification de ce qui est installe'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Echec "Node.js manque. Installe-le depuis https://nodejs.org (version 22 ou plus), puis rouvre PowerShell."
}
$version = (node --version) -replace '^v', ''
if ([int]($version.Split('.')[0]) -lt 22) {
  Echec "Node.js $version est trop ancien. Il faut la version 22 ou plus : https://nodejs.org"
}
Write-Host "  Node.js $version"

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Write-Host '  pnpm manque, activation par corepack...'
  corepack enable pnpm
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Echec "pnpm reste introuvable. Rouvre PowerShell, ou installe-le avec : npm install -g pnpm"
}
Write-Host "  pnpm $(pnpm --version)"

Etape 'Fichier de configuration'

if (Test-Path '.env') {
  Write-Host "  .env existe deja, il n'est pas touche."
} else {
  Copy-Item '.env.example' '.env'
  # Une cle au hasard : elle scelle le couple de confiance de la question de securite.
  # Elle reste sur cette machine et n'est jamais versionnee.
  $cle = node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
  $texte = (Get-Content '.env' -Raw) -replace '(?m)^SESSION_SECRET=.*$', "SESSION_SECRET=$cle"
  Set-Content '.env' $texte -NoNewline
  Write-Host '  .env cree, avec une cle generee au hasard.'
}

Etape "Installation des dependances (c'est le plus long)"
pnpm install
if ($LASTEXITCODE -ne 0) { Echec "L'installation a echoue. Copie-colle le message ci-dessus." }

Etape 'Tests'
pnpm -r test
if ($LASTEXITCODE -ne 0) { Echec "Des tests echouent. Ce n'est pas normal : copie-colle le message ci-dessus." }

Etape 'Construction'
pnpm -r build
if ($LASTEXITCODE -ne 0) { Echec "La construction a echoue. Copie-colle le message ci-dessus." }

Write-Host "`nTout est pret." -ForegroundColor Green
Write-Host @"

La suite, dans l'ordre :

  1. pnpm probe                              -> tranche la question CORS (sans identifiants)
  2. pnpm --filter @ecole2recte/web dev      -> lance l'application sur http://localhost:5173
  3. pnpm smoke                              -> eprouve l'ecriture sur un vrai compte

Le detail de chaque etape est dans DEMARRER/README.md.
"@
