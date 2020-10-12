const net = require("net");
const messages = require("./utils/messages");
const fs = require("fs");
const crypto = require("crypto");
const { parseBitfield } = require("./utils/messages");

// class Piece {
//     constuctor(index, count) {
//         this.downloaded = false;
//         this.index = index;
//         this.have = 0;
//         this.count = count;
//     }
// }

class Torrent {
  constructor(pieces, pieceLen, torrent) {
    this.pieces = pieces;
    this.pieceLen = pieceLen;
    this.torrent = torrent;
  }
  buildQueue(current) {
    if (!this.queue.isEmpty()) {
      while (!this.queue.isEmpty()) {
        this.queue.pop();
      }
    }
    this.pieceTracker.forEach((info, key) => {
      if (isNaN(info) || this.downloaded[key] || info == 0 || key === current) {
        console.log("discarded", info, key, this.pieceTracker.length);
        return;
      } else this.queue.push({ index: key, count: info });
    });
    this.download();

    // while (!this.queue.isEmpty()) {
    //     let temp = this.queue.pop();
    //     console.log('abcd', temp.count, temp.index);
    // }
  }
  verifyChecksum = (buffer, pieceHash) => {
    const crypted = crypto.createHash("sha1").update(buffer).digest();
    console.log(crypted);
    console.log(buffer);
    if (!Buffer.compare(crypted, pieceHash)) return true;
    return false;
  };
  getFD = (index) => {
    let downloaded = index * this.pieceLen;
    let offset = 0;
    for (let file of this.files) {
      offset += file.size;
      if (offset >= downloaded) {
        console.log(file.fd);
        return file.fd;
      }
    }
  };
}
class Peer extends Torrent {
  constructor(peer, torrent, pieces, pieceLen) {
    super(pieces, pieceLen, torrent);
    this.myPieces = new Array(pieces.length).fill(0);
    this.torrent = torrent;
    this.socket = null;
    this.info = peer;
    this.handshake = false;
    this.buffer = Buffer.alloc(0);
    this.done = 0;
    this.current = -1;
    this.downloadedBuffer = Buffer.alloc(pieceLen);
    this.downloadedSize = 0;
  }
  msgLen = (data) => {
    if (!this.handshake) {
      return 49 + data.readUInt8(0);
    } else {
      return 4 + data.readUInt32BE(0);
    }
  };
  execute = (callback) => {
    this.socket = net.createConnection(
      { host: this.info.ip, port: this.info.port },
      () => {
        console.log("conected to a peer");
        callback(this);
      }
    );

    this.socket.on("connect", () => {
      this.socket.write(messages.handshake(this.torrent));
    });
    this.socket.on("error", (err) => {
      var index = Torrent.prototype.connectedPeers.indexOf(this);
      Torrent.prototype.connectedPeers.splice(index, 1);
      console.log(Torrent.prototype.connectedPeers.length);
      console.log(err);
      console.log(this.info.ip);
      this.socket.end();
      return;
    });
    this.socket.on("data", (data) => {
      this.buffer = Buffer.concat([this.buffer, data]);
      // console.log(this.buffer.length)
      while (
        this.buffer.length > 4 &&
        this.buffer.length >= this.msgLen(this.buffer)
      ) {
        console.log(this.buffer.length, this.msgLen(this.buffer));
        this.parseData(this.buffer.slice(0, this.msgLen(this.buffer)));
        this.buffer = this.buffer.slice(this.msgLen(this.buffer));
        this.handshake = true;
      }
    });
  };

