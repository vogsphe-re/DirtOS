#!/bin/sh
set -e

APP_DIR_NAME="DirtOS"

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

purge_user_data() {
    target_user="$(resolve_user)"
    if [ -z "$target_user" ] || [ "$target_user" = "root" ]; then
        return
    fi

    target_home="$(getent passwd "$target_user" | cut -d: -f6)"
    if [ -z "$target_home" ] || [ ! -d "$target_home" ]; then
        return
    fi

    target_dir="$target_home/Documents/$APP_DIR_NAME"
    case "$target_dir" in
        */Documents/DirtOS) ;;
        *) return ;;
    esac

    if [ -d "$target_dir" ]; then
        rm -rf "$target_dir"
    fi
}

case "$1" in
    purge)
        purge_user_data
        ;;
    remove|upgrade|failed-upgrade|abort-install|abort-upgrade|disappear)
        ;;
    *)
        ;;
esac

exit 0
