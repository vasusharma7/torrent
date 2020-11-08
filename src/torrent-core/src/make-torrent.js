const bencode = require("bencode");
const crypto = require("crypto");
let fs = require("fs");

let walk = function (dir, tempFile, metaData, files, type, done) {
  if (!type) {
    done();
    return;
  }
  fs.readdir(dir, function (error, list) {
    if (error) {
      return done(error);
    }
    let i = 0;

    (function next() {
      let file = list[i++];

      if (!file) {
        return done(null);
      }

      file = dir + "/" + file;

      fs.stat(file, function (error, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, tempFile, metaData, files, type, function (error) {
            next();
          });
        } else {
          const current = fs.openSync(file, "r+");
          const contents = fs.readFileSync(current);
          fs.writeFileSync(tempFile, contents);
          // if(global.config.debug)console.log(file.substring(metaData.index + 1));
          metaData.size += contents.length;
          files.push({
            path: file.substring(metaData.index + 1),
            length: contents.length,
          });
          metaData.count += 1;
          next();
        }
      });
    })();
  });
};

const makeTorrent = async (
  walkPath,
  trackerURLS,
  type,
  destination,
  torrentName,
  gui
) => {
  let tempFile = fs.openSync(".vstorrent_bigfile", "w+");

  let files = [];
  let metaData = { size: 0, count: 0, index: walkPath.length };
  await new Promise((resolve) => {
    walk(walkPath, tempFile, metaData, files, type, function (error) {
      if (error) {
        throw error;
      }
      resolve();
    });
  }).then(() => {
    let { size, count } = metaData;
    if (!type) {
      size = fs.readFileSync(fs.openSync(walkPath, "r+")).length;
    }
    if (global.config.debug) console.log(`found ${count} files`);
    let torrent = {};
    torrent["announce"] = Buffer.from(trackerURLS.shift());
    if (trackerURLS.length) {
      torrent["announce-list"] = [];
      for (let url of trackerURLS) {
        torrent["announce-list"].push([Buffer.from(url)]);
      }
    }

    torrent["created by"] = Buffer.from("Vasu Sharma");
    torrent["creation date"] = new Date().getTime();
    torrent["info"] = {};
    torrent["info"]["length"] = size;
    let pieceLen = Math.min(size, Math.pow(2, 6) * 1024);
    if (type) {
      torrent["info"]["files"] = [];
      for (let file of files) {
        let path = file.path.split("/").map((part) => Buffer.from(part));
        torrent["info"]["files"].push({ length: file.length, path: path });
      }
    }

    let buffer = Buffer.alloc(Math.ceil(size / pieceLen) * 20);
    let tempBuffer = Buffer.alloc(pieceLen);
    let piecesRead = 0;
    let hash;
    while (
      fs.readSync(
        tempFile,
        tempBuffer,
        0,
        Math.min(pieceLen, size - piecesRead * pieceLen),
        piecesRead * pieceLen
      )
    ) {
      hash = crypto
        .createHash("sha1")
        .update(
          tempBuffer.slice(0, Math.min(pieceLen, size - piecesRead * pieceLen))
        )
        .digest();
      hash.copy(buffer, pieceLen * piecesRead);
      piecesRead++;
      // if(global.config.debug)console.log(piecesRead, pieceLen);
      if (size - piecesRead * pieceLen <= 0) break;
    }
    let mainName = walkPath.split("/");
    torrent["info"]["name"] = Buffer.from(mainName[mainName.length - 1]);
    torrent["info"]["piece length"] = pieceLen;
    torrent["info"]["pieces"] = buffer;
    let result = bencode.encode(torrent);
    let torrentFile = fs.openSync(
      destination + "/" + torrentName + ".torrent",
      "w+"
    );
    if (global.config.debug) console.log(torrent);
    console.log("Torrent Successfuly Created");
    fs.writeFileSync(torrentFile, result);
    if (gui) gui("make-success", "Torrent Created Successfuly");
  });
};

// let walkPath = "../Clementine 1.3.1 Source";
let walkPath = "./Too Much and Never Enough - Mary Trump.epub";
let trackerURLS = [
  "udp://public.popcorn-tracker.org:6969/announce",
  "udp://public.popcorn-tracker.org:6969/announce",
  "http://bt2.careland.com.cn:6969/announce",
];

// makeTorrent(walkPath, trackerURLS, 0);

module.exports = { makeTorrent };
