# 🧩 ws-lsp-bridge

A lightweight **WebSocket → Language Server Protocol (LSP) bridge** for editors and IDEs.  
It allows **web-based editors** or **remote clients** to connect to any LSP server over WebSocket — perfect for environments like [Acode](https://acode.app/) or browser-based IDEs.

---

## ✨ Features

- 🔌 **Spawn any LSP server** (`stdio` or `ipc`) and expose it via WebSocket  
- 🌐 **Bridge** messages between web editors and LSP servers in real time  
- 🧠 **Multi-endpoint** support (each LSP runs on its own WebSocket path)  
- ⚡ **Lightweight & dependency-free** — only uses `ws` and `vscode-jsonrpc`  
- 🪶 Ideal for browser-based editors, cloud IDEs, or mobile code editors  

---

## 📦 Installation

Install globally via npm:

```bash
npm install -g ws-lsp-bridge
````

Or run directly with `npx`:

```bash
npx ws-lsp-bridge
```

---

## 🚀 Usage

Start the WebSocket LSP bridge:

```bash
wslsp
```

By default, the server listens on **port 3030**.

Then connect your editor to a WebSocket endpoint, specifying which LSP server to launch via query parameters.

Example (TypeScript LSP):

```
ws://localhost:3030/typescript?args=typescript-language-server,--stdio&type=stdio
```

This command launches `typescript-language-server --stdio` and bridges its LSP messages over WebSocket.

---

## ⚙️ CLI Options

```bash
wslsp [options]

Options:
  --port, -p <number>   Port for WebSocket server (default: 3030)
  --help, -h            Show this help
```

You can also set the port via environment variable:

```bash
wslsp --port 4040
```

---

## 🧠 How It Works

1. The bridge starts a **WebSocket server** on the specified port.
2. Each connection URL defines which **LSP server** to spawn via query parameters.
3. The bridge then **pipes LSP JSON-RPC messages** between:

   * **Editor/WebSocket client → LSP stdin**
   * **LSP stdout → Editor/WebSocket client**

```text
Editor ----(WebSocket JSON-RPC)----> ws-lsp-bridge ----(stdio)----> LSP Server
```

This enables web-based or remote editors to use any LSP server — even if they can’t use `stdio` or `ipc` directly.

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