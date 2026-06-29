const urlModule = acode.require('Url');

export function normalizePath(path, includeFilePrefix = false) {
  let normalized = urlModule.pathname(path) || '';
  normalized = normalized.replace(/^\/+/, '/');
  if (includeFilePrefix) {
    normalized = `file://${normalized}`;
  }
  return normalized;
}

export const DEFAULT_SERVER_OPTIONS = [
  {
    type: 'socket',
    serviceName: 'ts-lsp',
    modes: 'javascript | jsx | typescript | tsx',
    label: 'TypeScript (JS, TS, JSX, TSX)',
    socketUrl:
      'ws://localhost:3030/ts-{workspace}?args=typescript-language-server,--stdio&type=stdio',
  },
  {
    type: 'socket',
    serviceName: 'deno-lsp',
    modes: 'typescript | tsx',
    label: 'Deno (JSX, TSX)',
    socketUrl: 'ws://localhost:3030/deno-{workspace}?args=deno,lsp&type=stdio',
  },
  {
    type: 'socket',
    serviceName: 'pyright',
    modes: 'python',
    label: 'Python (Pyright)',
    socketUrl:
      'ws://localhost:3030/pyright-{workspace}?args=pyright-langserver,--stdio&type=stdio',
  },
  {
    type: 'socket',
    serviceName: 'php-lsp',
    modes: 'php',
    label: 'PHP (Intelephense)',
    socketUrl:
      'ws://localhost:3030/php-{workspace}?args=intelephense,--stdio&type=stdio',
  },
  {
    type: 'socket',
    serviceName: 'rust-lsp',
    modes: 'rust',
    label: 'Rust (rust-analyzer)',
    socketUrl:
      'ws://localhost:3030/rust-{workspace}?args=rust-analyzer&type=stdio',
  },
];
