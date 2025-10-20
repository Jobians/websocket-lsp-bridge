#!/usr/bin/env node
import {
  StreamMessageReader,
  StreamMessageWriter,
  IPCMessageReader,
  IPCMessageWriter
} from 'vscode-jsonrpc';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';

const { port } = parseCliOptions();
const wss = new WebSocketServer({ port });
console.log(`🔌 LSP bridge running at ws://localhost:${port}`);

wss.on('connection', (ws, req) => {
  const url = new URL(`http://${req.headers.host}${req.url}`);
  const endpoint = url.pathname.slice(1);
  const params = Object.fromEntries(url.searchParams.entries());

  console.log(`⚙️  New connection: ${endpoint}`, params);

  try {
    const args = parseArgs(params.args);
    if (args.length === 0) throw new Error('Missing ?args= parameter');

    const command = args.shift();
    const type = params.type || 'stdio';
    const root = params.root || process.cwd();

    const { processHandle, reader, writer } = startLanguageServer(
      command,
      args,
      type,
      endpoint,
      root,
      ws
    );

    // LSP → WebSocket
    reader.listen((message) => {
      ws.send(JSON.stringify(message));
    });

    // WebSocket → LSP
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (!writer.stream?.destroyed) writer.write(msg);

        console.log(`➡️  [${endpoint}] From WebSocket → LSP:\n`, msg);
      } catch (err) {
        console.error(`❌ Invalid message from ${endpoint}:`, err);
      }
    });

    ws.on('close', () => {
      console.log(`🔌 ${endpoint} WebSocket closed`);
      if (processHandle && !processHandle.killed) processHandle.kill();
    });
  } catch (err) {
    console.error(`❌ Failed to handle ${endpoint}:`, err);
    ws.send(JSON.stringify({ error: err.message }));
    ws.close();
  }
});

// --- Helpers ---
function parseCliOptions() {
  const cliArgs = process.argv.slice(2);

  // Show help and exit
  if (cliArgs.includes('--help') || cliArgs.includes('-h')) {
    console.log(`
ws-lsp-bridge CLI

Usage:
  wslsp [options]

Options:
  --port, -p <number>       Port for WebSocket server (default: 3030)
  --help, -h                Show this help
`);
    process.exit(0);
  }

  // Parse port argument
  const portIndex = cliArgs.findIndex((arg) => ['--port', '-p'].includes(arg));
  const port = portIndex >= 0 ? Number(cliArgs[portIndex + 1]) : Number(process.env.PORT) || 3030;

  return { port };
}

function parseArgs(str = '') {
  return str
    .split(/[\s,]+/)
    .map((a) => a.trim())
    .filter(Boolean);
}

function startLanguageServer(command, args, type, endpoint, cwd, ws) {
  console.log(`🚀 Starting ${endpoint} server: ${command} ${args.join(' ')} (${type})`);

  const opts = { cwd, env: process.env };
  if (type === 'ipc') opts.stdio = ['pipe', 'pipe', 'pipe', 'ipc'];

  const processHandle = spawn(command, args, opts);

  const reader =
    type === 'ipc'
      ? new IPCMessageReader(processHandle)
      : new StreamMessageReader(processHandle.stdout);

  const writer =
    type === 'ipc'
      ? new IPCMessageWriter(processHandle)
      : new StreamMessageWriter(processHandle.stdin);

  processHandle.stderr.on('data', (data) => console.error(`[${endpoint}] stderr: ${data}`));

  processHandle.on('error', (err) => {
    console.error(`[${endpoint}] failed to start:`, err);

    if (ws && ws.readyState === ws.OPEN) {
      ws.close(1011, `Failed to start ${endpoint}: ${err.message}`);
    }
  });

  processHandle.on('exit', (code) => console.log(`[${endpoint}] exited with code ${code}`));

  return { processHandle, reader, writer };
}