const torrentFile = require("./src/torrent-file/parse-torrent-file");
const torrentUtils = require("./src/utils/torrent-file-utils")
const connection = require("./src/connection");
const { torrent, pieces, pieceLen } = torrentFile.init(process.argv[2])
const fs = require("fs");

connection.Peer.prototype.pieces = pieces;
connection.Peer.prototype.pieceLen = pieceLen;
connection.Peer.prototype.pieceTracker = new Array(pieces.length).fill(0);
connection.Peer.prototype.downloaded = new Array(pieces.length).fill(0);
connection.Peer.prototype.file = fs.openSync(process.cwd() + "/" + torrent.info.name, "w");

// connection.Peer.prototype.downloaded = 0

// const axios = require("axios")
// let piecesCount = new Array(pieces.length).fill(0);

torrentFile.parse(torrent, (parsed) => {
    console.log("got the peers", parsed.peers);
    const allPeers = []
    const connectedPeers = []
    parsed.peers.forEach(peer => {
        allPeers.push(new connection.Peer(peer, torrent, pieces, pieceLen))
    })

    allPeers.forEach(peer => {
        peer.execute((resp) => {
            connectedPeers.push(resp)
        })
    })
    // allPeers[3].execute((resp) => {
    //     connectedPeers.push(resp)
    // })



});



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
