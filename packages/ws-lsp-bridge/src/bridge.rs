// Handles one WebSocket connection:
//  1. Parses query params from the URL (?args=...&type=...&root=...)
//  2. Spawns the LSP process (stdio or ipc)
//  3. Pipes messages in both directions until the socket closes

use std::process::Stdio;

use futures_util::{SinkExt, StreamExt};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    process::Command,
    sync::oneshot,
};
use tokio_tungstenite::tungstenite::Message;
use tracing::{error, info, warn};
use url::Url;

use crate::codec::{encode, LspDecoder};
use crate::ipc;

/// Entry point for a new WebSocket connection.
///
/// `raw_url` is the full request URL (including host so `Url` can parse it).
pub async fn handle(
    ws_stream: tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
    raw_url: String,
) {
    // Parse the URL to extract path and query params
    let url = match Url::parse(&raw_url) {
        Ok(u) => u,
        Err(e) => {
            error!("Bad URL {raw_url}: {e}");
            return;
        }
    };

    let endpoint = url.path().trim_start_matches('/').to_owned();
    let params: std::collections::HashMap<String, String> =
        url.query_pairs().into_owned().collect();

    info!("New connection: /{endpoint} params={params:?}");

    // Parse `?args=cmd,arg1,arg2`
    let args_str = params.get("args").map(|s| s.as_str()).unwrap_or("");
    let mut args = parse_args(args_str);

    if args.is_empty() {
        send_error_and_close(ws_stream, "Missing ?args= parameter").await;
        return;
    }

    let command = args.remove(0);
    let conn_type = params.get("type").map(|s| s.as_str()).unwrap_or("stdio");
    let cwd = params.get("root").cloned().unwrap_or_else(|| {
        std::env::current_dir()
            .unwrap_or_default()
            .display()
            .to_string()
    });

    info!("Starting {endpoint}: {command} {args:?} (type={conn_type}, cwd={cwd})");

    // Spawn the LSP child process
    let child_result = if conn_type == "ipc" {
        ipc::spawn_ipc(&command, &args, &cwd)
    } else {
        // stdio (default)
        Command::new(&command)
            .args(&args)
            .current_dir(&cwd)
            .envs(std::env::vars())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
    };

    let mut child = match child_result {
        Ok(c) => c,
        Err(e) => {
            error!("[{endpoint}] failed to start: {e}");
            send_error_and_close(ws_stream, &format!("Failed to start {endpoint}: {e}")).await;
            return;
        }
    };

    let mut lsp_stdin = child.stdin.take().expect("stdin piped");
    let mut lsp_stdout = child.stdout.take().expect("stdout piped");
    let mut lsp_stderr = child.stderr.take().expect("stderr piped");

    // Channel to signal the LSP-stdout reader to stop when the WS closes
    let (stop_tx, mut stop_rx) = oneshot::channel::<()>();

    let (mut ws_tx, mut ws_rx) = ws_stream.split();

    let endpoint_clone = endpoint.clone();

    // Task: LSP stdout → WebSocket
    let lsp_to_ws = tokio::spawn(async move {
        let mut buf = [0u8; 4096];
        let mut decoder = LspDecoder::new();
        loop {
            tokio::select! {
                _ = &mut stop_rx => break,
                n = lsp_stdout.read(&mut buf) => {
                    match n {
                        Ok(0) | Err(_) => break, // LSP closed stdout
                        Ok(n) => {
                            decoder.feed(&buf[..n]);
                            while let Some(msg_result) = decoder.next_message() {
                                match msg_result {
                                    Ok(json) => {
                                        if ws_tx.send(Message::Text(json.into())).await.is_err() {
                                            break;
                                        }
                                    }
                                    Err(e) => error!("[{endpoint_clone}] bad UTF-8 from LSP: {e}"),
                                }
                            }
                        }
                    }
                }
            }
        }
        // Flush any pending close frame; ignore errors
        let _ = ws_tx.close().await;
    });

    // Task: log LSP stderr
    let ep_err = endpoint.clone();
    tokio::spawn(async move {
        let mut buf = [0u8; 1024];
        loop {
            match lsp_stderr.read(&mut buf).await {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let text = String::from_utf8_lossy(&buf[..n]);
                    warn!("[{ep_err}] stderr: {text}");
                }
            }
        }
    });

    // Main loop: WebSocket → LSP stdin
    while let Some(msg) = ws_rx.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                info!("➡ [{endpoint}] WS → LSP: {text}");
                let framed = encode(&text);
                if lsp_stdin.write_all(framed.as_bytes()).await.is_err() {
                    break;
                }
            }
            Ok(Message::Binary(bytes)) => {
                // Some clients send binary; try to treat as UTF-8 JSON
                if let Ok(text) = std::str::from_utf8(&bytes) {
                    let framed = encode(text);
                    if lsp_stdin.write_all(framed.as_bytes()).await.is_err() {
                        break;
                    }
                } else {
                    warn!("[{endpoint}] received non-UTF-8 binary frame, ignoring");
                }
            }
            Ok(Message::Close(_)) | Err(_) => break,
            _ => {} // Ping/Pong handled by tungstenite automatically
        }
    }

    info!("[{endpoint}] WebSocket closed");

    // Signal the LSP-to-WS task to stop and kill the child
    let _ = stop_tx.send(());
    if let Err(e) = child.kill().await {
        // Already exited is fine
        if e.kind() != std::io::ErrorKind::InvalidInput {
            warn!("[{endpoint}] failed to kill LSP: {e}");
        }
    }

    let _ = lsp_to_ws.await;
}

/// Split `"cmd,arg1 arg2"` on commas and/or whitespace, trimming empty parts.
pub fn parse_args(s: &str) -> Vec<String> {
    s.split(|c: char| c == ',' || c.is_whitespace())
        .map(|a| a.trim().to_owned())
        .filter(|a| !a.is_empty())
        .collect()
}

/// Send a JSON error object to the client and close the socket.
async fn send_error_and_close(
    mut ws: tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
    msg: &str,
) {
    let payload = format!(r#"{{"error":{}}}"#, serde_json_str(msg));
    let _ = ws.send(Message::Text(payload.into())).await;
    let _ = ws.close(None).await;
}

/// Minimal JSON string escaping for error messages (no extra dependency needed).
fn serde_json_str(s: &str) -> String {
    let escaped = s.replace('\\', "\\\\").replace('"', "\\\"");
    format!("\"{escaped}\"")
}
