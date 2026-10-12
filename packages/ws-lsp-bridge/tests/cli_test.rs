use clap::Parser;
use wslsp::Cli;

#[test]
fn test_cli_default_port() {
    let cli = Cli::try_parse_from(["wslsp"]).expect("should parse default args");
    assert_eq!(cli.port, 3030);
}

#[test]
fn test_cli_short_port_flag() {
    let cli = Cli::try_parse_from(["wslsp", "-p", "4040"]).expect("should parse -p");
    assert_eq!(cli.port, 4040);
}

#[test]
fn test_cli_long_port_flag() {
    let cli = Cli::try_parse_from(["wslsp", "--port", "5050"]).expect("should parse --port");
    assert_eq!(cli.port, 5050);
}

#[test]
fn test_cli_invalid_port_fails() {
    let result = Cli::try_parse_from(["wslsp", "--port", "invalid_port"]);
    assert!(result.is_err());
}
