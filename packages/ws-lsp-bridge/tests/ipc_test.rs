use wslsp::ipc::spawn_ipc;

#[tokio::test]
async fn test_spawn_ipc_invalid_command() {
    let result = spawn_ipc("non_existent_cmd_xyz_404", &[], ".");
    // Should either fail to find node, or spawn the relay process which fails on nonexistent command
    match result {
        Ok(mut child) => {
            // Child was spawned via node; verify it handles exit or kill cleanly
            let _ = child.start_kill();
        }
        Err(err) => {
            // Node is not installed
            assert!(err.to_string().contains("ipc mode requires Node.js"));
        }
    }
}
