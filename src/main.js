const electron = require("electron");
const {
  Menu,
  app,
  Tray,
  BrowserWindow,
  ipcMain: ipc,
  globalShortcut,
} = electron;
const exec = require("child_process").exec;
const child_process = require("child_process");
const path = require("path");
const torrent = require("./torrent-core/src/main");
const make_torrent = require("./torrent-core/src/make-torrent").makeTorrent;
var manage = {
  state: -1,
  stateListener: function (val) {},
  set trigger(val) {
    this.state = val;
    this.stateListener(val);
  },
  get trigger() {
    return this.state;
  },
  registerListener: function (listener) {
    this.stateListener = listener;
  },
};

require("electron-reload")(__dirname, {
  electron: require(`${__dirname}/../node_modules/electron`),
});

var mainWindow = null;

app.on("ready", async (_) => {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    minWidth: 100,
    minHeight: 100,
    resizeable: false,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    },
  });
  // mainWindow.removeMenu();
  mainWindow.loadURL(`file://${__dirname}/layout/index.html`);
  mainWindow.webContents.openDevTools();
  tray = new Tray(path.join(__dirname, "assets/min.png"));
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Torrent",
      click: function () {
        mainWindow.show();
      },
    },
    {
      label: "Quit",
      click: function () {
        mainWindow.quit();
        app.quit();
      },
    },
  ]);

  tray.on("click", () => {
    mode = "asst";
    manage.trigger += 1;
    mainWindow.show();
  });
  tray.setToolTip("VS Torrent - Your Own Client");
  tray.setContextMenu(contextMenu);

  manage.registerListener(() => {});
  manage.trigger += 1;

  mainWindow.on("closed", (_) => {
    mainWindow = null;
  });
});
function transport(event, data) {
  mainWindow.webContents.send(event, data);
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.exit(0);
  }
});

ipc.on("start", (evt, filePath, folderPath, uspeed, dspeed, maxConnections) => {
  torrent.startTorrent(filePath, folderPath, {
    uspeed: uspeed ? uspeed : -1,
    dspeed: dspeed ? dspeed : -1,
    maxConnections: maxConnections ? maxConnections : null,
    transport: transport,
    electron: true,
  });
});
ipc.on("make", (evt, args) => {
  make_torrent(...args, transport);
});

ipc.on("close", (evt) => {
  app.exit(0);
});
ipc.on("torrent-info", (evt, info) => {
  console.log(info);
});

app.on("before-quit", () => {
  globalShortcut.unregisterAll();
  if (mainWindow) {
    mainWindow.removeAllListeners("close");
    mainWindow.close();
  }
});
