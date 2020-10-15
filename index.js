const process = require("process");
const torrentFile = require("./src/torrent-file/parse-torrent-file");
const torrentUtils = require("./src/utils/torrent-file-utils");
const { Peer, Torrent } = require("./src/connection");
const { PriorityQueue } = require("./src/utils/priority-queue");
const file = process.argv[2];
if (!file) {
  console.log("Please provide a torrent file in the arguement");
  process.exit();
}
const { torrent, pieces, pieceLen, files } = torrentFile.init(file);

Torrent.prototype.pieceTracker = new Array(pieces.length).fill(0);
Torrent.prototype.queue = new PriorityQueue();
Torrent.prototype.downloaded = new Set();
// Torrent.prototype.file = fs.openSync(process.cwd() + "/" + torrent.info.name, "w");
Torrent.prototype.files = files;
Torrent.prototype.connectedPeers = [];

const allPeers = [];
const PeerBuffer = [];
torrentFile.parse(torrent, (peers) => {
  if (Torrent.prototype.connectedPeers.length > 10) {
    // PeerBuffer.push(peers);
    console.log("Enough Peers");
    // return;
  }
  console.log("got the peers", peers);
  peers.forEach((peer) => {
    allPeers.push(new Peer(peer, torrent, pieces, pieceLen));
  });
  allPeers.forEach((peer) => {
    peer.execute((resp) => {
      Torrent.prototype.connectedPeers.push(resp);
    });
  });
  console.log(Torrent.prototype.connectedPeers.length, allPeers.length);
});

//--------------------------------------------------------------------------------------------------------------

// console.log(torrent.announce.toString("utf8"))
// console.log(torrent.info.toString("utf8"))
// console.log(torrentUtils.left(torrent))
// const size = torrent.info.files ?
//     torrent.info.files.map(file => file.length).reduce((a, b) => a + b) :
//     torrent.info.length;
// var myurl = `${torrent.announce.toString("utf8")}?info_hash=${torrentUtils.getInfoHash(torrent)}&?peer_id=${torrentUtils.myPeerId()}&port=6881&downloaded=${0}&left=${size}`;
// myurl = encodeURI(myurl)
// console.log(myurl)
// axios.get(myurl).then(res => console.log(res.data)).catch(err => console.log(err))

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