  parseData = (data) => {
    const parsed = messages.parseResponse(data, this.torrent);
    switch (parsed.type) {
      case "handshake":
        console.log("handshake", this.info.ip);
        // this.socket.write(messages.unChoke())
        // this.socket.write(messages.interested())
        break;
      case "bitfield":
        console.log("BITFIELD ", parsed.len, this.info.ip);
        const bitfield = parsed.payload.bitfield;
        for (let i = 0; i < this.pieces.length; i++) {
          this.pieceTracker[i] += parseInt(bitfield[i]);
          this.myPieces[i] += parseInt(bitfield[i]);
        }
        // this.buildQueue();
        // this.download()
        // console.log(Peer.prototype.pieceTracker)
        // this.download()
        break;
      case "piece":
        // parsed.payload.index, parsed.payload.begin, parsed.payload.block
        console.log("GOT A PIECE !! ALERT !!", this.info.ip);
        const offset = parsed.payload.begin;
        parsed.payload.block.copy(this.downloadedBuffer, offset);
        this.downloadedSize += parsed.payload.block.length;
        if (this.downloadedSize == this.pieceLen) {
          console.log("A Piece is completed");
          if (
            this.verifyChecksum(
              this.downloadedBuffer,
              this.pieces[parsed.payload.index]
            )
          ) {
            let fd = this.getFD(parsed.payload.index);
            let data = this.downloadedBuffer;
            fs.write(
              fd,
              data,
              0,
              this.downloadedBuffer.length,
              parsed.payload.index * this.pieceLen,
              async (err, written, buffer) => {
                if (err) {
                  console.log(err);
                } else {
                  // console.log(written, buffer)
                  this.downloaded[parsed.payload.index] = 1;
                  console.log(data, this.pieceLen, this.info.ip);
                }
              }
            );
          } else {
            console.log("checksum failed");
          }

          // fs.write(this.file, parsed.payload.block, 0, parsed.payload.block.length, offset, async (err, written, buffer) => {
          //     if (err) {
          //         console.log(err);
          //     }
          //     else {
          //         console.log(written, buffer)
          //         console.log(this.downloadedBuffer, this.pieceLen, this.info.ip)

          //     }
          // })
          this.done = 0;
          this.downloadedSize = 0;
          this.downloadedBuffer = Buffer.alloc(this.pieceLen);
          this.current = -1;
        }
        this.download();

        break;
      case "have":
        // this.pieceTracker[parseInt(parsed.payload.index)] = (parseInt(this.pieceTracker.charAt(parseInt(parsed.payload.index))) + 1).toString();
        console.log("have", parsed.payload.index, this.info.ip);
        const index = parseInt(parsed.payload.index);
        this.pieceTracker[index] += 1;
        this.myPieces[index] += 1;
        this.buildQueue(this.current);
        break;
      case "ignore":
        console.log("ignore", parsed.id, parsed.len, this.info.ip);
        break;
      case "request":
        console.log("request", this.info.ip);
        break;
      case "cancel":
        console.log("cancel", this.info.ip);
        break;
      case "unchoke":
        console.log("You are unchoked");
        this.buildQueue(this.current);
        this.download();
        break;
      case "choke":
        console.log("You are choked");
        break;
      default:
        console.log(parsed.type, parsed.id, parsed.len, this.info.ip);
        break;
    }
  };

  download = () => {
    // await new Promise(r => setTimeout(r, 4000));
    if (this.current == -1) {
      const store = [];
      let found = 0;
      let target = {};
      do {
        if (!this.queue.isEmpty()) target = this.queue.pop();
        else {
          console.log("queue is empty");
          return;
        }
        console.log(
          "EXTRACTED",
          target,
          this.queue.size(),
          this.myPieces,
          this.myPieces[target.index]
        );
        if (this.myPieces[target.index] == 0) {
          store.push(target);
        } else {
          found = 1;
          while (store.length) this.queue.push(store.pop());
        }
      } while (!found);
      this.current = target.index;
    }

    let rem = this.pieceLen;
    let length = Math.min(16384, rem);
    this.socket.write(
      messages.request({
        index: this.current,
        begin: this.done,
        length: length,
      })
    );
    console.log(this.current, this.done);
    this.done += length;
    if (this.done < this.pieceLen) {
      console.log("pieceLen", this.pieceLen, this.queue.size());
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
  };
}

module.exports = {
  Peer,
  Torrent,
};
