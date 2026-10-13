#!/usr/bin/env sh
# Install wslsp for Termux (Android) or Linux (musl).
# Usage: bash <(curl -fsSL https://raw.githubusercontent.com/jobians/websocket-lsp-bridge/main/install.sh)

set -e

REPO="jobians/websocket-lsp-bridge"
ARCH="$(uname -m)"

# Detect Termux / Android vs general Linux
if [ -n "$PREFIX" ] && [ -d "$PREFIX/bin" ]; then
  DEST="$PREFIX/bin"
  case "$ARCH" in
    aarch64) target="aarch64-linux-android" ;;
    armv7l|armv7|arm) target="armv7-linux-androideabi" ;;
    x86_64) target="x86_64-linux-android" ;;
    *) echo "Unsupported Android architecture: $ARCH"; exit 1 ;;
  esac
else
  # Linux (musl)
  if [ -w "/usr/local/bin" ]; then
    DEST="/usr/local/bin"
  else
    DEST="$HOME/.local/bin"
    mkdir -p "$DEST"
  fi

  case "$ARCH" in
    aarch64) target="aarch64-unknown-linux-musl" ;;
    armv7l|armv7|arm) target="armv7-unknown-linux-musleabihf" ;;
    x86_64) target="x86_64-unknown-linux-musl" ;;
    *) echo "Unsupported Linux architecture: $ARCH"; exit 1 ;;
  esac
fi

latest=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
  | grep '"tag_name"' | cut -d'"' -f4)

echo "Installing wslsp $latest ($target) to $DEST..."

curl -fsSL "https://github.com/$REPO/releases/download/$latest/wslsp-$latest-$target.tar.gz" \
  | tar -xz -C "$DEST"

chmod +x "$DEST/wslsp"
echo "Done. Run: wslsp --help"
