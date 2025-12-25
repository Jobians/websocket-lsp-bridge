import plugin from '../plugin.json';
const page = acode.require('page');
const alert = acode.require('alert');
const urlModule = acode.require('Url');
const settings = acode.require('settings');
const openfolder = acode.require('openfolder');
const actionStack = acode.require('actionStack');
const multiPrompt = acode.require('multiPrompt');

import { LanguageClient } from './ace-linters/src/services/language-client';
import { AceLanguageClient } from './ace-linters/src/ace-language-client';

const DEFAULT_SERVER_OPTIONS = [
  {
    type: 'socket',
    serviceName: 'ts-lsp',
    modes: 'javascript | jsx | typescript | tsx',
    label: 'TypeScript (JS, TS, JSX, TSX)',
    socketUrl:
      'ws://localhost:3030/ts-{workspace}?args=typescript-language-server,--stdio&type=stdio'
  },
  {
    type: 'socket',
    serviceName: 'deno-lsp',
    modes: 'typescript | tsx',
    label: 'Deno (JSX, TSX)',
    socketUrl: 'ws://localhost:3030/deno-{workspace}?args=deno,lsp&type=stdio'
  },
  {
    type: 'socket',
    serviceName: 'pyright',
    modes: 'python',
    label: 'Python (Pyright)',
    socketUrl: 'ws://localhost:3030/pyright-{workspace}?args=pyright-langserver,--stdio&type=stdio'
  },
  {
    type: 'socket',
    serviceName: 'php-lsp',
    modes: 'php',
    label: 'PHP (Intelephense)',
    socketUrl: 'ws://localhost:3030/php-{workspace}?args=intelephense,--stdio&type=stdio'
  },
  {
    type: 'socket',
    serviceName: 'rust-lsp',
    modes: 'rust',
    label: 'Rust (rust-analyzer)',
    socketUrl: 'ws://localhost:3030/rust-{workspace}?args=rust-analyzer&type=stdio'
  }
];

function normalizePath(path, includeFilePrefix = false) {
  let normalized = urlModule.pathname(path) || '';

  // Reduce multiple leading slashes to a single slash
  normalized = normalized.replace(/^\/+/, '/');

  if (includeFilePrefix) {
    normalized = `file://${normalized}`;
  }

  return normalized;
}

function createServerCard(server, index, onEdit, onDelete) {
  const row = tag('div', {
    className: 'server-card',
    style: `
      border:1px solid #888;
      border-radius:6px;
      padding:8px;
      display:flex;
      justify-content:space-between;
      align-items:center;
    `
  });
  const label = tag('div', {
    textContent: `${server.label} (${server.serviceName})`,
    style: 'flex:1;'
  });
  const btnGroup = tag('div', { style: 'display:flex; gap:6px;' });

  const editBtn = tag('span', { className: 'icon edit', title: 'Edit' });
  editBtn.onclick = () => onEdit(index);

  const deleteBtn = tag('span', { className: 'icon delete_outline', title: 'Delete' });
  deleteBtn.onclick = () => onDelete(index);

  btnGroup.append(editBtn, deleteBtn);
  row.append(label, btnGroup);
  return row;
}

class WorkspaceStorage {
  constructor(storageKey) {
    this.storageKey = storageKey;
  }

  save(path, serverNames, metadata) {
    const allWorkspaces = this.load();
    allWorkspaces[path] = {
      serverServiceNames: serverNames,
      workspaceMetadata: metadata
    };
    localStorage.setItem(this.storageKey, JSON.stringify(allWorkspaces));
  }

  load() {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey) || '{}');
    } catch {
      return {};
    }
  }

  clear() {
    localStorage.removeItem(this.storageKey);
  }
}

class LSPClient {
  debug = true;
  activeServers = {};
  serverOptions = [];

  constructor() {
    const pluginSettings = settings.value[plugin.id] || {};

    if (!Array.isArray(pluginSettings.serverOptions) || !pluginSettings.serverOptions.length) {
      pluginSettings.serverOptions = [...DEFAULT_SERVER_OPTIONS];
      settings.value[plugin.id] = pluginSettings;
      settings.update();
      this.log('Plugin settings initialized or defaults restored.');
    } else {
      this.log('Plugin settings loaded from storage.');
    }

    this.serverOptions = pluginSettings.serverOptions;
    this.workspaceStorage = new WorkspaceStorage(`${plugin.id}_workspaces`);

    this.log('Loaded', this.serverOptions.length, 'server options');
  }

