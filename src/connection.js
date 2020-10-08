const net = require('net');
const messages = require("./utils/messages");
const fs = require("fs");
const process = require("process");


class Peer {
    constructor(peer, torrent, pieces, piecesLen) {
        this.pieces = []
        this.pieceTracker = []
        this.torrent = torrent
        this.socket = null;
        this.info = peer;
    }
    execute = (callback) => {
        this.socket = net.createConnection({ host: this.info.ip, port: this.info.port }, () => {
            console.log("conected to a peer")
            callback(this)
        });

        this.socket.on("connect", () => {
            this.socket.write(messages.handshake(this.torrent))
        })
        this.socket.on("error", (err) => {
            // console.log(err);
            // console.log(peer)
        })
        this.socket.on("data", (data) => {
            const parsed = messages.parseResponse(data, this.torrent)
            switch (parsed.type) {
                case "handshake":
                    console.log("handshake")
                    this.socket.write(messages.interested())
                    this.socket.write(messages.unChoke())
                    break;
                case "bitfield":
                    this.pieceTracker = parsed.payload.bitfield;
                    for (let i = 0; i < Peer.prototype.pieces.length; i++) {
                        Peer.prototype.pieceTracker[i] += parseInt(this.pieceTracker[i])
                    }
                    // console.log(Peer.prototype.pieceTracker)
                    this.download();
                    break;
                case "piece":
                    // parsed.payload.index, parsed.payload.begin, parsed.payload.block
                    console.log("GOT A PIECE !! ALERT !!")
                    fs.open(process.cwd() + "/" + this.torrent.info.name, "w", (err, file) => {
                        fs.write(file, parsed.payload.block, parsed.payload.index * Peer.prototype.piecesLen + parsed.payload.begin, "utf-8", async (err, written, buffer) => {
                            if (err) {
                                console.log(err);
                            }
                            else {
                                console.log(written, buffer)
                                await new Promise((res) => setTimeout(res, 2000))
                            }
                        })
                    })
                    break;
                case "have":
                    console.log("have")
                case 'ignore':
                    console.log('ignore', parsed.id, parsed.len)
                    break;
                case "request":
                    console.log("request");
                    break;
                case "cancel":
                    console.log("cancel");
                    break;
                default:
                    console.log("any other data", parsed.id, parsed.len);
            }


        })
    }
    download = () => {
        this.socket.write(messages.request({ index: 0, begin: 0, length: 16384 }))
        // return
        // Peer.prototype.pieceTracker.indexOf(Math.min(...Peer.prototype.pieceTracker));
        // let index = 0, begin = 0, length = 0, chunk = 0, offset = 0;
        // let rem = Peer.prototype.piecesLen;
        // for (let i = 0; i < Peer.prototype.pieceTracker.length; i += 1) {
        //     if (!Peer.prototype.downloaded[i]) {
        //         Peer.prototype.downloaded[i] = 1;
        //         while (rem > 0) {
        //             console.log(rem)
        //             offset = 0;
        //             chunk = Math.min(16384, rem)
        //             rem -= chunk
        //             index = i;
        //             begin = offset;
        //             length = chunk;
        //             this.socket.write(messages.request({ index, begin, length }))
        //             offset += chunk;
        //         }
        //     }
        // }

    }
}


module.exports = {
    Peer
}