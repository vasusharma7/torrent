require("./src/config");
const process = require("process");
const torrentFile = require("./src/parse-torrent-file");
const { EventEmitter: eventEmmiter } = require("./src/utils/events.js");
const Seeder = require("./src/seed");
const torrentUtils = require("./src/torrent-file-utils");
const axios = require("axios");
const { Peer } = require("./src/peer");
const { Torrent } = require("./src/torrent");
const { PriorityQueue } = require("./src/utils/priority-queue");
const file = process.argv[2];
const dest = process.argv[3];

module.exports = startTorrent = (file, dest) => {
  if (!file) {
    console.log("Please provide a torrent file in the arguement");
    process.exit();
  }
  if (!dest) {
    dest = ".";
  }
  const { torrent, pieces, pieceLen, files } = torrentFile.init(file, dest);
  let seeder = new Seeder(
    global.config.hostname,
    global.config.port,
    global.config.maxConnections,
    torrent,
    pieces,
    pieceLen
  );
  seeder.execute();

  Torrent.prototype.pieceTracker = new Array(pieces.length).fill(0);
  Torrent.prototype.queue = new PriorityQueue();
  Torrent.prototype.downloaded = new Set();
  Torrent.prototype.emitter = new eventEmmiter();
  // Torrent.prototype.file = fs.openSync(process.cwd() + "/" + torrent.info.name, "w");
  Torrent.prototype.files = files;

  Torrent.prototype.connectedPeers = [];
  Torrent.prototype.unchokedMeList = []; //peers who have unchoked me - yet to add to list

  Torrent.prototype.interestedPeers = new Set();
  Torrent.prototype.chokedPeers = new Set();
  Torrent.prototype.unChokedPeers = new Set();
  Torrent.prototype.state = { uploadEvent: false, uploadStart: false };
  Torrent.prototype.isComplete = false;

  torrentFile.parse(torrent, (peers) => parseCallback(peers));
  const parseCallback = (peers) => {
    const allPeers = [];
    if (Torrent.prototype.connectedPeers.length > 10) {
      console.log("Enough Peers");
    }
    if (Torrent.prototype.isComplete) {
      console.log("Download is complete");
      return;
    }
    console.log("got the peers", peers);
    peers.forEach((peer) => {
      let connected = false;
      Torrent.prototype.connectedPeers.forEach((cp) => {
        if (connected) return;
        if (cp.info.ip === peer.ip) {
          connected = true;
        }
      });
      if (connected) return;
      allPeers.push(new Peer(peer, torrent, pieces, pieceLen));
    });
    allPeers.forEach((peer) => {
      peer.execute();
    });
    console.log(Torrent.prototype.connectedPeers.length, allPeers.length);
  };
};
if (require.main === module) {
  startTorrent(file, dest);
}

//---------------------------------------------------HTTP TRACKER-------------------------------------

// console.log(torrent.announce.toString("utf8"));
// console.log(torrent.info.toString("utf8"));
// console.log(torrentUtils.left(torrent));
// const infoHash = encodeURI(torrentUtils.getInfoHash(torrent));
// const myId = encodeURI(torrentUtils.myPeerId());
// const size = torrent.info.files
//   ? torrent.info.files.map((file) => file.length).reduce((a, b) => a + b)
//   : torrent.info.length;
// var myurl = `${torrent.announce.toString(
//   "utf8"
// )}?info_hash=${infoHash}&?peer_id=${myId}&port=6887&downloaded=0&left=${size}`;
// console.log(myurl);
// axios
//   .get(myurl)
//   .then((res) => console.log(res.data))
//   .catch((err) => console.log(err));

//--------------------------------------------------------------------------------------------------------
// Peer.prototype.pieces = pieces;
// Peer.prototype.pieceLen = pieceLen;
// Peer.prototype.pieceTracker = new Array(pieces.length).fill(0);
// Peer.prototype.downloaded = new Array(pieces.length).fill(0);
// Peer.prototype.file = fs.openSync(process.cwd() + "/" + torrent.info.name, "w");

// connection.Peer.prototype.downloaded = 0

// const axios = require("axios")
// let piecesCount = new Array(pieces.length).fill(0);

//----------------------------------------------------------------------------------------------------------
