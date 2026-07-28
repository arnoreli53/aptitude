#!/usr/bin/env bash
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found. Install from https://cli.github.com/"
  exit 1
fi

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 SECRET_NAME SECRET_VALUE"
  exit 2
fi

NAME="$1"
VALUE="$2"

echo "Setting repository secret $NAME using gh..."
gh secret set "$NAME" --body "$VALUE"
echo "Secret $NAME set."