  log(...args) {
    if (!this.debug) return;
    setTimeout(() => console.log('[LSP][DEBUG]', ...args), 200);
  }

  showAlert(message) {
    alert('LSP Client', message);
  }

  showToast(...messages) {
    window.toast(messages.filter(Boolean).join(' '));
  }

  saveServerOptions() {
    settings.value[plugin.id].serverOptions = this.serverOptions;
    settings.update();
    this.log('Server options saved:', this.serverOptions);
  }

  checkServiceNameUnique(serviceName, excludeIndex = -1) {
    if (
      this.serverOptions.some((s, idx) => s.serviceName === serviceName && idx !== excludeIndex)
    ) {
      this.showAlert(`Service Name "${serviceName}" already exists. Please choose a unique name.`);
      return false;
    }
    return true;
  }

  saveWorkspace(workspacePath, selectedServers, workspaceMetadata) {
    if (!Array.isArray(selectedServers)) selectedServers = [selectedServers];
    const serviceNames = selectedServers.map((s) => (typeof s === 'string' ? s : s.serviceName));

    this.workspaceStorage.save(workspacePath, serviceNames, workspaceMetadata);
    this.log(`Workspace saved: ${workspacePath} (Servers: ${serviceNames.join(', ')})`);
  }

  loadAllWorkspaces() {
    return this.workspaceStorage.load();
  }

  clearAllWorkspaces() {
    this.workspaceStorage.clear();
    this.log('All workspaces cleared');
  }

  async restoreAllOpenWorkspaces() {
    try {
      const savedWorkspaces = this.loadAllWorkspaces();
      this.log('Restoring saved workspaces:', savedWorkspaces);

      if (!Object.keys(savedWorkspaces).length) return;
      const openFolders = JSON.parse(localStorage.getItem('folders') || '[]');

      for (const [workspacePath, { serverServiceNames, workspaceMetadata }] of Object.entries(
        savedWorkspaces
      )) {
        const folderIsOpen = openFolders.some((f) =>
          normalizePath(f.url, true).includes(workspacePath)
        );
        if (!folderIsOpen) continue;

        for (const serverName of serverServiceNames) {
          if (this.activeServers[workspacePath]?.[serverName]) continue;

          const serverOption = this.serverOptions.find((s) => s.serviceName === serverName);
          if (!serverOption) continue;

          this.createLSPServer(workspacePath, serverOption, workspaceMetadata);
        }

        this.registerEditorIfReady();
        this.showToast(`Workspace restored: ${workspacePath}`);
      }

      this.log('Finished restoring all workspaces.');
    } catch (err) {
      this.log('Error restoring workspaces:', err);
    }
  }

  getActiveFolderPath() {
    const fileUri = editorManager.activeFile?.uri;
    const folder = fileUri && openfolder.find(fileUri);
    if (!folder?.url) return null;
    return normalizePath(folder.url, true);
  }

  getCurrentFilePath() {
    const fileUri = editorManager.activeFile?.uri;
    const folder = fileUri && openfolder.find(fileUri);
    if (!folder?.url) return fileUri;
    return fileUri.replace(folder.url, '').replace(/^\/+/, '');
  }

  registerEditorIfReady() {
    const workspacePath = this.getActiveFolderPath();
    const clients = this.activeServers[workspacePath];
    if (!clients) {
      this.log(`No clients found for workspace: ${workspacePath}`);
      return;
    }

    Object.entries(clients).forEach(([name, lspClient]) => {
      lspClient.registerEditor(editorManager.editor, {
        filePath: this.getCurrentFilePath(),
        joinWorkspaceURI: true
      });
      this.log(`Editor registered for client: ${name}`);
    });

    this.log(`Editor attached to workspace: ${workspacePath}`);
  }

