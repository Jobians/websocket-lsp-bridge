pub mod bridge;
pub mod codec;
pub mod ipc;

use clap::Parser;

/// WebSocket bridge to connect any editor/client to LSP servers.
///
/// Connect your editor to ws://localhost:<PORT>/<name>?args=<lsp-cmd>,<arg1>&type=stdio|ipc&root=/path
#[derive(Parser, Debug, Clone, PartialEq, Eq)]
#[command(name = "wslsp", version, about)]
pub struct Cli {
    /// Port for the WebSocket server
    #[arg(short, long, default_value = "3030", env = "PORT")]
    pub port: u16,
}
