# Acode LSP Client

## 🧠 Overview

This plugin adds **Language Server Protocol (LSP)** support to Acode via a **WebSocket bridge**, enabling diagnostics, linting, and editor features like completion and hover. It supports multiple language servers per workspace, persists configurations, and automatically restores them on startup.

---

## 🚀 Features

* Multiple LSP servers per workspace
* Persistent workspace configuration with automatic restoration on startup
* UI for adding, editing, and removing server definitions
* Auto-detection of active servers during setup
* Default configurations for popular languages (TypeScript, Deno, Python, PHP, Rust, and more)
* Support for both **Ace** and **CodeMirror** editors

---

## 🧩 Requirements

* A **WebSocket → LSP bridge** (e.g. [websocket-lsp-bridge](https://www.npmjs.com/package/ws-lsp-bridge))
* Installed language servers for the languages you want to use

```bash
# Examples below use Termux (Android)

# TypeScript / JavaScript
npm i -g typescript typescript-language-server

# Deno
pkg install deno

# Python
pip install pyright

# PHP
npm i -g intelephense

# Rust
pkg install rust-analyzer

# And so on ...
```

---

## ⚙️ Setup

### 1. Start the WebSocket Bridge

The plugin requires a running WebSocket → LSP bridge. Install it once:

```bash
npm install -g ws-lsp-bridge
```

Then start it before using the plugin:

```bash
wslsp
```

> See [websocket-lsp-bridge](https://github.com/Jobians/websocket-lsp-bridge/tree/main/packages/ws-lsp-bridge) for alternative installation methods and configuration options.

### 2. Configure the Plugin

1. Install and enable the plugin in Acode
2. Open a folder in Acode
3. Press **Ctrl + L** or **Ctrl + Shift + L** to open the LSP setup prompt
4. Select one or more language servers
5. Start coding — completion, hover, and diagnostics activate automatically

## 🎬 Tutorial

<video src="https://raw.githubusercontent.com/Jobians/websocket-lsp-bridge/refs/heads/main/packages/acode-lsp-client/tutorial.mp4" controls width="100%"></video>

---

## 🔧 Configuration

Manage servers via **LSP Settings**:

* Open command palette (**Ctrl + Shift + P**) → search **LSP Settings**
* Or access it from the plugin page

You can add new servers, edit existing configurations, remove servers, and delete saved workspaces.

---

## 💡 Contributing

Contributions are welcome. Feel free to improve language support, optimize performance, or enhance connection handling.

---

## 💖 Donate

If you’d like to support development:

👉 [https://cwallet.com/t/TE6A6KMV](https://cwallet.com/t/TE6A6KMV)

---

## 🌐 Links

* [https://github.com/jobians/websocket-lsp-bridge](https://github.com/jobians/websocket-lsp-bridge)
* [https://github.com/jobians/websocket-lsp-bridge/issues](https://github.com/jobians/websocket-lsp-bridge/issues)

---

## 📜 License

MIT License © 2025-2026 JOBIANSTECHIE
