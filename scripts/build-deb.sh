#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
NPM_VERSION=$(<".nvmrc")

cd "$ROOT"

# ── Clean previous build   ──────────────────────────────────────────────────
rm -rf "$ROOT/dist"

# ── Setup dependencies ──────────────────────────────────────────────────────
echo "Setting up dependencies..."
sudo apt update
sudo apt install -y build-essential fakeroot dpkg-dev debhelper

# ── Setup NPM ───────────────────────────────────────────────────────────────
echo "Setting up NPM..."

# Check if Node.js is already installed and at the correct version
if command -v node &> /dev/null; then
    INSTALLED_NODE_VERSION=$(node -v | sed 's/v//')
    if [[ "$INSTALLED_NODE_VERSION" == "$NPM_VERSION" || "$INSTALLED_NODE_VERSION" == "$NPM_VERSION.*.*" ]]; then
        echo "Node.js version $INSTALLED_NODE_VERSION is already installed and matches the required version $NPM_VERSION."
    else
        echo "Node.js version $INSTALLED_NODE_VERSION is installed but does not match the required version $NPM_VERSION. Installing the correct version..."
        curl -fsSL https://deb.nodesource.com/setup_${NPM_VERSION}.x | sudo bash -
    fi
else
    echo "Node.js is not installed. Installing Node.js version $NPM_VERSION..."
    curl -fsSL https://deb.nodesource.com/setup_${NPM_VERSION}.x | sudo bash -
fi

# ── Install PNPM globally ───────────────────────────────────────────────────

# Check if PNPM is already installed
if command -v pnpm &> /dev/null; then
    echo "PNPM is already installed."
else
    echo "PNPM is not installed. Installing PNPM globally..."
    npm install -g pnpm
fi

# ── Clean build ─────────────────────────────────────────────────────────────

# Install dependencies and build the project with the deb bundle
pnpm install
echo "Running clean build..."
pnpm build --bundles deb

echo ""
echo "Done."
