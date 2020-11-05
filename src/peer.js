const net = require("net");
const messages = require("./messages");
const fs = require("fs");
const crypto = require("crypto");
const { Torrent } = require("./torrent.js");
const { set } = require("shelljs");

class Peer extends Torrent {
  constructor(peer, torrent, pieces, pieceLen, socket = null) {
    super(pieces, pieceLen, torrent);
    this.myPieces = new Array(pieces.length).fill(0);
    this.myDownloads = new Set();
    this.torrent = torrent;
    this.socket = socket;
    this.info = peer;
    this.handshake = false;
    this.buffer = Buffer.alloc(0);
    this.done = 0;
    this.current = -1;
    this.downloadedBuffer = Buffer.alloc(pieceLen);
    this.downloadedSize = 0;

    this.client = !!socket;

    this.state = {
      turtled: false,
      choked: true,
      interested: false,
      amChoking: true,
      isInterested: false,
    };

    this.track = { start: 0, end: 0, speed: 0, lastSpeed: 0 };
    this.bill = { speed: 0, lastSpeed: 0 };
    if (this.downloaded.size != 0 && !Torrent.prototype.state.uploadStart) {
      Torrent.prototype.state.uploadStart = true;
      this.emitter.emit("upload");
    }
    //check this out
    this.speedTimer = setTimeout(() => {
      if (this.track.lastSpeed == this.track.speed && this.speed != 0) {
        Torrent.prototype.limitDSpeed = false;
        this.track.speed = 0;
        this.showSpeed();
      }
    }, 10000);

    // if (this.downloaded.size === 0) {
    //   let sendHavesI = setInterval(() => {
    //     if (this.downloaded.size !== 0) {
    //       this.servePiece(this, {
    //         index: [...this.downloaded][0],
    //         begin: 0,
    //         length: 8192,
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
    if (this.socket === null) {
      this.socket = net.createConnection(
        { host: this.info.ip, port: this.info.port },
        () => {
          if (global.config.debug) console.log("conected to a peer");
        }
      );

      this.socket.on("connect", () => {
        // setTimeout(this.sendHave, 4000);
        this.socket.write(messages.handshake(this.torrent));
      });
    } else {
      if (global.config.debug) console.log("I am already Connected Peer");
    }

    this.socket.on(
      "error",
      function (err) {
        let index = Torrent.prototype.connectedPeers.indexOf(this);
        if (index === -1) {
          if (global.config.debug)
            console.log("Error in connection with a new Peer", this.info.ip);
          this.socket.destroy();
          // clg(error code  - generally timeout or epipe )
          return;
        }
        Torrent.prototype.connectedPeers.splice(index, 1);
        Torrent.prototype.chokedPeers.delete(this);
        Torrent.prototype.unChokedPeers.delete(this);

        if (global.config.debug) console.table(err);
        if (global.config.debug)
          console.table({
            "connected peers": Torrent.prototype.connectedPeers.length,
          });
        // if(global.config.debug)console.log(this.info.ip);
        this.socket.end();
        return;
      }.bind(this)
    );
    this.socket.on("timeout", function () {
      if (global.config.debug) console.log("Socket timed out !");
      socket.end("Timed out!");
    });
    this.socket.on(
      "close",
      function (error) {
        var bread = this.socket.bytesRead;
        var bwrite = this.socket.bytesWritten;
        if (global.config.debug) console.log("Bytes read : " + bread);
        if (global.config.debug) console.log("Bytes written : " + bwrite);
        if (global.config.debug) console.log("Socket closed!");
        if (error) {
          if (global.config.debug)
            console.log("Socket was closed coz of transmission error", error);
        }
      }.bind(this)
    );

    this.socket.on("data", (data) => {
      try {
        if (this.client == true) {
          if (global.config.debug)
            console.log("I am already a client yaar", data);
        }
        this.buffer = Buffer.concat([this.buffer, data]);
        // if(global.config.debug)console.log(this.buffer.length)
        while (
          this.buffer.length > 4 &&
          this.buffer.length >= this.msgLen(this.buffer)
        ) {
          // if(global.config.debug)console.log("getting buffer",this.buffer.length,this.msgLen(this.buffer));
          this.parseData(this.buffer.slice(0, this.msgLen(this.buffer)));
          this.buffer = this.buffer.slice(this.msgLen(this.buffer));
          if (!this.handshake) {
            Torrent.prototype.connectedPeers.push(this);
            if (global.config.electron) {
              let data = [];
              this.connectedPeers.forEach((peer) =>
                data.push({
                  info: peer.info,
                })
              );
              Torrent.prototype.transport("t-peers", data);
            }
            this.handshake = true;
          }
        }
      } catch (err) {
        if (global.config.debug) console.log("Data read error", err);
      }
    });
  };

