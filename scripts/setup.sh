#!/bin/bash

set -eu -o pipefail

# Get project root directory
ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null)
if [[ -z "$ROOT_DIR" ]]; then
    echo "Error: Not in a git repository"
    exit 1
fi

cd "$ROOT_DIR"

# Read required Node version from .node-version
if [[ ! -f "${ROOT_DIR}/.node-version" ]]; then
    echo "Error: .node-version file not found"
    exit 1
fi
REQUIRED_NODE_VERSION=$(cat "${ROOT_DIR}/.node-version" | tr -d '[:space:]')

# Try to use the versioned node from Homebrew first
NODE_PATH="/opt/homebrew/opt/node@${REQUIRED_NODE_VERSION}/bin"
if [[ -d "$NODE_PATH" ]]; then
    export PATH="${NODE_PATH}:$PATH"
fi

# Check if npm is available
if ! command -v npm >/dev/null 2>&1; then
    echo "Error: npm is not installed."
    echo ""
    echo "To install Node.js v${REQUIRED_NODE_VERSION}, run:"
    echo "  brew install node@${REQUIRED_NODE_VERSION}"
    echo ""
    echo "Or use direnv to automatically load the correct version:"
    echo "  direnv allow"
    exit 1
fi

# Check Node version
CURRENT_NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
if [[ "$CURRENT_NODE_VERSION" != "$REQUIRED_NODE_VERSION" ]]; then
    echo "Warning: Found Node.js v${CURRENT_NODE_VERSION}, but v${REQUIRED_NODE_VERSION} is required"
    echo ""
    echo "To install the correct version, run:"
    echo "  brew install node@${REQUIRED_NODE_VERSION}"
    echo ""
    echo "Or use direnv to automatically load the correct version:"
    echo "  direnv allow"
    exit 1
fi

# Copy .env.example to .env if needed
if [ ! -f "${ROOT_DIR}/.env" ]; then
    cp "${ROOT_DIR}/.env.example" "${ROOT_DIR}/.env"
    echo "Created .env from .env.example"
fi

# Check if npm install is needed
if [[ ! -d "${ROOT_DIR}/node_modules" ]]; then
    echo "Installing dependencies (node_modules/ not found)..."
    npm install
elif [[ ! -f "${ROOT_DIR}/node_modules/.package-lock.json" ]]; then
    echo "Installing dependencies (npm metadata missing)..."
    npm install
elif [[ "${ROOT_DIR}/package-lock.json" -nt "${ROOT_DIR}/node_modules/.package-lock.json" ]]; then
    echo "Installing dependencies (package-lock.json changed)..."
    npm install
fi
