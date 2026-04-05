#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=${PWD}/scripts

bash "$SCRIPT_DIR/build-deb.sh"
bash "$SCRIPT_DIR/install-deb.sh"