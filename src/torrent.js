const crypto = require("crypto");
const messages = require("./messages.js");
const fs = require("fs");
const { EventEmitter: eventEmmiter } = require("./utils/events.js");
const { PriorityQueue } = require("./utils/priority-queue");
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
    if (global.config.debug) console.table(progress);
  };
  topFour = () => {
    if (global.config.debug) console.log("TOP 4");
    if (this.connectedPeers.length <= 4) {
      if (global.config.debug)
        console.log("less than 5 peers", this.connectedPeers.length);
      this.connectedPeers.forEach((peer) => {
        if (peer.amChoking) {
          if (global.config.debug) console.log("I am unchoking a peer");
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
      if (global.config.debug)
        console.log("speed", peer.info.ip, peer.track.speed);
    });
    if (totalSpeed == 0) {
      if (global.config.debug) console.log("All Peers have Speed 0");
      return;
    }
    speedMap = speedMap.sort((a, b) => b.speed - a.speed);
    if (global.config.debug) console.log("SPEED MAP");
    let display = [];
    for (let i = 0; i < speedMap.length; i++) {
      display.push({ ip: speedMap[i].peer.info.ip, speed: speedMap[i].speed });
    }
    if (global.config.debug) console.table(display);
    let turtles = speedMap.splice(4);
    Torrent.prototype.chokedPeers = new Set(turtles.map((val) => val.peer));
    Torrent.prototype.unChokedPeers = new Set(speedMap.map((val) => val.peer));

    for (let peer of turtles.map((obj) => obj.peer)) {
      if (global.config.debug) console.log("slow", peer.info.ip);
      peer.amChoking = true;
      peer.socket.write(messages.choke());
    }
    for (let peer of speedMap.map((obj) => obj.peer)) {
      if (global.config.debug) console.log("fast", peer.info.ip);
      if (peer.amChoking) {
        if (global.config.debug) console.log("I am unchoking a peer");
        peer.amChoking = false;
        peer.socket.write(messages.unChoke());
      }
    }
  };

  optimisticUnchoke = () => {
    if (global.config.debug) console.log("optimistically unchoking");
    const numConnected = this.connectedPeers.length;
    if (numConnected <= 4) return;
    const numChoked = this.chokedPeers.size; //4 max
    const numUnchoked = this.unChokedPeers.size;
    if (numUnchoked == 0) return;

    const chokedPeers = Array.from(Torrent.prototype.chokedPeers);
    const unChokedPeers = Array.from(Torrent.prototype.unChokedPeers);

    const unChokeIndex = Math.floor(Math.random() * 100) % numUnchoked;
    const chokeIndex = Math.floor(Math.random() * 100) % numChoked;
    if (global.config.debug)
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
    if (global.config.debug)
      console.log(
        "```````````````````````````````````````````starting upload henceforth``````````````````````````````````"
      );
    this.connectedPeers.forEach((peer) => {
      if (global.config.debug) console.log(peer.info.ip);
    });
    Torrent.prototype.top4I = setInterval(this.topFour, 10000);
    Torrent.prototype.optChI = setInterval(this.optimisticUnchoke, 30000);
  };
  closeConnections = () => {
    this.connectedPeers.forEach((peer) => {
      // peer.socket.end();
      //allow peers to be connected without requesting pieces from them
    });
    Torrent.prototype.isComplete = true;
    // startSeed();
    if (global.config.debug) console.log("I am a seeder now :)");
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
      // if(global.config.debug)console.log("current", peer.info.ip, peer.current);
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
    if (global.config.debug) console.log("downloaded", downloaded);
    if (global.config.debug) console.log("NAN", NAN);
    if (global.config.debug) console.log("current", current);
    if (global.config.debug) console.log("noPiece", downloaded);
    if (global.config.debug)
      console.log({ now: now, prev: prev, diff: now - prev });
  };

  verifyChecksum = (buffer, pieceHash, index) => {
    if (index == this.lastPiece) {
      buffer = buffer.slice(0, this.getLastPieceLen());
    }
    const crypted = crypto.createHash("sha1").update(buffer).digest();
    if (global.config.debug) console.log(crypted);
    if (global.config.debug) console.log(buffer);
    if (!Buffer.compare(crypted, pieceHash)) return true;
    return false;
  };
  getStatistics() {
    if (global.config.debug)
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
    if (global.config.debug) console.table(report);
  }
  getFD = (index) => {
    let downloaded = index * this.pieceLen;
    let offset = 0;
    for (let i = 0; i < this.files.length; i++) {
      let file = this.files[i];
      offset += file.size;
      if (offset >= downloaded) {
        if (global.config.debug) console.log(file.fd);
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
        if (global.config.debug) console.log("here", this.files[0].size);
        return this.files[0].size;
      }
      let sum = 0;
      for (let file of this.files) {
        sum += file.size;
      }
      // if(global.config.debug)console.log("counting", sum);
      return sum;
    }

    let downloaded = index * this.pieceLen;
    let offset = 0;
    for (let file of this.files) {
      offset += file.size;
      if (offset >= downloaded) {
        if (global.config.debug) console.log(file.fd);
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
    if (global.config.debug)
      console.log("Have sent to interested", peer.info.ip, "of - ", sent);
  };
  servePiece = (peer, { index, begin, length }) => {
    if (length + begin > 16384) {
      if (global.config.debug) console.log("rejected");
      return;
    } //requesting more than 16KB, so rejected
    if (!this.downloaded.has(index)) {
      if (global.config.debug) console.log("Requested Piece Doesn't Exist");
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
      if (global.config.debug) console.log("trancending boundary");
      fs.readSync(
        this.files[file.index + 1].fd,
        contents,
        readLength,
        length,
        0
      );
    }
    if (global.config.debug) console.log("Contents", contents, contents.length);
    const payload = { index: index, begin: begin, block: contents };
    peer.socket.write(messages.piece(payload));
    //testing to be done !!
  };
  saveState = () => {
    const file = fs.openSync("./.state.json", "w+");
    const state = {
      downloaded: Array.from(Torrent.prototype.downloaded),
      isComplete: Torrent.prototype.isComplete,
      state: Torrent.prototype.state,
    };
    fs.writeSync(file, JSON.stringify(state));
  };
}
const initTorrent = (files, pieces) => {
  Torrent.prototype.pieceTracker = new Array(pieces.length).fill(0);
  Torrent.prototype.queue = new PriorityQueue();
  Torrent.prototype.downloaded = new Set();
  Torrent.prototype.emitter = new eventEmmiter();
  // Torrent.prototype.file = fs.openSync(process.cwd() + "/" + torrent.info.name, "w");
  Torrent.prototype.files = files;

  Torrent.prototype.connectedPeers = [];
  Torrent.prototype.unchokedMeList = []; //peers who have unchoked me - yet to add to list

  Torrent.prototype.interestedPeers = new Set();
  Torrent.prototype.chokedPeers = new Set();
  Torrent.prototype.unChokedPeers = new Set();
  Torrent.prototype.state = { uploadEvent: false, uploadStart: false };
  Torrent.prototype.isComplete = false;
};
module.exports = { Torrent, initTorrent };
