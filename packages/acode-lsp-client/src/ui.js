const multiPrompt = acode.require('multiPrompt');

export class WorkspaceStorage {
  constructor(storageKey) {
    this.storageKey = storageKey;
  }

  save(path, serverNames, metadata) {
    const all = this.load();
    all[path] = {
      serverServiceNames: serverNames,
      workspaceMetadata: metadata,
    };
    localStorage.setItem(this.storageKey, JSON.stringify(all));
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

export function createServerCard(server, index, onEdit, onDelete) {
  const row = tag('div', {
    className: 'server-card',
    style: `
      border:1px solid #888;
      border-radius:6px;
      padding:8px;
      display:flex;
      justify-content:space-between;
      align-items:center;
    `,
  });

  const label = tag('div', {
    textContent: `${server.label} (${server.serviceName})`,
    style: 'flex:1;',
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

export function getServerPromptFields(server = {}) {
  return [
    {
      type: 'text',
      id: 'label',
      placeholder: 'Label',
      value: server.label || '',
      required: true,
    },
    {
      type: 'text',
      id: 'serviceName',
      placeholder: 'Service Name',
      value: server.serviceName || '',
      required: true,
    },
    {
      type: 'text',
      id: 'modes',
      placeholder: 'Modes (pipe separated)',
      value: server.modes || '',
    },
    {
      type: 'text',
      id: 'socketUrl',
      placeholder: 'Socket URL',
      value: server.socketUrl || '',
      required: true,
    },
  ];
}

export function openSettingsPage(client) {
  const backButton = tag('span', {
    className: 'icon arrow_back',
    dataset: { action: 'back-btn' },
    onclick: () => settingsPage.hide(),
  });

  const addButton = tag('span', {
    className: 'icon add_circle',
    dataset: { action: 'add-btn' },
  });

  const page = acode.require('page');
  const actionStack = acode.require('actionStack');
  const settingsPage = page('LSP Settings', { lead: backButton, tail: addButton });

  const settingsForm = tag('div', {
    style: 'padding:8px; display:flex; flex-direction:column; gap:12px; max-height:80vh; overflow:auto;',
  });

  const renderServers = () => {
    settingsForm.innerHTML = '';

    settingsForm.append(
      tag('h3', { textContent: 'Server Options', style: 'margin:0 0 8px 0;' })
    );

    client.serverOptions.forEach((s, index) => {
      const card = createServerCard(
        s,
        index,
        async (i) => {
          const result = await multiPrompt(
            'Edit Server',
            getServerPromptFields(client.serverOptions[i])
          ).catch(() => null);
          if (!result) return;
          if (!client.checkServiceNameUnique(result.serviceName, i)) return;
          client.serverOptions[i] = { ...client.serverOptions[i], ...result, type: 'socket' };
          client.saveServerOptions();
          renderServers();
          client.showToast('Server updated');
        },
        (i) => {
          client.serverOptions.splice(i, 1);
          client.saveServerOptions();
          renderServers();
          client.showToast('Server deleted');
        }
      );
      settingsForm.append(card);
    });

    settingsForm.append(
      tag('h3', { textContent: 'Saved Workspaces', style: 'margin-top:16px;margin-bottom:8px;' })
    );

    Object.entries(client.loadAllWorkspaces()).forEach(([path, data]) => {
      if (!data) return;
      const servers = Array.isArray(data.serverServiceNames)
        ? data.serverServiceNames.join(', ')
        : data.serverServiceNames;

      const row = tag('div', {
        style:
          'border:1px dashed #aaa; border-radius:4px; padding:6px; display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;',
      });

      const text = tag('span', { textContent: `${path} (${servers})` });

      const deleteBtn = tag('span', { className: 'icon delete_outline', title: 'Delete' });
      deleteBtn.onclick = () => {
        const all = client.loadAllWorkspaces();
        delete all[path];
        localStorage.setItem(client.workspaceStorage.storageKey, JSON.stringify(all));
        row.remove();
        client.showToast(`Workspace deleted: ${path}`);
        client.log('Workspace deleted from settings:', path);
      };

      row.append(text, deleteBtn);
      settingsForm.append(row);
    });
  };

  renderServers();

  addButton.onclick = async () => {
    const result = await multiPrompt('Add Server', getServerPromptFields()).catch(() => null);
    if (!result) return;
    if (!client.checkServiceNameUnique(result.serviceName)) return;
    client.serverOptions.push({ ...result, type: 'socket' });
    client.saveServerOptions();
    renderServers();
    client.showToast('Server added');
  };

  settingsPage.appendBody(settingsForm);
  settingsPage.show = () => {
    actionStack.push({ id: 'lsp-plugin', action: settingsPage.hide });
    app.append(settingsPage);
  };
  settingsPage.show();
}
