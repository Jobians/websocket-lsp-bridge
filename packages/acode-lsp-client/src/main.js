/// <reference types="acode-plugin-types" />

const lsp = acode.require('lsp');
const alert = acode.require('alert');
const settings = acode.require('settings');
const openfolder = acode.require('openfolder');
const multiPrompt = acode.require('multiPrompt');
const commands = acode.require('commands') || editorManager.editor.commands;

import plugin from '../plugin.json';
import { LanguageClient } from './ace-linters/src/services/language-client';
import { AceLanguageClient } from './ace-linters/src/ace-language-client';
import { normalizePath, DEFAULT_SERVER_OPTIONS } from './constants';
import { WorkspaceStorage, openSettingsPage } from './ui';

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
  
  isCodeMirror() {
    return !!editorManager.isCodeMirror;
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
    if (this.serverOptions.some((s, idx) => s.serviceName === serviceName && idx !== excludeIndex)) {
      this.showAlert(`Service Name "${serviceName}" already exists. Please choose a unique name.`);
      return false;
    }
    return true;
  }
  
  
  saveWorkspace(workspacePath, selectedServers, workspaceMetadata) {
    if (!Array.isArray(selectedServers)) selectedServers = [selectedServers];
    const serviceNames = selectedServers.map((s) =>
      typeof s === 'string' ? s : s.serviceName
    );
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
  

  createLSPServer(workspacePath, serverOption, workspaceMetadata) {
    if (!workspacePath) return null;

    const providedName = workspaceMetadata?.name || '';
    let normalizedWorkspaceName = providedName
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-_]/g, '')
      .replace(/-+/g, '-')
      .toLowerCase();

    if (!normalizedWorkspaceName) normalizedWorkspaceName = 'workspace';

    const socketUrl = serverOption.socketUrl.replace('{workspace}', normalizedWorkspaceName);
    const languages = serverOption.modes
      .split(/[\|,]/)
      .map((m) => m.trim().toLowerCase())
      .filter(Boolean);

    this.log(`Starting LSP server "${serverOption.serviceName}" for workspace: ${workspacePath}`);
    this.log(`Socket URL: ${socketUrl}`);

    let lspClient = null;

    if (this.isCodeMirror()) {
      const serverDef = lsp.defineServer({
        id: serverOption.serviceName,
        label: serverOption.label,
        languages,
        transport: { kind: 'websocket', url: socketUrl },
        rootUri: () => workspacePath,
        documentUri: (uri) => normalizePath(uri, true),
        useWorkspaceFolders: false,
        enabled: true,
      });
      lsp.upsert(serverDef);
      lspClient = serverDef;
      
      // Temporary: not sure why Acode doesn't refresh LSP automatically.
      window.editorManager?.restartLsp?.();
    } else {
      const socket = new WebSocket(socketUrl);
      socket.onclose = (event) => {
        this.log(serverOption.serviceName, event);
        if (!event.wasClean) {
          this.showToast(`LSP server "${serverOption.serviceName}" closed unexpectedly.`);
        }
      };

      lspClient = AceLanguageClient.for(
        { ...serverOption, rootUri: workspacePath, socket, module: () => ({ LanguageClient }) },
        { workspacePath, manualSessionControl: true, functionality: { signatureHelp: false } }
      );
    }

    if (!lspClient) return null;

    if (!this.activeServers[workspacePath]) this.activeServers[workspacePath] = {};
    this.activeServers[workspacePath][serverOption.serviceName] = lspClient;

    this.log(`Server registered for workspace: ${workspacePath} (${serverOption.serviceName})`);
    return lspClient;
  }

  destroy() {
    Object.entries(this.activeServers).forEach(([workspace, clients]) => {
      Object.entries(clients).forEach(([serviceId, client]) => {
        try {
          if (this.isCodeMirror()) {
            lsp.servers.unregister(serviceId);
          } else {
            client.closeConnection();
          }
          this.log(`Closed "${serviceId}" for workspace: ${workspace}`);
        } catch (err) {
          this.log(`Failed to close "${serviceId}":`, err);
        }
      });
    });

    this.activeServers = {};
    this.clearAllWorkspaces();
    this.log('All LSP servers shut down.');
  }
  
  
  registerEditorIfReady() {
    if (this.isCodeMirror()) return;

    const workspacePath = this.getActiveFolderPath();
    const clients = this.activeServers[workspacePath];
    if (!clients) {
      this.log(`No clients found for workspace: ${workspacePath}`);
      return;
    }

    Object.entries(clients).forEach(([name, lspClient]) => {
      lspClient.registerEditor(editorManager.editor, {
        filePath: this.getCurrentFilePath(),
        joinWorkspaceURI: true,
      });
      this.log(`Editor registered for client: ${name}`);
    });

    this.log(`Editor attached to workspace: ${workspacePath}`);
  }
  

  async restoreAllOpenWorkspaces() {
    try {
      const savedWorkspaces = this.loadAllWorkspaces();
      this.log('[restore] Loaded workspaces:', savedWorkspaces);

      const workspaceCount = Object.keys(savedWorkspaces || {}).length;
      if (!workspaceCount) {
        this.log('[restore] No saved workspaces found. Exiting.');
        return;
      }

      const openFolders = window.addedFolder || [];
      this.log('[restore] Open folders:', openFolders);

      for (const [workspacePath, { serverServiceNames, workspaceMetadata }] of Object.entries(savedWorkspaces)) {
        this.log(`[restore] Processing workspace: ${workspacePath}`);

        const folderIsOpen = openFolders.some((f) =>
          normalizePath(f.url, true).includes(workspacePath)
        );

        if (!folderIsOpen) {
          this.log(`[restore] Skipping (folder not open): ${workspacePath}`);
          continue;
        }

        for (const serverName of serverServiceNames || []) {
          if (this.activeServers[workspacePath]?.[serverName]) {
            this.log(`[restore] Already active, skipping: ${serverName}`);
            continue;
          }

          const serverOption = this.serverOptions.find((s) => s.serviceName === serverName);
          if (!serverOption) {
            this.log(`[restore] Missing server option: ${serverName}`);
            continue;
          }

          try {
            this.createLSPServer(workspacePath, serverOption, workspaceMetadata);
            this.log(`[restore] Successfully created server: ${serverName}`);
          } catch (err) {
            this.log(`[restore] Error creating server ${serverName}:`, err);
          }
        }

        this.registerEditorIfReady();
        this.showToast(`Workspace restored: ${workspacePath}`);
        this.log(`[restore] Workspace restored: ${workspacePath}`);
      }
    } catch (err) {
      this.log('[restore] Fatal error restoring workspaces:', err);
    }
  }
  

  runLSPInit = async () => {
    this.log('LSP Init command triggered');
    const workspacePath = this.getActiveFolderPath();
    if (!workspacePath) return this.showAlert('Open a folder first.');

    const activeServers = this.activeServers[workspacePath]
      ? Object.keys(this.activeServers[workspacePath])
      : [];

    const defaultName = workspacePath.split('/').pop() || workspacePath;
    const workspaceInput = await multiPrompt('Workspace Info', [
      { type: 'text', id: 'name', value: defaultName, placeholder: 'Workspace name', required: true },
      { type: 'text', id: 'path', value: workspacePath, placeholder: 'Workspace path', required: true },
      ...this.serverOptions.map((s) => ({
        type: 'checkbox',
        id: s.serviceName,
        placeholder: s.label,
        value: activeServers.includes(s.serviceName),
        isActive: activeServers.includes(s.serviceName),
      })),
    ]).catch(() => null);

    if (!workspaceInput) return this.log('Workspace setup was cancelled.');

    const selectedServers = this.serverOptions.filter((s) => workspaceInput[s.serviceName]);
    if (!selectedServers.length) return this.showAlert('Please select at least one language server.');

    // Check for mode conflicts
    const usedModes = new Set();
    for (const server of selectedServers) {
      const modes = server.modes.split(/[\|,]/).map((m) => m.trim().toLowerCase()).filter(Boolean);
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

    this.saveWorkspace(workspacePath, initializedServers.map((s) => s.serviceName), workspaceInput);
    this.registerEditorIfReady();
    this.showToast(`${initializedServers.map((s) => s.label).join(', ')} initialized for ${workspacePath}`);
  };

  async init() {
    this.log('Initializing LSP Plugin...');

    commands.addCommand({
      name: 'LSP Settings',
      exec: () => openSettingsPage(this),
    });

    if (!this.isCodeMirror()) {
      commands.addCommand({
        name: 'LSP Client Init',
        bindKey: { win: 'Ctrl-L', mac: 'Cmd-L' },
        exec: () => this.runLSPInit(),
      });
    }

    commands.addCommand({
      name: 'LSP Client Init',
      bindKey: { win: 'Ctrl-Shift-L', mac: 'Cmd-Shift-L' },
      exec: () => this.runLSPInit(),
    });

    await this.restoreAllOpenWorkspaces();

    if (!this.isCodeMirror()) {
      editorManager.editor.on('changeSession', () => this.registerEditorIfReady());
    }
  }
}

if (window.acode) {
  const languageServerClient = new LSPClient();

  acode.setPluginInit(
    plugin.id,
    async () => await languageServerClient.init(),
    {
      list: [{ key: 'openSettings', text: 'Open LSP Settings' }],
      cb: async (actionKey) => {
        if (actionKey === 'openSettings') openSettingsPage(languageServerClient);
      },
    }
  );

  acode.setPluginUnmount(plugin.id, () => languageServerClient.destroy());
}
