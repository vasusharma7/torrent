const net = require("net");
const messages = require("./messages");
const fs = require("fs");
const crypto = require("crypto");
const { Torrent } = require("./torrent.js");

class Peer extends Torrent {
  constructor(peer, torrent, pieces, pieceLen) {
    super(pieces, pieceLen, torrent);
    this.myPieces = new Array(pieces.length).fill(0);
    this.myDownloads = new Set();
    this.torrent = torrent;
    this.socket = null;
    this.info = peer;
    this.handshake = false;
    this.buffer = Buffer.alloc(0);
    this.done = 0;
    this.current = -1;
    this.downloadedBuffer = Buffer.alloc(pieceLen);
    this.downloadedSize = 0;

    this.state = {
      choked: true,
      interested: false,
      amChoking: true,
      isInterested: false,
    };

    this.track = { start: 0, end: 0, speed: 0 };
    if (this.downloaded.size != 0 && !Torrent.prototype.uploadStart) {
      Torrent.prototype.uploadStart = true;
      this.emitter.emit("upload");
    }

    // if (this.downloaded.size === 0) {
    //   let sendHavesI = setInterval(() => {
    //     if (this.downloaded.size !== 0) {
    //       this.servePiece(this, {
    //         index: [...this.downloaded][0],
    //         begin: 0,
    //         length: 16384,
    //       });
    //       // clearInterval(sendHavesI);
    //     }
    //   }, 2000);
    // }
  }

  msgLen = (data) => {
    if (!this.handshake) {
      return 49 + data.readUInt8(0);
    } else {
      return 4 + data.readUInt32BE(0);
    }
  };

