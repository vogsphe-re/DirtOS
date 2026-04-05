#!/usr/bin/env bash
set -euo pipefail

# --- Formatting ---
RESET="\e[0m"

# --- Helper: build 24-bit foreground/background escape sequences ---
# fg R G B  →  \e[38;2;R;G;Bm
# bg R G B  →  \e[48;2;R;G;Bm
_fg() { printf '\e[38;2;%s;%s;%sm' "$1" "$2" "$3"; }
_bg() { printf '\e[48;2;%s;%s;%sm' "$1" "$2" "$3"; }

# Orange
ORANGE="$(_fg 254 128 25)"
ORANGE_NEUTRAL="$(_fg 214 93 14)"
ORANGE_FADED="$(_fg 175 58 3)"

BLUE_NEUTRAL="$(_fg 69 133 136)"
GREEN_FADED="$(_fg 121 116 14)"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
ARCH="$(dpkg --print-architecture)"
VERSION=$(<"$ROOT/VERSION")

cd "$ROOT"

# ── Remove existing installation if present ──────────────────────────────────
if dpkg -l | grep -q "dirt-os"; then
    echo "$ORANGE_FADED DirtOS is already installed. Do you want to uninstall the existing version and install the new one? (y/n) $RESET"
    read -r response
    if [[ "$response" != "y" ]]; then
        echo "$ORANGE_NEUTRAL Installation aborted. $RESET"
        exit 1
    fi
    echo "$ORANGE Uninstalling existing DirtOS installation... $RESET"
    echo "Uninstalling existing DirtOS installation..."
    sudo dpkg -r dirt-os
fi

# ── Install with dpkg ───────────────────────────────────────────────────────
echo "$BLUE_NEUTRAL Installing DirtOS version $VERSION for architecture $ARCH... $RESET"
sudo dpkg -i "$ROOT/src-tauri/target/release/deb/dirtos_${VERSION}_${ARCH}.deb"
echo "$GREEN_FADED DirtOS version $VERSION has been installed successfully. $RESET"