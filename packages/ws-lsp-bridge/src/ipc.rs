// IPC mode support.
//
// Node.js IPC uses a private fd-based channel that isn't portable to Rust.
// Instead, when `type=ipc` is requested, we spawn a small Node.js helper
// script (embedded as a string) that:
//   1. Spawns the target LSP with `--ipc` / `ipc` channel
//   2. Relays JSON messages between child.send/on('message') and its own stdio
//
// The caller then treats this helper exactly like a stdio LSP process.
// If `node` isn't on PATH we return a clear error.

use std::{io, process::Stdio};
use tokio::process::{Child, Command};

/// The embedded Node.js helper. Reads newline-delimited JSON from stdin,
/// sends each object to the child via IPC, and writes each IPC message from
/// the child as newline-delimited JSON to stdout.
///
/// We use newline-delimited JSON here (not LSP framing) because the Rust side
/// will re-encode with Content-Length headers before forwarding to the WS client.
///
/// Note: this script itself communicates with the Rust process over stdio using
/// LSP Content-Length framing so the existing bridge code works without changes.
const IPC_HELPER: &str = r#"#!/usr/bin/env node
// Embedded IPC relay: bridges Node IPC ↔ LSP Content-Length stdio
import { spawn } from 'child_process';
import { StreamMessageReader, StreamMessageWriter, IPCMessageReader, IPCMessageWriter } from 'vscode-jsonrpc/node.js';
import { createMessageConnection } from 'vscode-jsonrpc/node.js';

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) { process.stderr.write('ipc-relay: missing command\n'); process.exit(1); }

const child = spawn(cmd, args, {
  stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  env: process.env,
});

child.stderr.on('data', d => process.stderr.write(d));
child.on('error', e => { process.stderr.write(`ipc-relay child error: ${e.message}\n`); process.exit(1); });
child.on('exit', code => { process.stderr.write(`ipc-relay child exited ${code}\n`); process.exit(code ?? 0); });

// LSP stdio connection to our Rust parent
const parentReader = new StreamMessageReader(process.stdin);
const parentWriter = new StreamMessageWriter(process.stdout);

// IPC connection to the LSP child
const childReader = new IPCMessageReader(child);
const childWriter = new IPCMessageWriter(child);

// Relay: Rust → IPC child
parentReader.listen(msg => { childWriter.write(msg); });

// Relay: IPC child → Rust
childReader.listen(msg => { parentWriter.write(msg); });
"#;

/// Spawn the LSP server in IPC mode using the embedded Node relay.
///
/// Returns the relay `Child` process. Its stdin/stdout are connected with
/// LSP Content-Length framing, just like a normal stdio LSP.
pub fn spawn_ipc(command: &str, args: &[String], cwd: &str) -> io::Result<Child> {
    // Write the helper to a temp file so we can exec it with node
    let helper_path = std::env::temp_dir().join("wslsp_ipc_relay.mjs");
    std::fs::write(&helper_path, IPC_HELPER)?;

    // Check that node is available
    which_node()?;

    let child = Command::new("node")
        .arg(&helper_path)
        .arg(command)
        .args(args)
        .current_dir(cwd)
        .envs(std::env::vars())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    Ok(child)
}

/// Returns an error with a clear message when `node` isn't found.
fn which_node() -> io::Result<()> {
    // `which` may not be available everywhere; just try `node --version`
    let out = std::process::Command::new("node").arg("--version").output();

    match out {
        Ok(o) if o.status.success() => Ok(()),
        _ => Err(io::Error::new(
            io::ErrorKind::NotFound,
            "ipc mode requires Node.js to be installed (node not found on PATH)",
        )),
    }
}
