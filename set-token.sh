#!/bin/bash
# Usage: bash set-token.sh ghp_votre_nouveau_token
if [ -z "$1" ]; then
  echo "Usage: bash set-token.sh ghp_votre_token"
  exit 1
fi
git remote set-url origin "https://$1@github.com/mrtcassandra-ops/placement-design-system.git"
echo "✓ Token mis à jour. Test:"
git ls-remote --heads origin 2>&1 | head -3 && echo "✓ Connexion OK" || echo "✗ Token invalide"
