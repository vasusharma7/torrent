const torrentFile = require("./src/torrent-file/parse-torrent-file");
const torrentUtils = require("./src/utils/torrent-file-utils")
const connection = require("./src/connection");
const torrent = torrentFile.init(process.argv[2])
// const axios = require("axios")
torrentFile.parse(torrent, (parsed) => {
    // console.log(torrent)
    console.log("got the peers", parsed.peers);
    for (let peer of parsed.peers) {
        connection.connect(peer, torrent)
    }
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
