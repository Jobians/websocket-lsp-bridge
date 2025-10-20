# Acode LSP Client (Experimental)

> ⚠️ **Experimental Project**
> This is a personal project I built and tested mainly on **Termux** using **Deno** and **TypeScript** LSPs.
> It’s not fully tested or production-ready — I’m just sharing it in case others want to explore, improve, or reuse it.
> The source code is open and free to modify.

---

## 🧠 Overview

This plugin adds **Language Server Protocol (LSP)** support to [Acode](https://acode.app/) using a **WebSocket bridge**.
It can manage multiple LSP servers per workspace, remember setups, and restore them automatically when reopening the app.

It’s designed to work with [`websocket-lsp-bridge`](https://github.com/jobians/websocket-lsp-bridge), but it can connect to **any compatible WebSocket-based LSP proxy**.

Additionally, it uses [`ace-linters`](https://github.com/mkslanc/ace-linters) — an awesome open-source project that brings LSP-powered diagnostics and code linting to the Ace editor.
Huge thanks and appreciation to the author **@mkslanc** for making this possible! 🙌

Although it should work with **any LSP**, it has been **fully tested only with**:

* `typescript-language-server`
* `Deno` (inside **Termux**)

---

## 🚀 Features

* Multiple LSP servers per workspace
* Persistent workspace configuration
* Auto-restores open workspaces on startup
* UI for adding, editing, or removing server definitions
* Auto-detects active servers when setting up
* Default configurations for TypeScript, Deno, Python, PHP, and Rust

---

## 🧩 Requirements

* [Acode](https://acode.app/) editor
* A **WebSocket → LSP bridge** (for example: [`websocket-lsp-bridge`](https://github.com/jobians/websocket-lsp-bridge))
* The **language servers themselves** must be installed separately — for example in Termux:

  ```bash
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

Install websocket-lsp-bridge globally:

```bash
npm install -g ws-lsp-bridge
```

1. **Start your LSP bridge**, e.g. with `ws-lsp-bridge`:

   ```bash
   wslsp
   ```
2. **Install and enable** this plugin in Acode.
3. **Open a folder** in Acode.
4. Press **Ctrl + L** to open the **LSP setup prompt**.
5. Select one or more language servers.
6. Start coding — completion, hover info, and diagnostics should work automatically.

---

## 🔧 Configuration

You can manage LSP servers via **LSP Settings → Add Server**.

* Press **Ctrl + Shift + P** to open the command palette, then search for **LSP Settings**.
* Or go to the plugin page and click the settings icon.
* You can **add**, **modify**, or **remove** servers.
* You can also **delete saved workspaces** there.

---

## 🧠 How It Works

* The plugin connects to each LSP server through a WebSocket bridge.
* Workspaces are stored in Acode’s local storage and restored automatically.
* Each open file is registered with the corresponding LSP client depending on its mode (language).
* Diagnostics and linting are powered by [`ace-linters`](https://github.com/mkslanc/ace-linters).

---

## 💡 Contributing

Pull requests, forks, and suggestions are welcome!
If you add support for more languages, improve connection handling, or fix bugs, feel free to share your work.

---

## 💖 Donate

If you like this plugin and want to support development, you can donate using crypto:  

[Donate here](https://cwallet.com/t/TE6A6KMV)

---

## 🌐 Links

- [GitHub Repository](https://github.com/jobians/websocket-lsp-bridge)
- [Report an Issue](https://github.com/jobians/websocket-lsp-bridge/issues)

---

## 📜 License

MIT License © 2025 [JOBIANSTECHIE](https://github.com/jobians)