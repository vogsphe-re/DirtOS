#!/usr/bin/env bash
set -euo pipefail

# ── Formatting ───────────────────────────────────────────────────────────────

# Helper: build 24-bit foreground/background escape sequences
# fg R G B  →  \e[38;2;R;G;Bm
# bg R G B  →  \e[48;2;R;G;Bm
_fg() { printf '\e[38;2;%s;%s;%sm' "$1" "$2" "$3"; }
_bg() { printf '\e[48;2;%s;%s;%sm' "$1" "$2" "$3"; }

ORANGE="$(_fg 254 128 25)"
ORANGE_NEUTRAL="$(_fg 214 93 14)"
ORANGE_FADED="$(_fg 175 58 3)"
BLUE_NEUTRAL="$(_fg 69 133 136)"
GREEN_FADED="$(_fg 121 160 70)"

# ── Project Info ─────────────────────────────────────────────────────────────
PROJECT_NAME="DirtOS"
PROJECT_DIR="$(dirname "$PWD")/${PROJECT_NAME}"
ROOT="${PROJECT_DIR}"
ARCH="$(dpkg --print-architecture)"
VERSION=$(<"$PROJECT_DIR/VERSION")
EXAMPLE_PATH="$HOME/Documents/DirtOS/Examples/DirtOS-Example-Garden.json"

cd "$PROJECT_DIR"

# ── Remove existing installation if present ──────────────────────────────────
if dpkg -l | grep "dirt-os"; then
    echo "$ORANGE_FADED DirtOS is already installed. Do you want to uninstall the existing version and install the new one? (y/n)"
    read -r response
    if [[ "$response" != "y" ]]; then
        echo "$ORANGE_NEUTRAL Installation aborted."
        exit 1
    fi
    echo "$ORANGE Uninstalling existing DirtOS installation..."
    echo "Uninstalling existing DirtOS installation..."
    sudo dpkg -r dirt-os
fi

# ── Install with dpkg ───────────────────────────────────────────────────────
echo "$BLUE_NEUTRAL Installing DirtOS version $VERSION for architecture $ARCH..."
sudo dpkg -i "$ROOT/src-tauri/target/release/bundle/deb/DirtOS_${VERSION}_${ARCH}.deb"

if [[ ! -f "$EXAMPLE_PATH" ]] && command -v dirtos &> /dev/null; then
    echo "$BLUE_NEUTRAL Installing example garden to $EXAMPLE_PATH..."
    if dirtos --write-example-garden "$EXAMPLE_PATH" >/dev/null 2>&1; then
        echo "$GREEN_FADED Example garden installed to $EXAMPLE_PATH."
    else
        echo "$ORANGE_NEUTRAL Warning: DirtOS installed, but the example garden could not be written automatically."
    fi
fi

echo "$GREEN_FADED DirtOS version $VERSION has been installed successfully."