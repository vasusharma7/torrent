const crypto = require("crypto");
const messages = require("./messages.js");
const fs = require("fs");

//things to debug
// queue size increasing
// some discrepencies while new peers are added - bring in no piece situations

class Torrent {
  constructor(pieces, pieceLen, torrent) {
    this.pieces = pieces;
    this.pieceLen = pieceLen;
    this.torrent = torrent;
    this.lastPieceLen;
    this.lastPiece = pieces.length - 1;
    if (Torrent.prototype.state.uploadEvent === false) {
      this.emitter.once("upload", () => this.startUpload());
      Torrent.prototype.state.uploadEvent = true;
    }
  }
  showProgress = () => {
    const progress = [
      {
        Completed: `${(
          (this.downloaded.size / this.pieces.length) *
          100
        ).toFixed(2)} %`,
        total: "100 %",
      },
      {
        Completed: `${
          (this.downloaded.size * this.pieceLen) / (1024 * 1024)
        } MB`,
        total: `${(this.pieces.length * this.pieceLen) / (1024 * 1024)} MB`,
      },
      {
        Completed: `${(this.downloaded.size * this.pieceLen) / 1024} KB`,
        total: `${(this.pieces.length * this.pieceLen) / 1024} KB`,
      },
    ];
    console.table(progress);
  };
  topFour = () => {
    console.log("TOP 4");
    if (this.connectedPeers.length <= 4) {
      console.log("less than 5 peers", this.connectedPeers.length);
      this.connectedPeers.forEach((peer) => {
        if (peer.amChoking) {
          console.log("I am unchoking a peer");
          peer.amChoking = false;
          peer.socket.write(messages.unChoke());
        }
      });
      return;
    }
    let speedMap = [];
    let totalSpeed = 0;
    this.connectedPeers.forEach((peer) => {
      totalSpeed += peer.track.speed;
      speedMap.push({ peer: peer, speed: peer.track.speed });
      console.log("speed", peer.info.ip, peer.track.speed);
    });
    if (totalSpeed == 0) {
      console.log("All Peers have Speed 0");
      return;
    }
    speedMap = speedMap.sort((a, b) => b.speed - a.speed);
    console.log("SPEED MAP");
    let display = [];
    for (let i = 0; i < speedMap.length; i++) {
      display.push({ ip: speedMap[i].peer.info.ip, speed: speedMap[i].speed });
    }
    console.table(display);
    let turtles = speedMap.splice(4);
    Torrent.prototype.chokedPeers = new Set(turtles.map((val) => val.peer));
    Torrent.prototype.unChokedPeers = new Set(speedMap.map((val) => val.peer));

    for (let peer of turtles.map((obj) => obj.peer)) {
      console.log("slow", peer.info.ip);
      peer.amChoking = true;
      peer.socket.write(messages.choke());
    }
    for (let peer of speedMap.map((obj) => obj.peer)) {
      console.log("fast", peer.info.ip);
      if (peer.amChoking) {
        console.log("I am unchoking a peer");
        peer.amChoking = false;
        peer.socket.write(messages.unChoke());
      }
    }
  };

  optimisticUnchoke = () => {
    console.log("optimistically unchoking");
    const numConnected = this.connectedPeers.length;
    if (numConnected <= 4) return;
    const numChoked = this.chokedPeers.size; //4 max
    const numUnchoked = this.unChokedPeers.size;
    if (numUnchoked == 0) return;

    const chokedPeers = Array.from(Torrent.prototype.chokedPeers);
    const unChokedPeers = Array.from(Torrent.prototype.unChokedPeers);

    const unChokeIndex = Math.floor(Math.random() * 100) % numUnchoked;
    const chokeIndex = Math.floor(Math.random() * 100) % numChoked;
    // console.log(
    //   "unchoke",
    //   unChokeIndex,
    //   "choke",
    //   chokeIndex,
    //   "TUnC",
    //   numUnchoked,
    //   "TC",
    //   numChoked
    // );
    //yet to debug
    console.table({
      unChoked: unChokedPeers[unChokeIndex].info.ip,
      choked: chokedPeers[chokeIndex].info.ip,
    });

    unChokedPeers[unChokeIndex].socket.write(messages.unChoke());
    unChokedPeers[unChokeIndex].state.amChoking = false;
    chokedPeers[chokeIndex].socket.write(messages.choke());
    unChokedPeers[unChokeIndex].state.amChoking = true;

    unChokedPeers.push(chokedPeers.splice(chokeIndex, 1));
    chokedPeers.push(unChokedPeers.splice(unChokeIndex, 1));

    Torrent.prototype.chokedPeers = new Set(chokedPeers);
    Torrent.prototype.unChokedPeers = new Set(unChokedPeers);
  };
  startUpload = () => {
    console.log(
      "```````````````````````````````````````````starting upload henceforth``````````````````````````````````"
    );
    this.connectedPeers.forEach((peer) => console.log(peer.info.ip));
    Torrent.prototype.top4I = setInterval(this.topFour, 3000);
    Torrent.prototype.optChI = setInterval(this.optimisticUnchoke, 5000);
  };
  closeConnections = () => {
    this.connectedPeers.forEach((peer) => {
      peer.socket.end();
    });
    Torrent.prototype.isComplete = true;
    console.log("start seeding now :)");
  };
  buildQueue = () => {
    const prev = this.queue.size();
    if (!this.queue.isEmpty()) {
      while (!this.queue.isEmpty()) {
        this.queue.pop();
      }
    }
    const current = [];
    this.connectedPeers.forEach((peer) => {
      // if (peer.choked === false) {
      current.push(peer.current);
      // console.log("current", peer.info.ip, peer.current);
      // }
    });
    let downloaded = [];
    let noPiece = [];
    let NAN = [];
    this.pieceTracker.forEach((info, key) => {
      if (isNaN(info)) NAN.push(key);
      else if (this.downloaded.has(key)) downloaded.push(key);
      else if (info === 0) noPiece.push(key);
      else if (current.includes(key)) {
        //
      } else this.queue.push({ index: key, count: info });
    });
    const now = this.queue.size();
    console.log("downloaded", downloaded);
    console.log("NAN", NAN);
    console.log("current", current);
    console.log("noPiece", downloaded);
    console.log({ now: now, prev: prev, diff: now - prev });
  };

