#!/usr/bin/env sh
# Install wslsp for Termux on Android.
# Usage: bash <(curl -fsSL https://raw.githubusercontent.com/jobians/websocket-lsp-bridge/main/install.sh)

set -e

REPO="jobians/websocket-lsp-bridge"
BIN="$PREFIX/bin/wslsp"

case "$(uname -m)" in
  aarch64) target="aarch64-linux-android" ;;
  armv7l|armv7|arm) target="armv7-linux-androideabi" ;;
  x86_64) target="x86_64-linux-android" ;;
  *) echo "Unsupported architecture: $(uname -m)"; exit 1 ;;
esac

latest=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
  | grep '"tag_name"' | cut -d'"' -f4)

echo "Installing wslsp $latest ($target)..."

curl -fsSL "https://github.com/$REPO/releases/download/$latest/wslsp-$latest-$target.tar.gz" \
  | tar -xz -C "$PREFIX/bin"

chmod +x "$BIN"
echo "Done. Run: wslsp --help"
