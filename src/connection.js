const net = require('net');
const messages = require("./utils/messages");
const fs = require("fs");
const process = require("process");
const { PriorityQueue } = require("./utils/priority-queue");
class Piece {

    constuctor(index, count) {
        this.downloaded = false;
        this.index = index;
        this.have = 0;
        this.count = count;
    }
}
const numericCompare = (a, b) => (a > b ? 1 : a < b ? -1 : 0);

const comparator = (a, b) => {
    const x = numericCompare(a.count, b.count);
    const y = numericCompare(a.index, b.index);
    return x ? x : y;
};

class Torrent {
    constructor(pieces,
        pieceLen,
        torrent) {
        this.pieces = pieces;
        this.pieceLen = pieceLen;
        this.pieceTracker = new Array(pieces.length).fill(0);
        this.downloaded = new Array(pieces.length).fill(0);
        this.torrent = torrent;
    }
}
    Torrent.prototype.queue = new PriorityQueue(comparator);
class Peer extends Torrent {
    constructor(peer, torrent, pieces,
        pieceLen) {
        super(pieces,
            pieceLen,
            torrent);
        this.pieces = []
        this.pieceTracker = []
        this.torrent = torrent
        this.socket = null;
        this.info = peer;
        this.handshake = false;
        this.buffer = Buffer.alloc(0);
        this.done = 0;
        this.next = 0;
    }
    msgLen = (data) => {
        if (!this.handshake) {
            return 49 + data.readUInt8(0);;
        }
        else {
            return 4 + data.readUInt32BE(0);
        }

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
            // console.log(this.info.ip)
            // this.socket.end()
        })
        this.socket.on("data", (data) => {
            this.buffer = Buffer.concat([this.buffer, data]);
            // console.log(this.buffer.length)
            while (this.buffer.length >= 4 && this.buffer.length >= this.msgLen(this.buffer)) {
                console.log(this.buffer.length, this.msgLen(this.buffer))
                this.parseData(this.buffer.slice(0, this.msgLen(this.buffer)))
                this.buffer = this.buffer.slice(this.msgLen(this.buffer));
                this.handshake = true;
            }
        })

    }

    parseData = (data) => {
        const parsed = messages.parseResponse(data, this.torrent)
        switch (parsed.type) {
            case "handshake":
                console.log("handshake", this.info.ip)
                // this.socket.write(messages.unChoke())
                // this.socket.write(messages.interested())
                break;
            case "bitfield":
                console.log("MY torrent ", parsed.len, this.info.ip);
                this.pieceTracker = parsed.payload.bitfield;
                for (let i = 0; i < Peer.prototype.pieces.length; i++) {
                    Peer.prototype.pieceTracker[i] += parseInt(this.pieceTracker[i])
                }
                // console.log(Peer.prototype.pieceTracker)
                // this.download()
                break;
            case "piece":
                // parsed.payload.index, parsed.payload.begin, parsed.payload.block
                console.log("GOT A PIECE !! ALERT !!", this.info.ip)
                fs.write(Peer.prototype.file, parsed.payload.block, 0, parsed.payload.block.length, parsed.payload.index * Peer.prototype.pieceLen + parsed.payload.begin, async (err, written, buffer) => {
                    if (err) {
                        console.log(err);
                    }
                    else {
                        console.log(written, buffer)
                        await new Promise((res) => setTimeout(res, 2000))
                    }
                })
                this.download()
                break;
            case "have":
                // this.pieceTracker[parseInt(parsed.payload.index)] = (parseInt(this.pieceTracker.charAt(parseInt(parsed.payload.index))) + 1).toString();
                console.log("have", parsed.payload.index, this.info.ip)
                Peer.prototype.pieceTracker[parseInt(parsed.payload.index)] += 1
                // this.download();
                break;
            case 'ignore':
                console.log('ignore', parsed.id, parsed.len, this.info.ip)
                break;
            case "request":
                console.log("request", this.info.ip);
                break;
            case "cancel":
                console.log("cancel", this.info.ip);
                break;
            case "unchoke":
                // this.buildQueue();
                console.log("You are unchoked")
                this.download()
                break;
            case "choke":
                console.log("You are choked")
                break;
            default:
                console.log(parsed.type, parsed.id, parsed.len, this.info.ip);
                break;
        }

    }

    download = async () => {
        // await new Promise(r => setTimeout(r, 4000));
        console.log("test");
        let rem = Peer.prototype.pieceLen;
        let length = Math.min(16384, rem);
        this.socket.write(messages.request({ index: this.next, begin: this.done, length: length }))
        console.log(this.next, this.done)
        this.done += length
        if (this.done >= Peer.prototype.pieceLen) {
            this.next += 1;
            this.done = 0;
        }

        // Peer.prototype.pieceTracker.indexOf(Math.min(...Peer.prototype.pieceTracker));
        // let index = 0, begin = 0, length = 0, chunk = 0, offset = 0;
        // for (let i = 0; i < Peer.prototype.pieceTracker.length; i += 1) {
        //     let rem = Peer.prototype.pieceLen;
        //     // cons`ole.log((Peer.prototype.downloaded[i] == 0), (Peer.prototype.pieceTracker[i] != 0))
        //     if ((Peer.prototype.downloaded[i] == 0) && (Peer.prototype.pieceTracker[i] != 0)) {
        //         console.log("-------IN DOWNLOAD-------", this.info.ip)
        //         // await new Promise(r => setTimeout(r, 10000))
        //         Peer.prototype.downloaded[i] = 1;
        //         offset = 0;
        //         while (rem > 0) {
        //             chunk = Math.min(16384, rem)
        //             rem -= chunk
        //             index = i;
        //             begin = offset;
        //             length = chunk;
        //             this.socket.write(messages.request({ index, begin, length }))
        //             offset += chunk;
        //         }
        //         break;
        //     }
        //     return;
        // }

    }
}


module.exports = {
    Peer
}