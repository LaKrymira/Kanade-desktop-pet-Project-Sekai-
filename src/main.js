const { app, BrowserWindow, dialog, ipcMain, screen, shell } = require('electron');
const path = require('path');

let petWindow;

function compareVersions(a, b) {
  const left = a.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const right = b.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] || 0) - (right[index] || 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createPetWindow() {
  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.workArea;

  petWindow = new BrowserWindow({
    width: 340,
    height: 430,
    x: x + width - 370,
    y: y + height - 455,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  petWindow.setAlwaysOnTop(true, 'floating');
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  petWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  petWindow.once('ready-to-show', () => petWindow.show());
}

ipcMain.on('window:move', (_event, movement) => {
  if (!petWindow || petWindow.isDestroyed()) return;
  const bounds = petWindow.getBounds();
  const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
  const area = display.workArea;
  petWindow.setPosition(
    clamp(Math.round(bounds.x + movement.x), area.x, area.x + area.width - bounds.width),
    clamp(Math.round(bounds.y + movement.y), area.y, area.y + area.height - bounds.height)
  );
});

ipcMain.on('app:quit', () => app.quit());

ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  packaged: app.isPackaged
}));

ipcMain.handle('update:select-local', async () => {
  const result = await dialog.showOpenDialog(petWindow, {
    title: '选择宵崎奏桌宠更新安装包',
    buttonLabel: '检查此安装包',
    properties: ['openFile'],
    filters: [{ name: 'macOS 安装镜像', extensions: ['dmg'] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { status: 'canceled' };
  }

  const updatePath = result.filePaths[0];
  const fileName = path.basename(updatePath);
  const versionMatch = fileName.match(/(\d+\.\d+\.\d+)/);
  if (!versionMatch) {
    return { status: 'invalid', message: '无法从文件名识别版本号，请使用包含 x.y.z 版本号的 DMG。' };
  }

  const nextVersion = versionMatch[1];
  const currentVersion = app.getVersion();
  if (compareVersions(nextVersion, currentVersion) <= 0) {
    return {
      status: 'not-newer',
      message: `所选版本 ${nextVersion} 不高于当前版本 ${currentVersion}。`
    };
  }

  const confirmation = await dialog.showMessageBox(petWindow, {
    type: 'info',
    title: '发现本地更新',
    message: `发现新版本 ${nextVersion}`,
    detail: '将打开安装镜像。请把新版“宵崎奏桌宠”拖入“应用程序”并选择替换，然后重新打开应用。',
    buttons: ['打开并安装', '取消'],
    defaultId: 0,
    cancelId: 1
  });

  if (confirmation.response !== 0) return { status: 'canceled' };
  const openError = await shell.openPath(updatePath);
  if (openError) return { status: 'error', message: openError };
  return { status: 'opened', version: nextVersion };
});

app.whenReady().then(() => {
  createPetWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createPetWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
