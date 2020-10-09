const fs = require("fs");
const tracker = require("./tracker");
const bencode = require("bencode")
const process = require("process");
const { off } = require("process");
module.exports.init = (filename) => {
    const torrent = bencode.decode(fs.readFileSync(filename));
    // console.log(torrent.announce.toString("utf8"))
    console.log("Announce: ", torrent.announce.toString("utf8"));
    console.log(torrent)
    // if (torrent.info.files) {
    //     if (!fs.existsSync(torrent.info.name)) {
    //         fs.mkdirSync(torrent.info.name)
    //     }
    //     for (let file of torrent.info.files) {
    //         const name = file.path.toString("utf8")
    //         console.log(name)
    //         if (!fs.existsSync(name)) {
    //             fs.open(process.cwd() + "/" + torrent.info.name + "/" + name, 'w', function (err, file) {
    //                 if (err) throw err;
    //                 console.log('created new file');
    //             });
    //         }
    //     }
    // }
    // else {
    //     fs.open(process.cwd() + "/" + torrent.info.name, 'w', function (err, file) {
    //         if (err) throw err;
    //         console.log('created new file');
    //     });
    // }
    const peiceLen = torrent.info.length ? torrent.info.length : torrent.info['piece length']
    // console.log(torrent.info['piece length'])
    let pieces = [];
    const pieceHash = torrent.info.pieces
    for (let offset = 0; offset < pieceHash.length; offset += 20) {
        pieces.push(pieceHash.slice(offset, offset + 20))
    }
    // console.log(torrent.info.files[0].path.toString())
    return { torrent: torrent, pieces: pieces, pieceLen: peiceLen };
}
module.exports.parse = (torrent, callback) => {
    var info = {}
    tracker.getPeers(torrent, (peers) => {
        info["peers"] = peers;
        callback(info)
    });
}