  sendHave = () => {
    if (global.config.debug) console.log("Sending Have Messages");
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
        if (global.config.debug)
          console.log(
            "ignore - keep alive",
            parsed.id,
            parsed.len,
            this.info.ip
          );
        break;
      case "cancel":
        if (global.config.debug) console.log("cancel", this.info.ip);
        break;
      case "unchoke":
        this.handleUnChoke(parsed);
        break;
      case "choke":
        this.handleChoke(parsed);
        break;
      default:
        if (global.config.debug)
          console.log(parsed.type, parsed.id, parsed.len, this.info.ip);
        break;
    }
  };
  calcuateSpeed = () => {
    this.track.lastSpeed =
      this.track.speed == 0 ? this.track.lastSpeed : this.track.speed;
    this.track.speed = Math.max(
      0,
      this.downloadedBuffer.length / (this.track.end - this.track.start)
    );

    this.showSpeed();
    // if(global.config.debug)console.log("speed", this.track.speed);
  };
  handleHandshake = (parsed) => {
    // if(global.config.debug)console.log("handshake", this.info.ip);
    // this.socket.write(messages.unChoke());
    if (parsed) {
      if (this.client) {
        let is_kernel_buffer_full = this.socket.write(
          messages.handshake(this.torrent)
        );
        // checkKernelBuffer(is_kernel_buffer_full);
      }
      if (!Torrent.prototype.isComplete) {
        this.socket.write(messages.interested());
      } else {
        if (global.config.debug) console.log("Download is complete");
      }
    } else this.socket.destroy();
  };

  handleBitfield = (parsed) => {
    if (global.config.debug)
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
    Torrent.prototype.unchokedMeList.push(this);
    if (global.config.electron) {
      Torrent.prototype.transport(
        "t-unchoked",
        this.unchokedMeList.map((peer) => {
          info: peer.info;
        })
      );
    }
    this.state.choked = false;
    if (global.config.debug) console.log("You are unchoked");
    this.buildQueue();
    this.download();
  };

  handleChoke = (parsed) => {
    this.state.choked = true;
    if (global.config.debug) console.log("You are choked by - ", this.info.ip);
    let ind = Torrent.prototype.connectedPeers.indexOf(this);
    Torrent.prototype.connectedPeers.splice(ind, 1);
    if (global.config.debug)
      console.log("connected peers", Torrent.prototype.connectedPeers.length);
    if (global.config.debug) console.log(this.info.ip);
    this.socket.end();
    //dont end the connection abrupty - add to amChoked list and wait for some time if the peers connect again ??
  };
  handleInterested = (parsed) => {
    this.state.interested = true;
    this.interestedPeers.add(this);
    if (global.config.debug)
      console.log(
        "xxxxxxxxxxxxxxxxxxxxxxxxx-----------------SOMEONE IS INTERESTED----------------xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        parsed
      );
    if (this.state.amChoking === false) {
      this.socket.write(messages.unChoke());
      this.state.amChoking = false;
    }

    //send bitfield to the peer and wait for the request
    let sendHavesI = setInterval(() => {
      if (this.downloaded.size !== 0) {
        this.sendHaves(this);
        // setTimeout(() => clearInterval(sendHavesI), 5000);
      }
    }, 10000);
    if (this.downloaded.size !== 0) {
      this.sendHaves(this);
    }
  };
  handleRequest = async (parsed) => {
    if (this.limitUSpeed) {
      await new Promise((r) =>
        setTimeout(r, Math.floor(Math.random() * 10000))
      );
    }
    if (this.bill.start != 0) {
      this.bill.start = this.bill.end;
      this.bill.end = new Date().getTime();
      this.bill.speed = this.pieceLen / (this.bill.end - this.bill.start);
    }
    if (this.bill.end == 0) {
      this.start = new Date().getTime();
    }
    if (global.config.debug)
      console.log(
        "xxxxxxxxxxxxxxxxxxxxxxxxx-----------------SOMEONE IS REQUESTING----------------xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        parsed.payload
      );
    if (this.state.amChoking === false) this.servePiece(this, parsed.payload);
    else if (global.config.debug)
      console.log("A Choked Peer is requesting pieces");
    this.manageUploadSpeed();
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
      if (global.config.debug) console.log("multiple file boundary");
      length = file.size - offset;
      data2 = data.slice(length);
      length2 = offset + data.length - file.size;
      data = data.slice(0, length);
    }
    fs.write(file.fd, data, 0, length, offset, async (err, written, buffer) => {
      if (err) {
        if (global.config.debug) console.log(err);
      } else {
        // if(global.config.debug)console.log(written, buffer)
        // this.downloaded.add(parsed.payload.index);
        if (global.config.debug)
          console.log(
            "saved",
            parsed.payload.index,
            this.pieceLen,
            this.info.ip
          );
      }
    });
    //do this by considering the next file length !! and file descriptor
    //next file length is important as the extra length in the data received of a peice may traverse/encompass various files
    //test file TempleOS.iso
    let track = 1;
    if (multiple) {
      while (length2 > 0) {
        let fileSize = this.files[file.index + track].size;
        if (global.config.debug)
          console.log("Writing file in series", track, length2, fileSize);
        fs.write(
          this.files[file.index + track].fd,
          data2.slice(0, Math.min(data2.length, fileSize)),
          0,
          Math.min(fileSize, length2),
          0,
          async (err, written, buffer) => {
            if (err) {
              if (global.config.debug) console.log(err);
            } else {
              // if(global.config.debug)console.log(written, buffer)
              // if (global.config.debug) console.log(data2, length2);
            }
          }
        );
        length2 -= Math.min(fileSize, length2);
        data2 = data2.slice(Math.min(data2.length, fileSize));
        track++;
      }
    }
  };
  handlePiece = (parsed) => {
    this.track.end = new Date().getTime();
    this.calcuateSpeed();
    if (global.config.debug)
      console.log("GOT A PIECE !! ALERT !!", this.info.ip);
    const offset = parsed.payload.begin;
    parsed.payload.block.copy(this.downloadedBuffer, offset);
    this.downloadedSize += parsed.payload.block.length;
    if (
      this.lastPiece === parsed.payload.index
        ? this.downloadedSize === this.getLastPieceLen()
        : this.downloadedSize === this.pieceLen
    ) {
      if (global.config.debug)
        console.log("A Piece is completed", parsed.payload.index);
      if (
        this.verifyChecksum(
          this.downloadedBuffer,
          this.pieces[parsed.payload.index],
          parsed.payload.index
        )
      ) {
        this.downloaded.add(parsed.payload.index);
        this.display();
        this.savePiece(parsed);
        this.myDownloads.add(parsed.payload.index);
        if (!Torrent.prototype.state.uploadStart) {
          this.emitter.emit("upload");
          Torrent.prototype.state.uploadStart = true;
        }
        this.saveState();
      } else {
        if (global.config.debug) console.log("checksum failed");
      }
      this.done = 0;
      this.downloadedSize = 0;
      this.store = this.downloadedBuffer;
      this.downloadedBuffer = Buffer.alloc(this.pieceLen);
      this.current = -1;
    }
    this.download();
  };
  download = async () => {
    //remove this
    if (this.limitDSpeed) {
      await new Promise((r) =>
        setTimeout(() => {
          this.showSpeed();
          r();
        }, Math.floor(Math.random() * 10000))
      );
    }
    if (this.state.choked) {
      if (global.config.debug) console.log("Download, choked");
      return;
    }
    this.showProgress();
    this.getStatistics();
    // await new Promise(r => setTimeout(r, 4000));
    if (global.config.debug)
      console.log([
        { size: this.downloaded.size },
        { size: this.queue.size() },
        { size: this.pieces.length },
      ]);
    if (
      (this.queue.size() === 0 &&
        this.downloaded.size === this.pieces.length) ||
      Torrent.prototype.isComplete
    ) {
      if (global.config.debug) console.log("Download Complete !!");

      // clearInterval(Torrent.prototype.top4I);
      // clearInterval(Torrent.prototype.optChI);
      this.closeConnections();
      return;
    }
    if (this.current === -1) {
      const store = [];
      let found = 0;
      let target = {};

      if (global.config.debug) console.log(this.info.ip, this.state.choked);
      if (!this.queue.size()) {
        if (global.config.debug) console.log("No pieces left to download");
        this.buildQueue();
        if (global.config.debug)
          console.log(
            this.downloaded.size === this.pieces.length,
            this.downloaded.size,
            this.pieces.length
          );
        //to be tested - endgame protocol
        for (let i = 0; i < this.pieces.length; i++) {
          if (this.downloaded.has(i) == false) {
            this.queue.push({ index: i, count: 1 });
          }
        }

        setTimeout(this.download, 10000);
        return;
      }
      while (!found) {
        if (global.config.debug)
          console.log("Queue Before - ", this.queue.size());
        if (!this.queue.isEmpty()) target = this.queue.pop();
        else {
          if (global.config.debug) console.log("queue is empty");
          // askForPeers();
          return;
        }
        if (global.config.debug)
          console.log("EXTRACTED", target, this.queue.size());
        if (this.myPieces[target.index] === 0) {
          store.push(target);
        } else {
          found = 1;
          while (store.length) this.queue.push(store.pop());
        }
      }
      this.current = target.index;
      if (global.config.debug) console.log("Queue After - ", this.queue.size());
    }

    if (this.downloaded.has(this.current)) {
      if (global.config.debug) console.log("This piecee is already downloaded");
      this.current = -1;
      this.download();
      return;
    }
    let rem = this.pieceLen;
    // this.current = 1445; //for debugging Clementine
    if (this.current === this.pieces.length - 1) {
      if (global.config.debug)
        console.log(
          "------------------------------------------------------------------------------"
        );
      rem = this.getFileLength(-1) - this.pieceLen * (this.pieces.length - 1);
      if (global.config.debug)
        console.log("LAST PIECE", rem, this.getFileLength(-1));
      if (global.config.debug)
        console.log(
          "------------------------------------------------------------------------------"
        );
    }
    let length = Math.min(16384, rem, rem - this.done);
    if (length === rem - this.done) {
      if (global.config.debug) console.log("LEFT IS - ", rem - this.done);
    }

    while (this.done < rem) {
      this.socket.write(
        messages.request({
          index: this.current,
          begin: this.done,
          length: length,
        })
      );
      if (this.done == 0) this.track.start = new Date().getTime();
      this.done += length;
      if (global.config.debug) console.log(this.current, this.done);
      if (global.config.debug) console.log("Queue - ", this.queue.size());
      length = Math.min(16384, rem, rem - this.done);
    }
  };
}
global.config.Peer = Peer;
module.exports = {
  Peer,
};
