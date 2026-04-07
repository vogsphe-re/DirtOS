#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="DirtOS"
PROJECT_DIR="$(dirname "$PWD")/${PROJECT_NAME}"
VERSION="$(<"$PROJECT_DIR/VERSION")"
ARCH="$(dpkg --print-architecture)"
DEB_PATH="$PROJECT_DIR/src-tauri/target/release/bundle/deb/DirtOS_${VERSION}_${ARCH}.deb"
POSTINST_SRC="$PROJECT_DIR/scripts/deb-postinst.sh"

cd "$PROJECT_DIR"

# ── Clean previous build   ──────────────────────────────────────────────────
rm -rf "$PROJECT_DIR/dist"

# ── Install prerequisites ───────────────────────────────────────────────────
echo "Setting up prerequisites..."
sudo apt update
sudo apt install -y build-essential fakeroot dpkg-dev debhelper

# ── Setup NPM ───────────────────────────────────────────────────────────────
echo "Setting up NPM..."

# Check if NVM is installed, if not, install it
if ! command -v nvm &> /dev/null; then
    echo "NVM is not installed. Installing NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    # shellcheck disable=SC1091
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
else
    echo "NVM is already installed."
fi

# Ensure NVM is loaded and install the required Node.js version
NVM_VERSION="$(<"$PROJECT_DIR/.nvmrc")"
nvm install "$NVM_VERSION"
nvm use "$NVM_VERSION"

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

echo "Injecting Debian post-install hook..."
DEB_ROOT="$(mktemp -d)"
trap 'rm -rf "$DEB_ROOT"' EXIT
dpkg-deb -R "$DEB_PATH" "$DEB_ROOT"
install -Dm755 "$POSTINST_SRC" "$DEB_ROOT/DEBIAN/postinst"
fakeroot dpkg-deb -b "$DEB_ROOT" "$DEB_PATH"
rm -rf "$DEB_ROOT"
trap - EXIT

echo ""
echo "Done."
