const fs = require("fs");
const tracker = require("./tracker");
const bencode = require("bencode");
const process = require("process");
var shell = require("shelljs");
const { Torrent } = require("./torrent");
module.exports.init = (filename) => {
  let file = -1;
  try {
    file = fs.readFileSync(filename);
  } catch (err) {
    console.log("An error occured while opening torrent file", err.message);
    process.exit();
  }
  const torrent = bencode.decode(file);
  console.log("Announce: ", torrent.announce.toString("utf8"));
  let files = [];
  // console.log(torrent.info.files);
  // process.exit();
  const root = "/downloads/";
  if (torrent.info.files) {
    if (!fs.existsSync("./downloads/" + torrent.info.name)) {
      fs.mkdirSync("./downloads/" + torrent.info.name);
    }
    for (let file of torrent.info.files) {
      // console.log(file);
      const name = file.path.toString("utf8");
      // console.log(name);
      if (!fs.existsSync(name)) {
        let tempPath = name.replace(/,/g, "/").split("/");
        let rootPath = `${process.cwd()}${root}${
          torrent.info.name
        }/${tempPath.slice(0, tempPath.length - 1).join("/")}`;

        // console.log(tempPath.join("/"));
        // console.log(rootPath);
        let filePath = `${process.cwd()}${root}${
          torrent.info.name
        }/${tempPath.join("/")}`;
        // let path = `${folderPath}/${name}`;
        shell.mkdir("-p", rootPath);
        let fd = fs.openSync(filePath, "w+");
        files.push({ path: filePath, size: file.length, fd: fd });
      }
    }
  } else {
    let path = process.cwd() + root + torrent.info.name;
    let fd = fs.openSync(path, "w+");
    files.push({ path: path, size: torrent.info.length, fd: fd });
  }
  // console.log(files);
  // const peiceLen = torrent.info.length
  //   ? torrent.info.length
  //   : torrent.info["piece length"];
  const peiceLen = torrent.info["piece length"];
  let pieces = [];
  const pieceHash = torrent.info.pieces;
  for (let offset = 0; offset < pieceHash.length; offset += 20) {
    pieces.push(pieceHash.slice(offset, offset + 20));
  }
  console.log(
    "Piece Length - ",
    torrent.info["piece length"],
    " Num Pieces - ",
    pieces.length
  );
  // console.log(torrent.info.files[0].path.toString())
  return { torrent: torrent, pieces: pieces, pieceLen: peiceLen, files: files };
};

module.exports.parse = async (torrent, callback) => {
  let urls = [torrent.announce.toString()];
  // let urls = [torrent["announce-list"][1].toString()]
  if (torrent["announce-list"] && torrent["announce-list"].length) {
    torrent["announce-list"].forEach((url) => {
      urls.push(...url.toString().split(","));
    });
  }

  let track = 1;
  Torrent.prototype.store = [];
  Torrent.prototype.urls = [...urls];
  Torrent.prototype.contactCount = 0;
  console.log(`Found ${urls.length - 1} trackers`);
  tracker.getPeers(torrent, urls.shift(), (peers) => {
    callback(peers);
  });
  setInterval(() => {
    let url =
      Torrent.prototype.urls[
        Torrent.prototype.contactCount % Torrent.prototype.urls.length
      ];
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
          console.log(
            Torrent.prototype.contactCount,
            Torrent.prototype.urls.length,
            Torrent.prototype.connectedPeers.length
          );
          console.log("restricting callback");
          return;
        }
        console.log(
          Torrent.prototype.contactCount,
          Torrent.prototype.urls.length,
          Torrent.prototype.connectedPeers.length
        );
        callback(peers);
        console.log("permitting callback");
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
