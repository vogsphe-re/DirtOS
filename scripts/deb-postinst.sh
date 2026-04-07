#!/bin/sh
set -e

APP_BIN="/usr/bin/dirtos"
EXAMPLE_NAME="DirtOS-Example-Garden.json"

resolve_user() {
    if [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "root" ]; then
        printf '%s\n' "$SUDO_USER"
        return
    fi

    if [ -n "$PKEXEC_UID" ]; then
        getent passwd "$PKEXEC_UID" | cut -d: -f1
        return
    fi

    if [ -n "$USER" ] && [ "$USER" != "root" ]; then
        printf '%s\n' "$USER"
        return
    fi

    logname 2>/dev/null || true
}

run_as_user() {
    target_user="$1"
    shift

    if command -v runuser >/dev/null 2>&1; then
        runuser -u "$target_user" -- "$@"
        return
    fi

    su -s /bin/sh "$target_user" -c "\"$1\" \"$2\" \"$3\""
}

install_example_garden() {
    target_user="$(resolve_user)"
    if [ -z "$target_user" ] || [ "$target_user" = "root" ]; then
        exit 0
    fi

    target_home="$(getent passwd "$target_user" | cut -d: -f6)"
    if [ -z "$target_home" ] || [ ! -d "$target_home" ] || [ ! -x "$APP_BIN" ]; then
        exit 0
    fi

    target_path="$target_home/Documents/DirtOS/Examples/$EXAMPLE_NAME"
    if [ -f "$target_path" ]; then
        exit 0
    fi

    run_as_user "$target_user" "$APP_BIN" --write-example-garden "$target_path" >/dev/null 2>&1 || true
}

install_example_garden