  createLSPServer(workspacePath, serverOption, workspaceMetadata) {
    if (!workspacePath) return null;

    const providedName = workspaceMetadata?.name || '';
    let normalizedWorkspaceName = providedName
      .trim()
      .replace(/\s+/g, '-') // convert spaces to dashes
      .replace(/[^a-zA-Z0-9-_]/g, '') // remove invalid characters
      .replace(/-+/g, '-') // collapse multiple consecutive dashes
      .toLowerCase();

    // Fallback if normalization produces an empty string
    if (!normalizedWorkspaceName) normalizedWorkspaceName = 'workspace';

    const socketUrl = serverOption.socketUrl.replace('{workspace}', normalizedWorkspaceName);
    this.log(`Starting LSP server "${serverOption.serviceName}" for workspace: ${workspacePath}`);
    this.log(`Socket URL: ${socketUrl}`);

    const socket = new WebSocket(socketUrl);
    socket.onclose = (event) => {
      if (!event.wasClean) {
        this.showAlert(`LSP server "${serverOption.serviceName}" closed unexpectedly.`);
      }
    };

    const serverConfig = {
      ...serverOption,
      rootUri: workspacePath,
      socket,
      module: () => ({ LanguageClient })
    };

    const lspClient = AceLanguageClient.for(serverConfig, {
      workspacePath,
      manualSessionControl: true,
      functionality: { signatureHelp: false }
    });

    // Register multiple servers per workspace
    if (!this.activeServers[workspacePath]) this.activeServers[workspacePath] = {};
    this.activeServers[workspacePath][serverOption.serviceName] = lspClient;

    this.log(`Server registered for workspace: ${workspacePath} (${serverOption.serviceName})`);
    return lspClient;
  }

  destroy() {
    this.clearAllWorkspaces();

    if (settings.value[plugin.id]) {
      delete settings.value[plugin.id];
      settings.update();
    }

    this.log('Destroying all active LSP servers...');
    Object.entries(this.activeServers).forEach(([workspace, clients]) => {
      Object.values(clients).forEach((client) => {
        try {
          client.closeConnection();
          this.log(`Closed LSP client for workspace: ${workspace}`);
        } catch (error) {
          this.log(`Failed to close LSP client for workspace: ${workspace} — ${error}`);
        }
      });
    });

    this.activeServers = {};
    this.log('All LSP servers shut down.');
  }

  async promptWorkspaceSetup(defaultPath) {
    const defaultName = defaultPath.split('/').pop() || defaultPath;
    const activeServers = this.activeServers[defaultPath]
      ? Object.keys(this.activeServers[defaultPath])
      : [];

    return multiPrompt('Workspace Info', [
      {
        type: 'text',
        id: 'name',
        value: defaultName,
        placeholder: 'Workspace name',
        required: true
      },
      {
        type: 'text',
        id: 'path',
        value: defaultPath,
        placeholder: 'Workspace path',
        required: true
      },
      ...this.serverOptions.map((s) => {
        const isActive = activeServers.includes(s.serviceName);
        return {
          type: 'checkbox',
          id: s.serviceName,
          placeholder: s.label,
          value: isActive,
          isActive
        };
      })
    ]);
  }

  async init() {
    this.log('Initializing LSP Plugin...');
    await this.restoreAllOpenWorkspaces();

    editorManager.editor.on('changeSession', () => this.registerEditorIfReady());

    editorManager.editor.commands.addCommand({
      name: 'LSP Settings',
      exec: async () => this.openSettingsPage()
    });

    editorManager.editor.commands.addCommand({
      name: 'LSP Init',
      bindKey: { win: 'Ctrl-L', mac: 'Cmd-L' },
      exec: async () => {
        this.log('LSP Init command triggered');
        const workspacePath = this.getActiveFolderPath();
        if (!workspacePath) return this.showAlert('Open a folder first.');

        const workspaceInput = await this.promptWorkspaceSetup(workspacePath).catch(() => null);
        if (!workspaceInput) return this.log('Workspace setup was cancelled.');
        this.log('Workspace input from multiPrompt:', workspaceInput);

        // Collect all selected servers
        const selectedServers = this.serverOptions.filter((s) => workspaceInput[s.serviceName]);
        if (!selectedServers.length)
          return this.showAlert('Please select at least one language server.');

        // Check for mode conflicts
        const usedModes = new Set();
        for (const server of selectedServers) {
          const modes = server.modes
            .split(/[\|,]/)
            .map((m) => m.trim().toLowerCase())
            .filter(Boolean);
          for (const mode of modes) {
            if (usedModes.has(mode)) {
              return this.showAlert(
                `Conflict detected: Multiple LSPs selected for mode "${mode}". Please select only one server per mode.`
              );
            }
            usedModes.add(mode);
          }
        }

        const initializedServers = selectedServers
          .map((server) => {
            const client = this.createLSPServer(workspacePath, server, workspaceInput);
            this.log(`Initializing server "${server.serviceName}":`, client ? 'Success' : 'Failed');
            return client ? server : null;
          })
          .filter(Boolean);

        if (!initializedServers.length) {
          return this.showAlert('No LSP servers could be started for this workspace.');
        }

        const selectedServiceNames = initializedServers.map((s) => s.serviceName);
        this.saveWorkspace(workspacePath, selectedServiceNames, workspaceInput);

        this.registerEditorIfReady();
        this.showToast(
          `${initializedServers.map((s) => s.label).join(', ')} initialized for ${workspacePath}`
        );
      }
    });
  }

