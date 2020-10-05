const fs = require("fs");
const tracker = require("./tracker");
const bencode = require("bencode")
const process = require("process")
module.exports.init = (filename) => {
    const torrent = bencode.decode(fs.readFileSync(filename));
    // console.log(torrent.announce.toString("utf8"))
    console.log("Announce: ", torrent.announce.toString("utf8"));
    for (let file of torrent.info.files) {
        const name = file.path.toString("utf8")
        if (!fs.existsSync(name)) {
            fs.open(process.cwd() + "/" + name, 'w', function (err, file) {
                if (err) throw err;
                console.log('created new file');
            });
        }
    }
    console.log(torrent.info)
    return torrent;
}
module.exports.parse = (torrent, callback) => {
    var info = {}
    tracker.getPeers(torrent, (peers) => {
        info["peers"] = peers;
        callback(info)
    });
}
