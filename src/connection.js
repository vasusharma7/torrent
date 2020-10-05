const net = require('net');
const messages = require("./utils/messages");
var connectedPeers = [];
const connect = (peer, torrent) => {
    try {
        const peerSocket = net.createConnection({ host: peer.ip, port: peer.port }, () => {
            console.log("conected to a peer")
            connectedPeers.push(peer)
        });
        peerSocket.on("connect", () => {
            peerSocket.write(messages.handshake(torrent))
        })
        peerSocket.on("error", (err) => {
            console.log(err);
            // console.log(peer)
        })
        peerSocket.on("data", (data) => {
            if (messages.parseHandshake(data, torrent)) {
                peerSocket.write(messages.interested())
            }

        })
    }
    catch (err) {
        console.log(err)
        console.log("Something went wrong buddy", peer)
    }
}

module.exports = {
    connect
}