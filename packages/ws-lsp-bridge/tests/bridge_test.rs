use futures_util::StreamExt;
use tokio::net::TcpListener;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use wslsp::bridge::{parse_args, serde_json_str};

#[test]
fn test_parse_args_comma_separated() {
    let args = parse_args("typescript-language-server,--stdio");
    assert_eq!(args, vec!["typescript-language-server", "--stdio"]);
}

#[test]
fn test_parse_args_space_separated() {
    let args = parse_args("pyright-langserver --stdio");
    assert_eq!(args, vec!["pyright-langserver", "--stdio"]);
}

#[test]
fn test_parse_args_mixed_and_multiple_delimiters() {
    let args = parse_args("rust-analyzer,  --log-file /tmp/lsp.log\t--verbose");
    assert_eq!(
        args,
        vec!["rust-analyzer", "--log-file", "/tmp/lsp.log", "--verbose"]
    );
}

#[test]
fn test_parse_args_empty_and_whitespace() {
    assert!(parse_args("").is_empty());
    assert!(parse_args("   ").is_empty());
    assert!(parse_args(",,,   ,,").is_empty());
}

#[test]
fn test_serde_json_str_escaping() {
    assert_eq!(serde_json_str("simple text"), "\"simple text\"");
    assert_eq!(
        serde_json_str("quotes: \"hello\""),
        "\"quotes: \\\"hello\\\"\""
    );
    assert_eq!(
        serde_json_str("backslashes: \\path\\to"),
        "\"backslashes: \\\\path\\\\to\""
    );
    assert_eq!(
        serde_json_str("both \"quotes\" and \\slashes\\"),
        "\"both \\\"quotes\\\" and \\\\slashes\\\\\""
    );
}

#[tokio::test]
async fn test_bridge_missing_args_sends_error_and_closes() {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .expect("should bind local port");
    let addr = listener.local_addr().expect("should have local addr");

    tokio::spawn(async move {
        if let Ok((stream, _)) = listener.accept().await {
            if let Ok(ws) = tokio_tungstenite::accept_async(stream).await {
                wslsp::bridge::handle(ws, format!("ws://{addr}/test?type=stdio")).await;
            }
        }
    });

    let (mut client_ws, _) = connect_async(format!("ws://{addr}/test?type=stdio"))
        .await
        .expect("client should connect");

    if let Some(Ok(Message::Text(text))) = client_ws.next().await {
        assert!(
            text.contains("Missing ?args= parameter"),
            "Expected missing args error, got: {text}"
        );
    } else {
        panic!("Expected text message with error response from bridge");
    }
}
