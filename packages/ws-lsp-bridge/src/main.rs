// wslsp — WebSocket → LSP bridge
//
// Starts a WebSocket server and bridges each connection to an LSP child
// process. See bridge.rs for the per-connection logic.

mod bridge;
mod codec;
mod ipc;

use clap::Parser;
use tokio::net::TcpListener;
use tracing::{error, info};

/// WebSocket bridge to connect any editor/client to LSP servers.
///
/// Connect your editor to ws://localhost:<PORT>/<name>?args=<lsp-cmd>,<arg1>&type=stdio|ipc&root=/path
#[derive(Parser)]
#[command(name = "wslsp", version, about)]
struct Cli {
    /// Port for the WebSocket server
    #[arg(short, long, default_value = "3030", env = "PORT")]
    port: u16,
}

#[tokio::main]
async fn main() {
    // Default log level: info. Override with RUST_LOG=debug etc.
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let cli = Cli::parse();
    let addr = format!("0.0.0.0:{}", cli.port);

    let listener = TcpListener::bind(&addr).await.unwrap_or_else(|e| {
        error!("Failed to bind to {addr}: {e}");
        std::process::exit(1);
    });

    info!("🔌 LSP bridge running at ws://localhost:{}", cli.port);

    loop {
        match listener.accept().await {
            Ok((stream, peer)) => {
                info!("TCP connection from {peer}");

                // Grab the HTTP upgrade request path/host before the handshake
                // so we can reconstruct the full URL for query-param parsing.
                let peer_str = peer.to_string();

                tokio::spawn(async move {
                    // Perform the WebSocket handshake
                    let mut request_url: Option<String> = None;

                    let ws_stream = accept_async_with_url(stream, &mut request_url).await;

                    match ws_stream {
                        Ok(ws) => {
                            let url = request_url.unwrap_or_default();
                            bridge::handle(ws, url).await;
                        }
                        Err(e) => {
                            error!("WebSocket handshake failed from {peer_str}: {e}");
                        }
                    }
                });
            }
            Err(e) => {
                error!("Accept error: {e}");
            }
        }
    }
}

/// Perform the WS handshake while capturing the request URL for query parsing.
// tungstenite::Error is 136 bytes — unavoidable since it's a library type.
#[allow(clippy::result_large_err)]
async fn accept_async_with_url(
    stream: tokio::net::TcpStream,
    url_out: &mut Option<String>,
) -> Result<
    tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
    tokio_tungstenite::tungstenite::Error,
> {
    use tokio_tungstenite::tungstenite::handshake::server::{Request, Response};

    let callback = |req: &Request,
                    resp: Response|
     -> Result<
        Response,
        tokio_tungstenite::tungstenite::http::Response<Option<String>>,
    > {
        // Reconstruct full URL from Host header + request path
        let host = req
            .headers()
            .get("host")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("localhost");
        let path = req.uri().to_string();
        *url_out = Some(format!("ws://{host}{path}"));
        Ok(resp)
    };

    tokio_tungstenite::accept_hdr_async(stream, callback).await
}
