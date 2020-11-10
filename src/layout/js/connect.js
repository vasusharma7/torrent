const electron = require("electron");
const { ipcRenderer: ipc } = electron;
const { dialog } = electron.remote;
const fs = require("fs");
const { parse } = require("path");
let filePath, folderPath;
try {
  var setupConfig = JSON.parse(fs.readFileSync("/tmp/setup.json", "utf8"));
  console.log(setupConfig);
  if (setupConfig) {
    filePath = setupConfig.filePath;
    folderPath = setupConfig.folderPath;
  }
  if (filePath && folderPath) {
    document.getElementById("proceed").disabled = false;
  }
} catch (err) {
  console.log(err);
}
document.querySelector("#fileLocation").addEventListener("click", () => {
  dialog
    .showOpenDialog({
      properties: ["openFile"],
    })
    .then((resp) => {
      if (!resp) return;
      filePath = resp.filePaths[0];
      if (!filePath.endsWith(".torrent")) {
        document.getElementById("file-chosen").innerText =
          "Please Select a Torrent File";
        filePath = null;
      } else {
        document.getElementById("file-chosen").innerText =
          "Torrent File:" + filePath;
        if (filePath && folderPath) {
          let setupfile = fs.openSync("/tmp/setup.json", "w+");
          const json = JSON.stringify({ filePath, folderPath });
          fs.writeSync(setupfile, json);
          document.getElementById("proceed").disabled = false;
        }
      }
    });
});
document.querySelector("#folderLocation").addEventListener("click", () => {
  dialog
    .showOpenDialog({
      properties: ["openDirectory"],
    })
    .then((resp) => {
      if (!resp) return;
      folderPath = resp.filePaths[0];
      document.getElementById("folder-chosen").innerText =
        "Save Location:" + folderPath;
      if (filePath && folderPath) {
        let setupfile = fs.openSync("/tmp/setup.json", "w+");
        const json = JSON.stringify({ filePath, folderPath });
        fs.writeSync(setupfile, json);
        document.getElementById("proceed-make").disabled = false;
      }
    });
});
document.querySelector("#makeSource").addEventListener("click", () => {
  let open = document.getElementById("makeFile").checked
    ? "openFile"
    : "openDirectory";
  console.log(open);
  dialog
    .showOpenDialog({
      properties: [open],
    })
    .then((resp) => {
      if (!resp) return;
      filePath = resp.filePaths[0];
      document.getElementById("file-make").innerText =
        "File/Folder Location:" + filePath;
      if (filePath && folderPath) {
        document.getElementById("proceed-make").disabled = false;
      }
    });
});
document.querySelector("#makeLocation").addEventListener("click", () => {
  dialog
    .showOpenDialog({
      properties: ["openDirectory"],
    })
    .then((resp) => {
      if (!resp) return;
      folderPath = resp.filePaths[0];
      document.getElementById("folder-make").innerText =
        "Destination:" + folderPath;
    });
});
document.getElementById("proceed").addEventListener("click", () => {
  let uspeed = parseInt(document.getElementById("setUspeed").value);
  let dspeed = parseInt(document.getElementById("setDspeed").value);
  let maxConnections = parseInt(document.getElementById("setPeers").value);
  ipc.send("start", filePath, folderPath, uspeed, dspeed, maxConnections);
  toggle("play");
});
document.getElementById("proceed-make").addEventListener("click", () => {
  const trackers = document.getElementById("trackers").value.split(",");
  console.log(trackers);
  let file_folder = document.getElementById("makeFile").checked ? 0 : 1;
  let name = document.getElementById("make-name").value;
  ipc.send("make", [filePath, trackers, file_folder, folderPath, name]);
});

ipc.on("torrent-info", (evt, info) => {
  console.log(info);
  document.getElementById("t-on").innerText = info["t-on"];
  document.getElementById("t-by").innerText = info["t-by"];
  document.getElementById("t-name").innerText = info["t-name"];
  document.getElementById("t-pieces").innerText = info["t-pieces"];
  document.getElementById("t-pieceLen").innerText = info["t-pieceLen"];
  document.getElementById("t-size").innerText = (info["t-size"] / 1024).toFixed(
    2
  );
});

ipc.on("progress", (evt, data) => {
  console.log("progress", data);
  document.getElementById("d-size").innerText = data;
  const size = parseInt(document.getElementById("t-size").innerText);
  document.getElementById("t-percent").innerText =
    Math.min(100, (data / size) * 100).toFixed(0) + "%";
  move(Math.ceil((data / size) * 100));
});

ipc.on("d-speed", (evt, data) => {
  document.getElementById("d-speed").innerText = data.toFixed(2);
});
ipc.on("u-speed", (evt, data) => {
  document.getElementById("u-speed").innerText = data.toFixed(2);
});
ipc.on("t-unchoked", (evt, data) => {
  document.getElementById("t-unchoked").innerText = data.length;
});

ipc.on("t-peers", (evt, data) => {
  document.getElementById("t-peers").innerText = data.length;
  let root = document.getElementById("t-connections");
  let dom = "";
  console.log(data);
  let index = 0;
  for (let peer of data) {
    index += 1;
    dom += ` <tr>
    <td>${index}</td>
    <td>${peer.info.ip}</td>
    <td>${peer.info.port}</td>
    
  </tr>`;
  }
  root.innerHTML = dom;
});
ipc.on("t-trackers", (evt, data) => {
  document.getElementById("t-trackers").innerText = data.length;
});
ipc.on("make-success", (evt, data) => {
  alert("Torrent Successfully Created and Saved");
});
ipc.on("t-files", (evt, data) => {
  let files = [
    {
      path: data["path"].substring(data["path"].lastIndexOf("/")),
      level: 0,
      size: 0,
    },
  ];
  walk(data["path"], files, 0, data["type"], () => {
    console.log(files);
    let root = document.getElementById("files");
    let dom = "";
    for (let file of files) {
      if (!file.size) {
        dom += `<b><span class="folder" style="margin-left: ${
          file.level * 15
        }px">${file.path.substring(1)}</span></b><br/>`;
      } else {
        dom += `<span class="file" style="margin-left: ${
          file.level * 15
        }px">${file.path.substring(1)}</span><br/>`;
      }
    }
    dom =
      `<h3 class="title" style="font-size: 1em">
    <b>File Tree</b>
  </h3>` + dom;
    root.innerHTML = dom;
  });
});
