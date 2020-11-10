const crypto = require("crypto");
const messages = require("./messages.js");
const fs = require("fs");
const { EventEmitter: eventEmmiter } = require("./utils/events.js");
const { PriorityQueue } = require("./utils/priority-queue");
const cliProgress = require("cli-progress");
const _colors = require("colors");
const ansiEscapes = require("ansi-escapes");
const { prototype } = require("stream");
const write = process.stdout.write.bind(process.stdout);
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
  addBar() {
    if (!Torrent.prototype.bar) {
      if (global.config.info) console.log(`[Info]: Downloading`);
      if (Torrent.prototype.electron)
        Torrent.prototype.transport("status", "Downloading");
      let bar = new cliProgress.Bar(
        {
          barsize: 65,
        },
        {
          format:
            "Progress " +
            _colors.cyan(" {bar}") +
            " {percentage}% | ETA: {eta}s | {value}/{total} | Speed: {speed} kB/s | U.Speed: {uSpeed} kB/s",
          barCompleteChar: "\u2588",
          barIncompleteChar: "\u2591",
        }
      );
      bar.start(
        (
          this.files.map((file) => file.size).reduce((a, b) => a + b) / 1024
        ).toFixed(2),
        0,
        {
          speed: "0",
          uSpeed: "0",
        }
      );
      Torrent.prototype.bar = bar;
    }
  }
  display() {
    // write(ansiEscapes.clearScreen + ansiEscapes.cursorTo(0, 1));
    if (global.config.progress) {
      this.addBar();
      write(ansiEscapes.cursorRestorePosition);
      write(ansiEscapes.cursorSavePosition + ansiEscapes.cursorTo(0, 15));
      const size = (
        this.files.map((file) => file.size).reduce((a, b) => a + b) / 1024
      ).toFixed(2);
      this.bar.update(
        Math.min(
          size,
          ((this.downloaded.size * this.pieceLen) / 1024).toFixed(2)
        )
      );
      if (Torrent.prototype.electron) {
        Torrent.prototype.transport(
          "progress",
          Math.min(size, (this.downloaded.size * this.pieceLen) / 1024).toFixed(
            2
          )
        );
      }
      let data = {
        status: Torrent.prototype.isComplete ? "Seeding" : "downloading",
        "Connected peers": this.connectedPeers.length,
      };
      console.table(data);
      // write(ansiEscapes.cursorSavePosition + ansiEscapes.cursorTo(0, 40));
      let info = {
        Torrent: Torrent.prototype.name.substring(0, 30),
        Size: `${size} KB | ${size / 1024} MB`,
      };
      console.table(info);

      write(ansiEscapes.cursorRestorePosition);
    }
  }
  manageUploadSpeed = () => {
    let speed = 0;
    let speedMap = [];
    this.connectedPeers.forEach((peer) => {
      if (!peer.state.amChoking) {
        speed += peer.bill.speed;
        speedMap.push({ peer: peer, speed: peer.bill.speed });
      }
    });
    speedMap = speedMap.sort((a, b) => b.speed - a.speed);
    if (speed > this.uspeed) {
      this.limitUSpeed = true;
    }
    if (Torrent.prototype.electron)
      Torrent.prototype.transport("u-speed", speed);
    if (global.config.progress) this.bar.update({ uSpeed: speed });
  };
  showSpeed = () => {
    let speed = 0;
    for (let peer of this.connectedPeers)
      if (!peer.state.choked) speed += peer.track.speed;
    if (speed > this.dspeed && this.dspeed != -1 && this.dspeed >= 10) {
      // console.log("MAX SPEED REACHED", speed);
      let speedMap = [];
      this.connectedPeers.forEach((peer) => {
        if (peer.track.speed != 0 && peer.state.choked == false)
          speedMap.push({ peer: peer, speed: peer.track.speed });
      });
      speedMap = speedMap.sort((a, b) => b.speed - a.speed);
      while (speed > this.dspeed) {
        if (speedMap.length > 1) {
          // console.log("Limiting Speed");
          let ele = speedMap.pop();
          speed -= ele.speed;
          ele.peer.state.turtled = true;
          ele.peer.state.choked = true;
        } else {
          Torrent.prototype.limitDSpeed = true;
          break;
        }
      }
    } else {
      Torrent.prototype.limitDSpeed = false;
    }
    if (Torrent.prototype.electron)
      Torrent.prototype.transport("d-speed", speed);
    if (global.config.progress) this.bar.update({ speed: speed });
  };
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
      let speed = 0;
      this.connectedPeers.forEach((peer) => {
        speed += peer.track.speed;
        if (peer.state.amChoking) {
          if (global.config.debug) console.log("I am unchoking a peer");
          peer.state.amChoking = false;
          peer.socket.write(messages.unChoke());
        }
      });
      if (speed < 10) {
        Torrent.prototype.limitDSpeed = false;
        this.connectedPeers.forEach((peer) => {
          if (peer.state.turtled == true) {
            peer.state.choked = false;
            peer.state.turtled = false;
          }
        });
      }
      return;
    }
    let speedMap = [];
    let totalSpeed = 0;
    this.connectedPeers.forEach((peer) => {
      totalSpeed += peer.track.speed;
      speedMap.push({ peer: peer, speed: peer.track.speed });
    });
    if (totalSpeed == 0) {
      if (global.config.debug) console.log("All Peers have Speed 0");
      return;
    }
    if (totalSpeed < 10) {
      Torrent.prototype.limitDSpeed = false;
      this.connectedPeers.forEach((peer) => {
        if (peer.state.turtled == true) {
          peer.state.choked = false;
          peer.state.turtled = false;
        }
      });
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
      // if (global.config.debug) console.log("slow", peer.info.ip);
      if (!peer.state.amChoking) {
        peer.state.amChoking = true;
        peer.socket.write(messages.choke());
      }
    }
    for (let peer of speedMap.map((obj) => obj.peer)) {
      // if (global.config.debug) console.log("fast", peer.info.ip);
      if (peer.state.amChoking) {
        if (global.config.debug) console.log("I am unchoking a peer");
        peer.state.amChoking = false;
        peer.socket.write(messages.unChoke());
      }
    }
  };

  optimisticUnchoke = () => {
    //add a try catch here
    // let abc = new Date();
    // console.log(abc.getMinutes(), abc.getSeconds());

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

    let targetChoked = Array.isArray(chokedPeers[chokeIndex])
      ? chokedPeers[chokeIndex][0]
      : chokedPeers[chokeIndex];
    let targetUnChoked = Array.isArray(unChokedPeers[unChokeIndex])
      ? unChokedPeers[unChokeIndex][0]
      : unChokedPeers[unChokeIndex];

    if (global.config.debug) {
      console.log("wierd ", Array.isArray(chokedPeers[chokeIndex]));
      console.log("wierd _ ", targetChoked.info);
      console.log("wierd ", Array.isArray(unChokedPeers[unChokeIndex]));
      console.log("wierd _ ", targetUnChoked.info);
      console.table({
        unChoked: targetUnChoked.info["ip"],
        choked: targetChoked.info["ip"],
      });
    }
    if (!targetUnChoked) {
      if (!global.config.debug) console.log("this is blunder 0");
      let index = Torrent.prototype.connectedPeers.indexOf(targetUnChoked);
      if (index != -1) Torrent.prototype.connectedPeers.splice(index, 1);

      return;
    }
    if (!targetChoked) {
      if (!global.config.debug) console.log("this is blunder 1");
      let index = Torrent.prototype.connectedPeers.indexOf(targetChoked);
      if (index != -1) Torrent.prototype.connectedPeers.splice(index, 1);
      return;
    }
    try {
      targetUnChoked.socket.write(messages.unChoke());

      targetUnChoked.state.amChoking = false;

      targetChoked.socket.write(messages.choke());

      targetChoked.state.amChoking = true;

      unChokedPeers.push(chokedPeers.splice(chokeIndex, 1));
      chokedPeers.push(unChokedPeers.splice(unChokeIndex, 1));

      Torrent.prototype.chokedPeers = new Set(chokedPeers);
      Torrent.prototype.unChokedPeers = new Set(unChokedPeers);
    } catch {
      if (1 || global.config.debug) {
        console.log("wierd ", Array.isArray(chokedPeers[chokeIndex]));
        console.log("wierd _ ", targetChoked.info);
        console.log("wierd ", Array.isArray(unChokedPeers[unChokeIndex]));
        console.log("wierd _ ", targetUnChoked.info);
        console.log("this is another blunder");
      }
    }
  };

  startUpload = () => {
    if (global.config.debug)
      console.log(
        "```````````````````````````````````````````starting upload henceforth``````````````````````````````````"
      );
    this.connectedPeers.forEach((peer) => {
      if (global.config.debug) console.log(peer.info.ip);
    });
    // Torrent.prototype.top4I = setInterval(this.topFour, 10000);
    // Torrent.prototype.optChI = setInterval(this.optimisticUnchoke, 30000);
  };

  closeConnections = () => {
    if (Torrent.prototype.isComplete == true) return;
    const peers = this.connectedPeers;
    peers.forEach((peer) => {
      if (!peer.client) {
        peer.socket.end();
        let index = Torrent.prototype.connectedPeers.indexOf(peer);
        if (index !== -1) {
          Torrent.prototype.connectedPeers.splice(index, 1);
          Torrent.prototype.chokedPeers.delete(this);
          Torrent.prototype.unChokedPeers.delete(this);
        }
      }
      //allow peers to be connected without requesting pieces from them
    });
    Torrent.prototype.isComplete = true;
    clearInterval(Torrent.prototype.top4I);
    clearInterval(Torrent.prototype.optChI);
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
    if (!Buffer.compare(crypted, pieceHash)) {
      if (global.config.debug) console.log("Checksum Sucessful");

      return true;
    }

    return false;
  };
  getStatistics() {
    if (global.config.debug)
      console.table({
        "total peers": Torrent.prototype.connectedPeers.length,
        "Peers unchoking me":
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
        if (global.config.debug) console.log("file:", file.fd);
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
    if (global.config.debug) console.log("A piece is requested");

    let size =
      this.lastPiece == index
        ? this.getFileLength(-1) - this.pieceLen * (this.pieces.length - 1)
        : this.pieceLen;
    if (length > 16384) {
      if (global.config.debug) console.log("rejected");
      return;
    } //requesting more than 16KB, so rejected
    if (!this.downloaded.has(index)) {
      if (global.config.debug) console.log("Requested Piece Doesn't Exist");
      return;
    }

    let file = this.getFD(index);
    let offset = this.getFileOffset(index);

    let contents = Buffer.alloc(this.pieceLen);

    let readLength = Math.min(size, file.size - offset);

    size = size - readLength;

    let start = offset;
    //check for errors in here - in console
    fs.readSync(file.fd, contents, 0, readLength, start);
    let track = 1;
    while (size > 0) {
      //debug this - check size  0
      let fileSize = this.files[file.index + track].size;
      if (global.config.debug)
        console.log("trancending boundary", size, readLength, fileSize);
      fs.readSync(
        this.files[file.index + track].fd,
        contents,
        readLength,
        Math.min(size, fileSize),
        0
      );
      size = size - Math.min(size, fileSize);
      readLength += Math.min(size, fileSize);
      track++;
    }
    if (global.config.debug) console.log("Contents", contents, contents.size);
    const payload = {
      index: index,
      begin: begin,
      block: contents.slice(begin, begin + length),
    };
    peer.socket.write(messages.piece(payload));
    //testing almost done
  };

  saveState = () => {
    const file = fs.openSync(`./.state.json`, "w+");
    const state = {
      downloaded: Array.from(Torrent.prototype.downloaded),
      isComplete: Torrent.prototype.isComplete,
      state: Torrent.prototype.state,
    };
    fs.writeSync(file, JSON.stringify(state));
  };
}
const initTorrent = (files, pieces, uspeed, dspeed, maxConnections) => {
  Torrent.prototype.uspeed = uspeed;
  Torrent.prototype.maxConnections = maxConnections;
  Torrent.prototype.dspeed = dspeed;
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
