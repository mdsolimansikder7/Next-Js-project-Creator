import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

type Linter = 'eslint' | 'biome' | 'none';
type CacheMode = 'default' | 'on' | 'off';

interface FormOptions {
  name: string;
  folder: string;
  language: 'typescript' | 'javascript';
  tailwind: boolean;
  linter: Linter;
  reactCompiler: boolean;
  cacheComponents: CacheMode;
  agentsMd: boolean;
  srcDir: boolean;
  appRouter: boolean;
  turbopack: boolean;
  importAlias: string;
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  openAfterCreate: 'ask' | 'currentWindow' | 'newWindow';
}

interface Opts {
  name: string;
  parent: string;
  ts: boolean;
  tailwind: boolean;
  linter: Linter;
  reactCompiler: boolean;
  cache: CacheMode;
  agentsMd: boolean;
  src: boolean;
  app: boolean;
  turbo: boolean;
  alias: string;
  pm: string;
}

function buildCommand(o: Opts): string {
  const linterFlag =
    o.linter === 'eslint' ? '--eslint' :
    o.linter === 'biome' ? '--biome' :
    '--no-linter';

  const flags = [
    o.ts ? '--ts' : '--js',
    o.tailwind ? '--tailwind' : '--no-tailwind',
    linterFlag,
    o.reactCompiler ? '--react-compiler' : '--no-react-compiler',
    o.agentsMd ? '--agents-md' : '--no-agents-md',
    o.src ? '--src-dir' : '--no-src-dir',
    o.app ? '--app' : '--no-app',
    `--import-alias "${o.alias}"`,
    `--use-${o.pm}`,
  ];
  if (o.turbo) flags.push('--turbopack');
  if (o.cache === 'on') flags.push('--cache-components');
  if (o.cache === 'off') flags.push('--no-cache-components');
  return `npx --yes create-next-app@latest "${o.name}" ${flags.join(' ')} --yes`;
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new CreatorViewProvider();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('nextCreator.panel', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('nextCreator.create', () =>
      vscode.commands.executeCommand('nextCreator.panel.focus')
    )
  );

  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  item.text = '$(add) Create Next.js App';
  item.tooltip = 'Open the Next.js Creator panel';
  item.command = 'nextCreator.create';
  item.show();
  context.subscriptions.push(item);
}

export function deactivate() {}

class CreatorViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private busy = false;
  private readonly out = vscode.window.createOutputChannel('Next.js Creator');

  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.getHtml(view.webview);

    view.webview.onDidReceiveMessage(async (m: any) => {
      switch (m.type) {
        case 'ready':
          view.webview.postMessage({ type: 'init', data: this.readConfig() });
          break;
        case 'pickFolder': {
          const picked = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select folder',
          });
          if (picked && picked[0]) {
            view.webview.postMessage({ type: 'folder', path: picked[0].fsPath });
          }
          break;
        }
        case 'saveDefaults':
          await this.saveDefaults(m.data as FormOptions);
          break;
        case 'create':
          await this.create(m.data as FormOptions);
          break;
      }
    });
  }

  private readConfig() {
    const c = vscode.workspace.getConfiguration('nextCreator');
    return {
      folder: c.get<string>('defaultFolder', ''),
      language: c.get<string>('language', 'typescript'),
      tailwind: c.get<boolean>('tailwind', true),
      linter: c.get<string>('linter', 'eslint'),
      reactCompiler: c.get<boolean>('reactCompiler', false),
      cacheComponents: c.get<string>('cacheComponents', 'default'),
      agentsMd: c.get<boolean>('agentsMd', true),
      srcDir: c.get<boolean>('srcDir', false),
      appRouter: c.get<boolean>('appRouter', true),
      turbopack: c.get<boolean>('turbopack', false),
      importAlias: c.get<string>('importAlias', '@/*'),
      packageManager: c.get<string>('packageManager', 'npm'),
      openAfterCreate: c.get<string>('openAfterCreate', 'ask'),
    };
  }

  private async saveDefaults(d: FormOptions) {
    const c = vscode.workspace.getConfiguration('nextCreator');
    const T = vscode.ConfigurationTarget.Global;
    await c.update('defaultFolder', d.folder || '', T);
    await c.update('language', d.language, T);
    await c.update('tailwind', d.tailwind, T);
    await c.update('linter', d.linter, T);
    await c.update('reactCompiler', d.reactCompiler, T);
    await c.update('cacheComponents', d.cacheComponents, T);
    await c.update('agentsMd', d.agentsMd, T);
    await c.update('srcDir', d.srcDir, T);
    await c.update('appRouter', d.appRouter, T);
    await c.update('turbopack', d.turbopack, T);
    await c.update('importAlias', d.importAlias, T);
    await c.update('packageManager', d.packageManager, T);
    await c.update('openAfterCreate', d.openAfterCreate, T);
    vscode.window.showInformationMessage('Next.js Creator: defaults saved.');
  }

  private setBusy(value: boolean) {
    this.busy = value;
    this.view?.webview.postMessage({ type: 'busy', value });
  }

  private async create(d: FormOptions) {
    if (this.busy) {
      return;
    }

    const o: Opts = {
      name: (d.name || '').trim(),
      parent: (d.folder || '').trim(),
      ts: d.language === 'typescript',
      tailwind: !!d.tailwind,
      linter: d.linter,
      reactCompiler: !!d.reactCompiler,
      cache: d.cacheComponents || 'default',
      agentsMd: !!d.agentsMd,
      src: !!d.srcDir,
      app: !!d.appRouter,
      turbo: !!d.turbopack,
      alias: (d.importAlias || '').trim(),
      pm: d.packageManager,
    };

    if (!/^[a-z0-9][a-z0-9-_]*$/.test(o.name)) {
      vscode.window.showErrorMessage('Project name: use lowercase letters, numbers, - or _');
      return;
    }
    if (!o.parent || !fs.existsSync(o.parent)) {
      vscode.window.showErrorMessage('Please choose a valid folder first.');
      return;
    }
    if (!/^[\w@~#-]+\/\*$/.test(o.alias)) {
      vscode.window.showErrorMessage('Import alias must look like @/*');
      return;
    }
    if (!['npm', 'pnpm', 'yarn', 'bun'].includes(o.pm)) {
      vscode.window.showErrorMessage('Invalid package manager.');
      return;
    }
    if (!['eslint', 'biome', 'none'].includes(o.linter)) {
      vscode.window.showErrorMessage('Invalid linter.');
      return;
    }
    if (!['default', 'on', 'off'].includes(o.cache)) {
      vscode.window.showErrorMessage('Invalid Cache Components option.');
      return;
    }
    const target = path.join(o.parent, o.name);
    if (fs.existsSync(target) && fs.readdirSync(target).length > 0) {
      vscode.window.showErrorMessage(`Folder "${o.name}" already exists and is not empty.`);
      return;
    }

    const cmd = buildCommand(o);
    this.out.clear();
    this.out.show(true);
    this.out.appendLine(`$ ${cmd}\n`);
    this.setBusy(true);

    const code = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Creating Next.js project…' },
      () =>
        new Promise<number>((resolve) => {
          const p = cp.spawn(cmd, { cwd: o.parent, shell: true });
          p.stdout.on('data', (b) => this.out.append(b.toString()));
          p.stderr.on('data', (b) => this.out.append(b.toString()));
          p.on('error', (e) => {
            this.out.appendLine(String(e));
            resolve(1);
          });
          p.on('close', (c) => resolve(c ?? 1));
        })
    );

    this.setBusy(false);

    if (code !== 0) {
      vscode.window.showErrorMessage('create-next-app failed. Check the "Next.js Creator" output.');
      return;
    }

    const uri = vscode.Uri.file(target);
    let mode: string = d.openAfterCreate || 'ask';
    if (mode === 'ask') {
      const pick = await vscode.window.showInformationMessage(
        `${o.name} is ready`,
        'Open',
        'Open in new window'
      );
      if (!pick) {
        return;
      }
      mode = pick === 'Open' ? 'currentWindow' : 'newWindow';
    }
    vscode.commands.executeCommand('vscode.openFolder', uri, mode === 'newWindow');
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = Array.from({ length: 24 }, () =>
      'abcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 36))
    ).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">
  body { padding: 8px 12px 16px; font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); }
  .field-label { display: block; margin: 12px 0 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; opacity: .8; }
  input[type=text], select { width: 100%; box-sizing: border-box; padding: 5px 6px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); border-radius: 2px; font: inherit; }
  input:focus, select:focus { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
  .row { display: flex; gap: 6px; }
  .row input { flex: 1; min-width: 0; }
  button { font: inherit; padding: 6px 10px; border: none; border-radius: 2px; cursor: pointer; color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
  button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
  button:disabled { opacity: .5; cursor: default; }
  .check { display: flex; align-items: center; gap: 8px; margin: 7px 0; }
  .check input { margin: 0; }
  .check label { cursor: pointer; }
  .actions { margin-top: 18px; display: flex; flex-direction: column; gap: 6px; }
  hr { border: none; border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,.3)); margin: 14px 0 2px; }
