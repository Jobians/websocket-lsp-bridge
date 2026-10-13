// LSP Content-Length message framing.
//
// The LSP wire format is:
//   Content-Length: <n>\r\n
//   \r\n
//   <n bytes of JSON>
//
// This module provides:
//  - `encode` – wrap a JSON string in the LSP header
//  - `LspDecoder` – stateful decoder that buffers bytes and yields complete messages

/// Wrap a JSON payload in an LSP `Content-Length` header.
pub fn encode(json: &str) -> String {
    format!("Content-Length: {}\r\n\r\n{}", json.len(), json)
}

/// Stateful decoder for the LSP wire format.
///
/// Feed raw bytes with `feed()`; call `next_message()` to drain complete
/// messages one at a time.
#[derive(Default)]
pub struct LspDecoder {
    buf: Vec<u8>,
}

impl LspDecoder {
    pub fn new() -> Self {
        Self::default()
    }

    /// Append bytes received from the LSP process stdout.
    pub fn feed(&mut self, data: &[u8]) {
        self.buf.extend_from_slice(data);
    }

    /// Try to extract the next complete JSON message from the buffer.
    ///
    /// Returns `None` when there isn't enough data yet.
    /// Returns `Some(Err(...))` on a malformed header.
    pub fn next_message(&mut self) -> Option<Result<String, String>> {
        // Find the header/body separator: \r\n\r\n
        let sep = b"\r\n\r\n";
        let sep_pos = self.buf.windows(4).position(|w| w == sep)?;

        // Parse `Content-Length: <n>` from the header block
        let header = std::str::from_utf8(&self.buf[..sep_pos]).ok()?;
        let content_length: usize = header
            .lines()
            .find(|l| l.to_ascii_lowercase().starts_with("content-length:"))?
            .split(':')
            .nth(1)?
            .trim()
            .parse()
            .ok()?;

        let body_start = sep_pos + sep.len();
        let body_end = body_start + content_length;

        if self.buf.len() < body_end {
            // Haven't received the full body yet
            return None;
        }

        let body = std::str::from_utf8(&self.buf[body_start..body_end])
            .map(|s| s.to_owned())
            .map_err(|e| e.to_string());

        // Consume exactly header + sep + body from the buffer
        self.buf.drain(..body_end);

        Some(body)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_produces_correct_header() {
        let payload = r#"{"jsonrpc":"2.0","method":"initialize"}"#;
        let encoded = encode(payload);
        assert!(encoded.starts_with("Content-Length: 39\r\n\r\n"));
        assert!(encoded.ends_with(payload));
    }

    #[test]
    fn decode_single_message() {
        let payload = r#"{"jsonrpc":"2.0","id":1,"result":{}}"#;
        let raw = encode(payload);
        let mut dec = LspDecoder::new();
        dec.feed(raw.as_bytes());
        let msg = dec.next_message().expect("should have a message");
        assert_eq!(msg.unwrap(), payload);
        // Buffer should be empty after consuming
        assert!(dec.next_message().is_none());
    }

    #[test]
    fn decode_two_messages_in_one_feed() {
        let p1 = r#"{"jsonrpc":"2.0","id":1}"#;
        let p2 = r#"{"jsonrpc":"2.0","id":2}"#;
        let mut dec = LspDecoder::new();
        dec.feed(encode(p1).as_bytes());
        dec.feed(encode(p2).as_bytes());
        assert_eq!(dec.next_message().unwrap().unwrap(), p1);
        assert_eq!(dec.next_message().unwrap().unwrap(), p2);
        assert!(dec.next_message().is_none());
    }

    #[test]
    fn decode_partial_then_complete() {
        let payload = r#"{"jsonrpc":"2.0","id":3,"result":null}"#;
        let raw = encode(payload);
        let mid = raw.len() / 2;
        let mut dec = LspDecoder::new();
        // Feed first half – should get nothing
        dec.feed(&raw.as_bytes()[..mid]);
        assert!(dec.next_message().is_none());
        // Feed second half – now we should get the message
        dec.feed(&raw.as_bytes()[mid..]);
        assert_eq!(dec.next_message().unwrap().unwrap(), payload);
    }

    #[test]
    fn encode_decode_roundtrip() {
        let payload = r#"{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{}}"#;
        let mut dec = LspDecoder::new();
        dec.feed(encode(payload).as_bytes());
        assert_eq!(dec.next_message().unwrap().unwrap(), payload);
    }
}
