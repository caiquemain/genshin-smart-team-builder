#!/usr/bin/env bash
# Atalho: ./update.sh [args]
exec python3 "$(dirname "$0")/update_game_data.py" "$@"