</style>
</head>
<body>
  <label class="field-label" for="name">Project name</label>
  <input type="text" id="name" placeholder="my-next-app" spellcheck="false">

  <label class="field-label" for="folder">Location</label>
  <div class="row">
    <input type="text" id="folder" placeholder="Choose a folder..." spellcheck="false">
    <button class="secondary" id="browse">Browse</button>
  </div>

  <label class="field-label" for="language">Language</label>
  <select id="language">
    <option value="typescript">TypeScript (tsx)</option>
    <option value="javascript">JavaScript (jsx)</option>
  </select>

  <label class="field-label" for="linter">Linter</label>
  <select id="linter">
    <option value="eslint">ESLint</option>
    <option value="biome">Biome</option>
    <option value="none">None</option>
  </select>

  <label class="field-label" for="cacheComponents">Cache Components</label>
  <select id="cacheComponents">
    <option value="default">Default (CLI decides)</option>
    <option value="on">Enable</option>
    <option value="off">Disable</option>
  </select>

  <hr>
  <label class="field-label">Options</label>
  <div class="check"><input type="checkbox" id="tailwind"><label for="tailwind">Tailwind CSS</label></div>
  <div class="check"><input type="checkbox" id="reactCompiler"><label for="reactCompiler">React Compiler</label></div>
  <div class="check"><input type="checkbox" id="agentsMd"><label for="agentsMd">AGENTS.md</label></div>
  <div class="check"><input type="checkbox" id="srcDir"><label for="srcDir">Use src/ directory</label></div>
  <div class="check"><input type="checkbox" id="appRouter"><label for="appRouter">App Router</label></div>
  <div class="check"><input type="checkbox" id="turbopack"><label for="turbopack">Turbopack</label></div>

  <label class="field-label" for="importAlias">Import alias</label>
  <input type="text" id="importAlias" spellcheck="false">

  <label class="field-label" for="packageManager">Package manager</label>
  <select id="packageManager">
    <option value="npm">npm</option>
    <option value="pnpm">pnpm</option>
    <option value="yarn">yarn</option>
    <option value="bun">bun</option>
  </select>

  <label class="field-label" for="openAfterCreate">After creating</label>
  <select id="openAfterCreate">
    <option value="ask">Ask me</option>
    <option value="currentWindow">Open in this window</option>
    <option value="newWindow">Open in new window</option>
  </select>

  <div class="actions">
    <button id="create">Create Project</button>
    <button class="secondary" id="save">Save as defaults</button>
  </div>

<script nonce="${nonce}">
  var vscode = acquireVsCodeApi();
  function $(id) { return document.getElementById(id); }
  var checks = ['tailwind', 'reactCompiler', 'agentsMd', 'srcDir', 'appRouter', 'turbopack'];
  var values = ['folder', 'language', 'linter', 'cacheComponents', 'importAlias', 'packageManager', 'openAfterCreate'];

  window.addEventListener('message', function (e) {
    var m = e.data;
    if (m.type === 'init') {
      values.forEach(function (k) { $(k).value = m.data[k]; });
      checks.forEach(function (k) { $(k).checked = !!m.data[k]; });
    } else if (m.type === 'folder') {
      $('folder').value = m.path;
    } else if (m.type === 'busy') {
      $('create').disabled = m.value;
      $('create').textContent = m.value ? 'Creating...' : 'Create Project';
    }
  });

  function collect() {
    var d = { name: $('name').value };
    values.forEach(function (k) { d[k] = $(k).value; });
    checks.forEach(function (k) { d[k] = $(k).checked; });
    return d;
  }

  $('browse').addEventListener('click', function () { vscode.postMessage({ type: 'pickFolder' }); });
  $('create').addEventListener('click', function () { vscode.postMessage({ type: 'create', data: collect() }); });
  $('save').addEventListener('click', function () { vscode.postMessage({ type: 'saveDefaults', data: collect() }); });

  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
  }
}