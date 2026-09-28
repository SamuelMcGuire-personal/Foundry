const { app, BrowserWindow, dialog } = require('electron');

app.disableHardwareAcceleration();

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 820,
    height: 560,
    minWidth: 640,
    minHeight: 420,
    show: true,
    center: true,
    backgroundColor: '#f7f4ec',
    title: 'Foundry Canary',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Foundry Canary</title><style>body{margin:0;background:#f7f4ec;color:#20242c;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:grid;place-items:center;min-height:100vh}.card{width:min(640px,calc(100vw - 64px));background:white;border:1px solid #d9d4c8;border-radius:22px;padding:34px;box-shadow:0 18px 45px rgba(28,31,38,.10)}h1{margin:0 0 12px;font-size:32px}p{line-height:1.55;color:#555b66}.ok{display:inline-block;margin-top:14px;padding:9px 13px;border-radius:999px;background:#e7f7ec;color:#176236;font-weight:700}.meta{margin-top:24px;padding-top:20px;border-top:1px solid #ece8df;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#5c6270}</style></head><body><div class="card"><h1>Foundry Canary</h1><p>If you can see this window, Electron itself is launching correctly on this Mac. That means the failure is inside Foundry's normal preload/renderer/startup layer rather than the desktop runtime.</p><div class="ok">Native shell opened successfully</div><div class="meta">Foundry Canary 1.0.4<br>Apple Silicon / Tahoe diagnostic</div></div></body></html>`;

  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });
  win.webContents.on('did-fail-load', (_e, code, desc) => {
    dialog.showErrorBox('Foundry Canary failed to render', `${code}: ${desc}`);
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    dialog.showErrorBox('Foundry Canary renderer stopped', JSON.stringify(details));
  });
}

process.on('uncaughtException', err => {
  try { dialog.showErrorBox('Foundry Canary startup error', String(err && err.stack || err)); } catch {}
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
