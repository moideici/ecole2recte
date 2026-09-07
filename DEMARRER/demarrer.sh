#!/usr/bin/env bash
# Installe, vérifie et prépare le projet. Ne se connecte à aucun compte, ne modifie rien
# hors de ce dossier.
set -u

racine="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$racine" || exit 1

echec() { printf '\n\033[31m%s\033[0m\n' "$1"; exit 1; }
etape() { printf '\n\033[1m— %s\033[0m\n' "$1"; }

etape "Vérification de ce qui est installé"

command -v node >/dev/null 2>&1 || echec "Node.js manque. Installe-le depuis https://nodejs.org (version 22 ou plus), puis rouvre ce terminal."

version="$(node --version | sed 's/^v//' | cut -d. -f1)"
[ "$version" -ge 22 ] 2>/dev/null || echec "Node.js $(node --version) est trop ancien. Il faut la version 22 ou plus : https://nodejs.org"
echo "  Node.js $(node --version)"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "  pnpm manque, activation par corepack…"
  corepack enable pnpm >/dev/null 2>&1 || echec "corepack n'a pas pu activer pnpm. Essaie : npm install -g pnpm"
fi
command -v pnpm >/dev/null 2>&1 || echec "pnpm reste introuvable. Rouvre ce terminal, ou installe-le avec : npm install -g pnpm"
echo "  pnpm $(pnpm --version)"

etape "Fichier de configuration"

if [ -f .env ]; then
  echo "  .env existe déjà, il n'est pas touché."
else
  cp .env.example .env
  # Une clé au hasard : elle sert à sceller le couple de confiance de la question de
  # sécurité. Elle reste sur cette machine et n'est jamais versionnée.
  cle="$(node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))")"
  node -e "
    const fs = require('node:fs')
    const texte = fs.readFileSync('.env', 'utf8').replace(/^SESSION_SECRET=.*\$/m, 'SESSION_SECRET=' + process.argv[1])
    fs.writeFileSync('.env', texte)
  " "$cle"
  echo "  .env créé, avec une clé générée au hasard."
fi

etape "Installation des dépendances (c'est le plus long)"
pnpm install || echec "L'installation a échoué. Copie-colle le message ci-dessus."

etape "Tests"
pnpm -r test || echec "Des tests échouent. Ce n'est pas normal : copie-colle le message ci-dessus."

etape "Construction"
pnpm -r build || echec "La construction a échoué. Copie-colle le message ci-dessus."

printf '\n\033[32mTout est prêt.\033[0m\n\n'
cat <<'FIN'
La suite, dans l'ordre :

  1. pnpm probe                              → tranche la question CORS (sans identifiants)
  2. pnpm --filter @ecole2recte/web dev      → lance l'application sur http://localhost:5173
  3. pnpm smoke                              → éprouve l'écriture sur un vrai compte

Le détail de chaque étape est dans DEMARRER/README.md.
FIN
