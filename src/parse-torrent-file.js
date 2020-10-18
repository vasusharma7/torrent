const fs = require("fs");
const tracker = require("./tracker");
const bencode = require("bencode");
const process = require("process");
var shell = require("shelljs");
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
        let fd = fs.openSync(filePath, "w");
        files.push({ path: filePath, size: file.length, fd: fd });
      }
    }
  } else {
    let path = process.cwd() + root + torrent.info.name;
    let fd = fs.openSync(path, "w");
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
  console.log(torrent.info["piece length"], pieces.length);
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
  let store = [];
  console.log(urls);
  tracker.getPeers(torrent, urls.shift(), (peers) => {
    store.push(...peers);
    callback(peers);
  });

  urls.forEach((url) => {
    setTimeout(() => {
      // if (Torrent.prototype.connectedPeers < 50) {
      // if (track == last) return;
      console.log(
        `------------------------Attempting to connect to - ${url}-------------------------`
      );
      tracker.getPeers(torrent, url, (peers) => {
        store.push(...peers);
        callback(peers);
      });
      // }
    }, track * 10000);
    track++;
  });
};