  execute = () => {
    this.socket = net.createConnection(
      { host: this.info.ip, port: this.info.port },
      () => {
        console.log("conected to a peer");
      }
    );

    this.socket.on("connect", () => {
      // setTimeout(this.sendHave, 4000);
      this.socket.write(messages.handshake(this.torrent));
    });

    this.socket.on("error", (err) => {
      let index = Torrent.prototype.connectedPeers.indexOf(this);
      if (index === -1) {
        console.log("Error in connection with a new Peer", this.info.ip);
        this.socket.end();
        // clg(error code  - generally timeout or epipe )
        return;
      }
      Torrent.prototype.connectedPeers.splice(index, 1);
      console.table(err);
      console.table({
        "connected peers": Torrent.prototype.connectedPeers.length,
      });
      // console.log(this.info.ip);
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
        // console.log("getting buffer",this.buffer.length,this.msgLen(this.buffer));
        this.parseData(this.buffer.slice(0, this.msgLen(this.buffer)));
        this.buffer = this.buffer.slice(this.msgLen(this.buffer));
        if (!this.handshake) {
          Torrent.prototype.connectedPeers.push(this);
          this.handshake = true;
        }
      }
    });
  };

  sendHave = () => {
    console.log("Sending Have Messages");
    if (this.downloaded.size !== 0) {
      for (let piece of this.downloaded) {
        this.socket.write(messages.have(piece));
      }
    }
  };
  parseData = (data) => {
    const parsed = messages.parseResponse(data, this.torrent);
    switch (parsed.type) {
      case "handshake":
        this.handleHandshake(parsed);
        break;
      case "bitfield":
        this.handleBitfield(parsed);
        break;
      case "piece":
        this.handlePiece(parsed);
        break;
      case "interested":
        this.handleInterested(parsed);
        break;
      case "request":
        this.handleRequest(parsed);
        break;
      case "have":
        this.handleHave(parsed);
        break;
      case "ignore":
        console.log("ignore - keep alive", parsed.id, parsed.len, this.info.ip);
        break;
      case "cancel":
        console.log("cancel", this.info.ip);
        break;
      case "unchoke":
        this.handleUnChoke(parsed);
        break;
      case "choke":
        this.handleChoke(parsed);
        break;
      default:
        console.log(parsed.type, parsed.id, parsed.len, this.info.ip);
        break;
    }
  };
  cacluateSpeed = () => {
    this.track.speed =
      this.downloadedBuffer.length / (this.track.end - this.track.start);
    // console.log("speed", this.track.speed);
  };
  handleHandshake = (parsed) => {
    // console.log("handshake", this.info.ip);
    // this.socket.write(messages.unChoke());
    this.socket.write(messages.interested());

    if (this.downloaded.size !== 0) {
      //send have and bitfield
      //yet to confirm
    }
  };

  handleBitfield = (parsed) => {
    console.log(
      "BITFIELD ",
      parsed.len,
      this.info.ip,
      parsed.payload.bitfield.length,
      this.pieces.length
    );

    const bitfield = parsed.payload.bitfield;
    for (let i = 0; i < this.pieces.length; i++) {
      this.pieceTracker[i] += parseInt(bitfield[i]);
      this.myPieces[i] += parseInt(bitfield[i]);
    }
  };

  handleHave = (parsed) => {
    const index = parseInt(parsed.payload.index);
    this.pieceTracker[index] += 1;
    this.myPieces[index] += 1;
  };

  handleUnChoke = (parsed) => {
    this.state.choked = false;
    console.log("You are unchoked");
    this.buildQueue();
    this.download();
  };

  handleChoke = (parsed) => {
    this.state.choked = true;
    console.log("You are choked by - ", this.info.ip);
    let ind = Torrent.prototype.connectedPeers.indexOf(this);
    Torrent.prototype.connectedPeers.splice(ind, 1);
    console.log("connected peers", Torrent.prototype.connectedPeers.length);
    console.log(this.info.ip);
    this.socket.end();
    //dont end the connection abrupty - add to amChoked list and wait for some time if the peers connect again ??
  };
  handleInterested = (parsed) => {
    this.state.interested = true;
    this.interestedPeers.add(this);
    console.log(
      "xxxxxxxxxxxxxxxxxxxxxxxxx-----------------SOMEONE IS INTERESTED----------------xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      parsed
    );
    // this.socket.write(messages.unChoke());
    if (this.state.amChoking === false && this.downloaded.size !== 0) {
      //send bitfield to the peer and wait for the request
      if (this.downloaded.size === 0) {
        let sendHavesI = setInterval(() => {
          if (this.downloaded.size !== 0) {
            this.sendHaves(this);
            clearInterval(sendHavesI);
          }
        }, 1000);
      }
    }
  };
  handleRequest = (parsed) => {
    console.log(
      "xxxxxxxxxxxxxxxxxxxxxxxxx-----------------SOMEONE IS REQUESTING----------------xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      parsed.payload
    );
    this.servePiece(this, parsed.payload);
  };
  savePiece = (parsed) => {
    let file = this.getFD(parsed.payload.index);
    let data =
      this.lastPiece == parsed.payload.index
        ? this.downloadedBuffer.slice(0, this.getLastPieceLen())
        : this.downloadedBuffer;
    let length = data.length;
    let offset = this.getFileOffset(parsed.payload.index);
    let multiple = offset + data.length > file.size;
    let data2 = null;
    let length2 = null;
    if (multiple) {
      console.log("multiple file boundary");
      length = file.size - offset;
      data2 = data.slice(length);
      length2 = offset + data.length - file.size;
      data = data.slice(0, length);
    }
    fs.write(file.fd, data, 0, length, offset, async (err, written, buffer) => {
      if (err) {
        console.log(err);
      } else {
        // console.log(written, buffer)
        // this.downloaded.add(parsed.payload.index);
        console.log("saved", parsed.payload.index, this.pieceLen, this.info.ip);
      }
    });
    //do this by considering the next file length !! and file descriptor
    //next file length is important as the extra length in the data received of a peice may traverse/encompass various files
    //test file TempleOS.iso
    if (multiple) {
      fs.write(
        this.files[file.index + 1].fd,
        data2,
        0,
        length2,
        0,
        async (err, written, buffer) => {
          if (err) {
            console.log(err);
          } else {
            // console.log(written, buffer)
            console.log(data2, length2);
          }
        }
      );
    }
  };
  handlePiece = (parsed) => {
    this.track.end = new Date().getTime();
    this.cacluateSpeed();
    console.log("GOT A PIECE !! ALERT !!", this.info.ip);
    const offset = parsed.payload.begin;
    parsed.payload.block.copy(this.downloadedBuffer, offset);
    this.downloadedSize += parsed.payload.block.length;
    if (
      this.lastPiece === parsed.payload.index
        ? this.downloadedSize === this.getLastPieceLen()
        : this.downloadedSize === this.pieceLen
    ) {
      console.log("A Piece is completed", parsed.payload.index);
      if (
        this.verifyChecksum(
          this.downloadedBuffer,
          this.pieces[parsed.payload.index],
          parsed.payload.index
        )
      ) {
        this.downloaded.add(parsed.payload.index);
        this.savePiece(parsed);
        this.myDownloads.add(parsed.payload.index);
        if (!Torrent.prototype.uploadStart) {
          this.emitter.emit("upload");
          Torrent.prototype.uploadStart = true;
        }
      } else {
        console.log("checksum failed");
      }
      this.done = 0;
      this.downloadedSize = 0;
      this.store = this.downloadedBuffer;
      this.downloadedBuffer = Buffer.alloc(this.pieceLen);
      this.current = -1;
    }
    this.download();
  };
  download = () => {
    if (this.state.choked) {
      console.log("Download, choked");
      return;
    }
    this.showProgress();
    this.getStatistics();
    // await new Promise(r => setTimeout(r, 4000));
    console.log([
      { size: this.downloaded.size },
      { size: this.queue.size() },
      { size: this.pieces.length },
    ]);
    if (
      this.queue.size() === 0 &&
      this.downloaded.size === this.pieces.length
    ) {
      console.log("Download Complete !!");
      // console.log(Torrent.prototype.top4I, Torrent.prototype.optChI);
      clearInterval(Torrent.prototype.top4I);
      clearInterval(Torrent.prototype.optChI);
      this.closeConnections();
      return;
    } else if (this.downloaded.size == 112) {
      for (let i = 0; i < this.pieces.length; i++) {
        console.log("has", i + 1, this.downloaded.has(i));
      }
    }

    if (this.current === -1) {
      const store = [];
      let found = 0;
      let target = {};

      console.log(this.info.ip, this.state.choked);
      if (!this.queue.size()) {
        console.log("No pieces left to download");
        console.log(
          this.downloaded.size === this.pieces.length,
          this.downloaded.size,
          this.pieces.length
        );
        //to be tested
        setTimeout(this.download, 10000);
        return;
      }
      while (!found) {
        console.log("Queue Before - ", this.queue.size());
        if (!this.queue.isEmpty()) target = this.queue.pop();
        else {
          console.log("queue is empty");
          // askForPeers();
          return;
        }
        console.log("EXTRACTED", target, this.queue.size());
        if (this.myPieces[target.index] === 0) {
          store.push(target);
        } else {
          found = 1;
          while (store.length) this.queue.push(store.pop());
        }
      }
      this.current = target.index;
      console.log("Queue After - ", this.queue.size());
    }

    if (this.downloaded.has(this.current)) {
      console.log("This piecee is already downloaded");
      this.current = -1;
      this.download();
      return;
    }
    let rem = this.pieceLen;
    if (this.current === this.pieces.length - 1) {
      console.log(
        "------------------------------------------------------------------------------"
      );
      rem = this.getFileLength(-1) - this.pieceLen * (this.pieces.length - 1);
      console.log("LAST PIECE", rem, this.getFileLength(-1));
      console.log(
        "------------------------------------------------------------------------------"
      );
    }
    let length = Math.min(16384, rem, rem - this.done);
    if (length === rem - this.done) {
      console.log("LEFT IS - ", rem - this.done);
    }

    if (this.done < rem) {
      this.socket.write(
        messages.request({
          index: this.current,
          begin: this.done,
          length: length,
        })
      );
      this.track.start = new Date().getTime();
      this.done += length;
      console.log(this.current, this.done);
      console.log("Queue - ", this.queue.size());
    }
  };
}

module.exports = {
  Peer,
};
