# 🧩 ws-lsp-bridge

A lightweight **WebSocket → Language Server Protocol (LSP) bridge** for editors and IDEs.  
It allows **web-based editors** or **remote clients** to connect to any LSP server over WebSocket — perfect for environments like [Acode](https://acode.app/) or browser-based IDEs.

---

## ✨ Features

- 🔌 **Spawn any LSP server** (`stdio` or `ipc`) and expose it via WebSocket  
- 🌐 **Bridge** messages between web editors and LSP servers in real time  
- 🧠 **Multi-endpoint** support (each LSP runs on its own WebSocket path)  
- ⚡ **Lightweight** — single static binary, no Node.js or npm required  
- 📱 Built for **Android / Termux** (aarch64, armv7, x86_64) and **Linux musl** (aarch64, armv7)

---

## 📦 Installation on Termux

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/jobians/websocket-lsp-bridge/main/install.sh)
```

---

## 🚀 Usage

Start the WebSocket LSP bridge:

```bash
wslsp
```

By default, the server listens on **port 3030**.

Then connect your editor to a WebSocket endpoint, specifying which LSP server to launch via query parameters.

**TypeScript LSP (stdio):**

```
ws://localhost:3030/typescript?args=typescript-language-server,--stdio&type=stdio
```

**Pyright (stdio):**

```
ws://localhost:3030/python?args=pyright-langserver,--stdio&root=/data/data/com.termux/files/home/myproject
```

**Node IPC mode** (requires `node` + `vscode-jsonrpc` on PATH):

```
ws://localhost:3030/tsserver?args=tsserver&type=ipc
```

---

## ⚙️ CLI Options

```
wslsp [OPTIONS]

Options:
  -p, --port <PORT>   Port for the WebSocket server [env: PORT] [default: 3030]
  -h, --help          Print help
  -V, --version       Print version
```

You can also set the port via environment variable:

```bash
PORT=4040 wslsp
# or
wslsp --port 4040
```

---

## 🧠 How It Works

1. The bridge starts a **WebSocket server** on the specified port.
2. Each connection URL defines which **LSP server** to spawn via query parameters:
   - `args` — command and arguments, comma- or space-separated (e.g. `typescript-language-server,--stdio`)
   - `type` — `stdio` (default) or `ipc`
   - `root` — working directory for the LSP process (default: cwd)
3. The bridge then **pipes LSP JSON-RPC messages** between:
   - **Editor/WebSocket client → LSP stdin** (wrapped in `Content-Length` headers)
   - **LSP stdout → Editor/WebSocket client** (unwrapped from `Content-Length` headers)

```
Editor ──(WebSocket JSON-RPC)──► wslsp ──(stdio)──► LSP Server
       ◄──────────────────────────────  ◄───────────
```

### IPC Mode

When `type=ipc`, `wslsp` spawns a small embedded Node.js relay script that bridges the Node IPC channel to LSP stdio framing. This requires `node` and `vscode-jsonrpc` to be installed. If Node is not found, the socket is closed with a clear error.

---

## 🏗️ Building from Source

```bash
# Install Rust (if not already installed)
curl https://sh.rustup.rs -sSf | sh

cd packages/ws-lsp-bridge
cargo build --release

# Binary is at:
./target/release/wslsp
```

### Cross-compiling for Android (from Linux)

```bash
cargo install cargo-ndk
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android

# Build for aarch64 (most modern Android phones)
cargo ndk --target aarch64-linux-android --platform 21 -- build --release
```

### Cross-compiling for Linux musl (using cross)

```bash
cargo install cross
cross build --target aarch64-unknown-linux-musl --release
cross build --target armv7-unknown-linux-musleabihf --release
```

---

## 💖 Donate

If you like this project and want to support development, you can donate using crypto:  

[Donate here](https://cwallet.com/t/TE6A6KMV)

---

## 🌐 Links

- [GitHub Repository](https://github.com/jobians/websocket-lsp-bridge)
- [Report an Issue](https://github.com/jobians/websocket-lsp-bridge/issues)

---

## 📜 License

MIT License © 2025 [JOBIANSTECHIE](https://github.com/jobians)