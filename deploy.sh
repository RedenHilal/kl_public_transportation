#!/bin/bash

# Configuration - Change these to match your server
REMOTE_USER="ellen"
REMOTE_HOST="yuellen.my.id"
REMOTE_DEST="/home/ellen/sig"
REMOTE_PORT=55555

# Ensure the build is fresh
echo "Building the web app..."
cd app && npm run build && cd ..

echo "Transferring files to $REMOTE_HOST..."

# Rsync command
# -a: archive mode (preserves permissions, symlinks, etc)
# -v: verbose
# -z: compress data during transfer
# --delete: remove files on destination that are no longer on source
# -e "ssh -p ${REMOTE_PORT}": specify custom SSH port
rsync -avz -e "ssh -p ${REMOTE_PORT}" --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='.vscode' \
  --exclude='.claude' \
  --exclude='.env' \
  --exclude='app/src' \
  --exclude='app/node_modules' \
  --exclude='app/public' \
  --exclude='app/package*.json' \
  --exclude='app/vite.config.js' \
  --exclude='app/eslint.config.js' \
  --exclude='app/index.html' \
  --exclude='gtfs-realtime-fetcher/node_modules' \
  --exclude='*.md' \
  ./ ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DEST}

echo "Done! Files transferred to ${REMOTE_DEST}"