  openSettingsPage() {
    const backButton = tag('span', {
      className: 'icon arrow_back',
      dataset: { action: 'back-btn' },
      onclick: () => settingsPage.hide()
    });
    const addButton = tag('span', { className: 'icon add_circle', dataset: { action: 'add-btn' } });
    const settingsPage = page('LSP Settings', { lead: backButton, tail: addButton });

    const settingsForm = tag('div', {
      style:
        'padding:8px; display:flex; flex-direction:column; gap:12px; max-height:80vh; overflow:auto;'
    });

    const getServerPromptFields = (server = {}) => [
      {
        type: 'text',
        id: 'label',
        placeholder: 'Label',
        value: server.label || '',
        required: true
      },
      {
        type: 'text',
        id: 'serviceName',
        placeholder: 'Service Name',
        value: server.serviceName || '',
        required: true
      },
      {
        type: 'text',
        id: 'modes',
        placeholder: 'Modes (pipe separated)',
        value: server.modes || ''
      },
      {
        type: 'text',
        id: 'socketUrl',
        placeholder: 'Socket URL',
        value: server.socketUrl || '',
        required: true
      }
    ];

    const renderServers = () => {
      settingsForm.innerHTML = '';
      // Server options heading
      settingsForm.append(tag('h3', { textContent: 'Server Options', style: 'margin:0 0 8px 0;' }));

      // Server cards
      this.serverOptions.forEach((s, index) => {
        const card = createServerCard(
          s,
          index,
          async (i) => {
            const result = await multiPrompt(
              'Edit Server',
              getServerPromptFields(this.serverOptions[i])
            ).catch(() => null);
            if (!result) return;

            if (!this.checkServiceNameUnique(result.serviceName, i)) return;

            this.serverOptions[i] = { ...this.serverOptions[i], ...result, type: 'socket' };
            this.saveServerOptions();
            renderServers();
            this.showToast('Server updated');
          },
          (i) => {
            this.serverOptions.splice(i, 1);
            this.saveServerOptions();
            renderServers();
            this.showToast('Server deleted');
          }
        );
        settingsForm.append(card);
      });

      // Saved Workspaces
      settingsForm.append(
        tag('h3', { textContent: 'Saved Workspaces', style: 'margin-top:16px;margin-bottom:8px;' })
      );
      Object.entries(this.loadAllWorkspaces()).forEach(([path, data]) => {
        if (!data) return;
        const servers = Array.isArray(data.serverServiceNames)
          ? data.serverServiceNames.join(', ')
          : data.serverServiceNames;

        const row = tag('div', {
          style:
            'border:1px dashed #aaa; border-radius:4px; padding:6px; display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;'
        });

        const text = tag('span', { textContent: `${path} (${servers})` });
        const deleteBtn = tag('span', { className: 'icon delete_outline', title: 'Delete' });
        deleteBtn.onclick = () => {
          const all = this.loadAllWorkspaces();
          delete all[path];
          localStorage.setItem(this.workspaceStorage.storageKey, JSON.stringify(all));
          row.remove();
          this.showToast(`Workspace deleted: ${path}`);
          this.log('Workspace deleted from settings:', path);
        };

        row.append(text, deleteBtn);
        settingsForm.append(row);
      });
    };

    renderServers();

    addButton.onclick = async () => {
      const result = await multiPrompt('Add Server', getServerPromptFields()).catch(() => null);
      if (!result) return;

      if (!this.checkServiceNameUnique(result.serviceName)) return;

      this.serverOptions.push({ ...result, type: 'socket' });
      this.saveServerOptions();
      renderServers();
      this.showToast('Server added');
    };

    settingsPage.appendBody(settingsForm);
    settingsPage.show = () => {
      actionStack.push({ id: plugin.id, action: settingsPage.hide });
      app.append(settingsPage);
    };
    settingsPage.show();
  }
}

if (window.acode) {
  const languageServerClient = new LSPClient();

  acode.setPluginInit(plugin.id, async () => await languageServerClient.init(), {
    list: [{ key: 'openSettings', text: 'Open LSP Settings' }],
    cb: async (actionKey) => {
      if (actionKey === 'openSettings') languageServerClient.openSettingsPage();
    }
  });

  acode.setPluginUnmount(plugin.id, () => languageServerClient.destroy());
}