#!/bin/sh
set -e

echo "Installing dependencies with retry logic..."

for i in 1 2 3; do
  echo "Install attempt $i..."
  npm install 2>&1 | grep -v "^npm warn" || true

  # Check if install actually worked
  if [ -f "node_modules/@sveltejs/kit/package.json" ] && [ -f ".svelte-kit/tsconfig.json" ]; then
    echo "✓ Dependencies installed successfully"
    exit 0
  else
    echo "✗ Install attempt $i failed - packages missing"

    if [ $i -eq 3 ]; then
      echo "ERROR: All 3 install attempts failed"
      exit 1
    fi

    echo "Cleaning up and retrying in 5 seconds..."
    rm -rf node_modules .svelte-kit package-lock.json 2>/dev/null || true
    sleep 5
  fi
done

exit 1
