const fs = require("fs");
const tracker = require("./tracker");
const bencode = require("bencode");
const process = require("process");
const path = require("path");
var shell = require("shelljs");
const { Torrent } = require("./torrent");
const main = require("./main");

module.exports.init = (filename, dest) => {
  if (global.config.info) console.log(`[Info]: Reading Torrent File`);
  if (Torrent.prototype.electron)
    Torrent.prototype.transport("status", "Reading Torrent File");
  let file = -1;
  try {
    file = fs.readFileSync(filename);
  } catch (err) {
    if (global.config.debug)
      console.log("An error occured while opening torrent file", err.message);
    process.exit();
  }
  let size = 0;
  const torrent = bencode.decode(file);
  if (global.config.debug) console.log(torrent);
  if (global.config.debug)
    console.log("Announce: ", torrent.announce.toString("utf8"));
  let files = [];
  // if(global.config.debug)console.log(torrent.info.files);
  // process.exit();
  if (torrent.info.files) {
    const savePath = path.join(dest, torrent.info.name.toString("utf8"));
    //if(global.config.debug)console.log("path", path);
    if (!fs.existsSync(savePath)) {
      fs.mkdirSync(savePath);
    }
    for (let file of torrent.info.files) {
      // if(global.config.debug)console.log(file);
      const name = file.path.toString("utf8");
      if (!fs.existsSync(name)) {
        let tempPath = name.replace(/,/g, "/").split("/");
        let rootPath = path.join(
          savePath,
          torrent.info.name.toString("utf8"),
          tempPath.slice(0, tempPath.length - 1).join("/")
        );
        // let rootPath = `${process.cwd()}${root}${
        //   torrent.info.name
        // }/${tempPath.slice(0, tempPath.length - 1).join("/")}`;

        let filePath = path.join(
          savePath,
          torrent.info.name.toString("utf8"),
          tempPath.join("/")
        );

        // `${process.cwd()}${root}${
        //   torrent.info.name
        // }/${tempPath.join("/")}`;
        // let path = `${folderPath}/${name}`;

        shell.mkdir("-p", rootPath);
        let fd = fs.openSync(filePath, "w+");
        files.push({ path: filePath, size: file.length, fd: fd });
        size += file.length;
      }
    }
  } else {
    let savePath = path.join(dest, torrent.info.name.toString("utf8"));
    let fd = fs.openSync(savePath, "w+");
    files.push({ path: path, size: torrent.info.length, fd: fd });
    size += torrent.info.length;
  }
  // if(global.config.debug)console.log(files);
  // const peiceLen = torrent.info.length
  //   ? torrent.info.length
  //   : torrent.info["piece length"];
  const peiceLen = torrent.info["piece length"];
  let pieces = [];
  const pieceHash = torrent.info.pieces;
  for (let offset = 0; offset < pieceHash.length; offset += 20) {
    pieces.push(pieceHash.slice(offset, offset + 20));
  }
  if (global.config.debug)
    console.log(
      "Piece Length - ",
      torrent.info["piece length"],
      " Num Pieces - ",
      pieces.length
    );
  // manipulateState(torrent);
  Torrent.prototype.name = torrent.info.name.toString("utf8");
  //perhaps number of files
  // if(global.config.debug)console.log(torrent.info.files[0].path.toString())
  if (Torrent.prototype.electron) {
    let info = {
      "t-name": Torrent.prototype.name,
      "t-by": torrent["created by"]
        ? torrent["created by"].toString("utf8")
        : "",
      "t-on": new Date(torrent["creation date"]),
      "t-size": size,
      "t-pieceLen": peiceLen,
      "t-pieces": pieces.length,
    };
    Torrent.prototype.transport("torrent-info", info);
    Torrent.prototype.transport("t-files", {
      path: path.join(dest, torrent.info.name.toString("utf8")),
      type: files.length - 1,
    });
    // process.exit();
  }
  return { torrent: torrent, pieces: pieces, pieceLen: peiceLen, files: files };
};

// const manipulateState = (torrent) => {
//   const statePath = path.join(
//     path.dirname(require.main.filename),
//     `.${Torrent.prototype.name}.json`
//   );
//   const file = fs.openSync(statePath, "a+");

//   let stateInfo = {};
//   try {
//     stateInfo = JSON.parse(fs.readFileSync(statePath, "utf8"));
//   } catch (err) {
//     if (global.config.debug) console.log("A new torrent is added");
//   }
//   stateInfo[torrent.info.name.toString("utf8")] = { status: "downloading" };
//   fs.writeFileSync(statePath, JSON.stringify(stateInfo));
//   fs.closeSync(file);
// };

module.exports.parse = async (torrent, callback) => {
  let urls = [];
  try {
    urls = [torrent.announce.toString()];
  } catch {}
  // let urls = [torrent["announce-list"][1].toString()]
  if (torrent["announce-list"] && torrent["announce-list"].length) {
    torrent["announce-list"].forEach((url) => {
      urls.push(...url.toString().split(","));
    });
  }
  if (global.config.info) console.log(`[Info]: Contacting Trackers`);
  if (Torrent.prototype.electron)
    Torrent.prototype.transport(
      "status",
      `Contacting Trackers ( Found ${urls.length} trackers )`
    );
  if (Torrent.prototype.electron) {
    Torrent.prototype.transport("t-trackers", urls);
  }

  let track = 1;
  Torrent.prototype.store = [];
  Torrent.prototype.urls = [...urls];
  Torrent.prototype.contactCount = 0;
  if (global.config.debug) console.log(`Found ${urls.length - 1} trackers`);

  tracker.getPeers(torrent, urls.shift(), (peers) => {
    callback(peers);
  });
  setInterval(() => {
    let url =
      Torrent.prototype.urls[
        Torrent.prototype.contactCount % Torrent.prototype.urls.length
      ];
    if (global.config.debug)
      console.log(
        `------------------------Attempting to connect to - ${url}-------------------------`
      );
    setTimeout(() => {
      tracker.getPeers(torrent, url, (peers) => {
        Torrent.prototype.store.push(...peers);
        if (
          (Torrent.prototype.contactCount >= Torrent.prototype.urls.length &&
            Torrent.prototype.connectedPeers.length !== 0) ||
          Torrent.prototype.isComplete
        ) {
          if (global.config.debug)
            console.log(
              Torrent.prototype.contactCount,
              Torrent.prototype.urls.length,
              Torrent.prototype.connectedPeers.length
            );
          if (global.config.debug) console.log("restricting callback");
          return;
        }
        if (global.config.debug)
          console.log(
            Torrent.prototype.contactCount,
            Torrent.prototype.urls.length,
            Torrent.prototype.connectedPeers.length
          );
        callback(peers);
        if (global.config.debug) console.log("permitting callback");
      });
    }, ((Torrent.prototype.contactCount % Torrent.prototype.urls.length) + 1) * 2000);
    Torrent.prototype.contactCount += 1;
  }, 5000);
  // ((Torrent.prototype.contactCount % Torrent.prototype.urls.length) + 1) * 2000

  // urls.forEach((url) => {
  //   setTimeout(() => {}, track * 10000);
  //   track++;
  // });
};
