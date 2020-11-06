require("./config");
const process = require("process");
const torrentFile = require("./parse-torrent-file");
const Seeder = require("./seed");
const { Peer } = require("./peer");
const { Torrent, initTorrent } = require("./torrent");
const { exec } = require("../ssh-tunnel/shell");

// const file = process.argv[2];
// const dest = process.argv[3];

// const torrentUtils = require("./src/torrent-file-utils");
// const axios = require("axios");

module.exports.startTorrent = (
  file,
  dest,
  uspeed = -1,
  dspeed = -1,
  transport = null
) => {
  console.log("Starting SSH-Tunnel...");
  exec(
    "ssh -i ./ssh-tunnel/eagle_nest.pem -R 5000:localhost:6777 -N ubuntu@18.225.11.191",
    function (err) {
      console.log("executed test");
    }
  );
  console.log(
    "Port Forwarding enabled on ",
    global.config.ip + ":" + global.config.port
  );
  if (!file) {
    if (global.config.debug)
      console.log("Please provide a torrent file in the arguement");
    process.exit();
  }
  if (!dest) {
    dest = ".";
  }
  Torrent.prototype.transport = transport;
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
  initTorrent(files, pieces, uspeed, dspeed);

  torrentFile.parse(torrent, (peers) => parseCallback(peers));
  const parseCallback = (peers) => {
    const allPeers = [];
    if (Torrent.prototype.connectedPeers.length > 10) {
      if (global.config.debug) console.log("Enough Peers");
    }
    if (Torrent.prototype.isComplete) {
      if (global.config.debug) console.log("Download is complete");
      return;
    }
    if (global.config.debug) console.log("got the peers", peers);
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
    if (global.config.debug)
      console.log(Torrent.prototype.connectedPeers.length, allPeers.length);
  };
  // parseCallback([{ ip: "127.0.0.1", port: "6777" }]);
  // parseCallback([{ ip: "18.225.11.191", port: "6777" }]);
};
if (require.main === module) {
  startTorrent(file, dest);
}

//---------------------------------------------------HTTP TRACKER-------------------------------------

// if(global.config.debug)console.log(torrent.announce.toString("utf8"));
// if(global.config.debug)console.log(torrent.info.toString("utf8"));
// if(global.config.debug)console.log(torrentUtils.left(torrent));
// const infoHash = encodeURI(torrentUtils.getInfoHash(torrent));
// const myId = encodeURI(torrentUtils.myPeerId());
// const size = torrent.info.files
//   ? torrent.info.files.map((file) => file.length).reduce((a, b) => a + b)
//   : torrent.info.length;
// var myurl = `${torrent.announce.toString(
//   "utf8"
// )}?info_hash=${infoHash}&?peer_id=${myId}&port=6887&downloaded=0&left=${size}`;
// if(global.config.debug)console.log(myurl);
// axios
//   .get(myurl)
//   .then((res) => if(global.config.debug)console.log(res.data))
//   .catch((err) => if(global.config.debug)console.log(err));

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