  verifyChecksum = (buffer, pieceHash, index) => {
    if (index == this.lastPiece) {
      buffer = buffer.slice(0, this.getLastPieceLen());
    }
    const crypted = crypto.createHash("sha1").update(buffer).digest();
    console.log(crypted);
    console.log(buffer);
    if (!Buffer.compare(crypted, pieceHash)) return true;
    return false;
  };
  getStatistics() {
    console.table({
      "total peers": Torrent.prototype.connectedPeers.length,
      "Connected Peers":
        Torrent.prototype.connectedPeers.length -
        Torrent.prototype.connectedPeers
          .map((peer) => peer.choked)
          .filter(Boolean).length,
    });
    const miss = new Set();
    this.connectedPeers.forEach((peer) => {
      if (peer.choked === false) {
        peer.myPieces.forEach((pc, key) => {
          if (pc === 0) {
            miss.add(key);
          }
        });
      }
    });
    const report = {
      missing: Array.from(miss),
      length: Array.from(miss).length,
      "Queue Size": this.queue.size(),
    };
    console.table(report);
  }
  getFD = (index) => {
    let downloaded = index * this.pieceLen;
    let offset = 0;
    for (let i = 0; i < this.files.length; i++) {
      let file = this.files[i];
      offset += file.size;
      if (offset >= downloaded) {
        console.log(file.fd);
        return { index: i, ...file };
      }
    }
  };
  getFileOffset = (index) => {
    let downloaded = index * this.pieceLen;
    let offset = 0;
    for (let file of this.files) {
      offset += file.size;
      if (offset >= downloaded) {
        offset = offset - file.size;
        return downloaded - offset;
      }
    }
  };
  getFileLength = (index) => {
    if (index === -1) {
      if (this.files.length === 1) {
        console.log("here", this.files[0].size);
        return this.files[0].size;
      }
      let sum = 0;
      for (let file of this.files) {
        sum += file.size;
      }
      // console.log("counting", sum);
      return sum;
    }

    let downloaded = index * this.pieceLen;
    let offset = 0;
    for (let file of this.files) {
      offset += file.size;
      if (offset >= downloaded) {
        console.log(file.fd);
        return file.size;
      }
    }
  };
  getLastPieceLen = () => {
    return this.getFileLength(-1) - this.pieceLen * (this.pieces.length - 1);
  };
  sendHaves = (peer) => {
    const sent = [];
    this.downloaded.forEach((piece) => {
      peer.socket.write(messages.have(piece));
      sent.push(piece);
    });
    console.log("Have sent to interested", peer.info.ip, "of - ", sent);
  };
  servePiece = (peer, { index, begin, length }) => {
    if (length + begin > 16384) {
      console.log("rejected");
      return;
    } //requesting more than 16KB, so rejected
    if (!this.downloaded.has(index)) {
      console.log("Requested Piece Doesn't Exist");
      return;
    }

    let file = this.getFD(index);
    let offset = this.getFileOffset(index);

    let contents = Buffer.alloc(length);

    let readLength = Math.min(length, file.size - offset - begin);

    length = length - readLength;

    let start = offset + begin;
    fs.readSync(file.fd, contents, 0, readLength, start);
    if (length !== 0) {
      console.log("trancending boundary");
      fs.readSync(
        this.files[file.index + 1].fd,
        contents,
        readLength,
        length,
        0
      );
    }
    console.log("Contents", contents, contents.length);
    const payload = { index: index, begin: begin, block: contents };
    peer.socket.write(messages.piece(payload));
    //testing to be done !!
  };
}

module.exports = { Torrent };
