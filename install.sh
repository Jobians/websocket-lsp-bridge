#!/usr/bin/env sh
# Install wslsp for Termux on Android.
# Usage: bash <(curl -fsSL https://raw.githubusercontent.com/jobians/websocket-lsp-bridge/main/install.sh)

set -e

REPO="jobians/websocket-lsp-bridge"
BIN="$PREFIX/bin/wslsp"

case "$(uname -m)" in
  aarch64) arch="aarch64" ;;
  armv7l|armv7|arm) arch="armv7" ;;
  *) echo "Unsupported architecture: $(uname -m)"; exit 1 ;;
esac

latest=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
  | grep '"tag_name"' | cut -d'"' -f4)

echo "Installing wslsp $latest ($arch)..."

curl -fsSL "https://github.com/$REPO/releases/download/$latest/wslsp-$latest-$arch.tar.gz" \
  | tar -xz -C "$PREFIX/bin"

chmod +x "$BIN"
echo "Done. Run: wslsp --help"
