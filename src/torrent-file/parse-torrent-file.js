const fs = require("fs");
const tracker = require("./tracker");
const bencode = require("bencode");
const process = require("process");
const { off } = require("process");
module.exports.init = (filename) => {
  const torrent = bencode.decode(fs.readFileSync(filename));
  console.log("Announce: ", torrent.announce.toString("utf8"));
  let files = [];
  //   console.log(torrent);
  const root = "/downloads/";
  if (torrent.info.files) {
    if (!fs.existsSync("./downloads/" + torrent.info.name)) {
      fs.mkdirSync("./downloads/" + torrent.info.name);
    }
    for (let file of torrent.info.files) {
      // console.log(file)
      const name = file.path.toString("utf8");
      console.log(name);
      if (!fs.existsSync(name)) {
        let path = process.cwd() + root + torrent.info.name + "/" + name;
        let fd = fs.openSync(path, "w");
        files.push({ path: path, size: file.length, fd: fd });
      }
    }
  } else {
    let path = process.cwd() + root + torrent.info.name;
    let fd = fs.openSync(path, "w");
    files.push({ path: path, size: torrent.info.length, fd: fd });
  }
  const peiceLen = torrent.info.length
    ? torrent.info.length
    : torrent.info["piece length"];
  let pieces = [];
  const pieceHash = torrent.info.pieces;
  for (let offset = 0; offset < pieceHash.length; offset += 20) {
    pieces.push(pieceHash.slice(offset, offset + 20));
  }
  console.log(torrent.info["piece length"], pieces.length);
  // console.log(torrent.info.files[0].path.toString())
  return { torrent: torrent, pieces: pieces, pieceLen: peiceLen, files: files };
};
module.exports.parse = (torrent, callback) => {
  tracker.getPeers(torrent, (peers) => {
    callback(peers);
  });
};
// module.exports.parse = (torrent, callback) => {
//   let urls = [torrent.announce.toString()];
//   // let urls = [torrent["announce-list"][1].toString()]
//   if (torrent["announce-list"] && torrent["announce-list"].length) {
//     torrent["announce-list"].forEach((url) => {
//       urls.push(url.toString());
//     });
//   }
//   console.log(urls);
//   let peers = [];
//   urls.forEach((url) => {
//     tracker.getPeers(torrent, url, (peersList) => {
//       console.log(peers);
//       callback(peers);
//     });
//   });
// };
