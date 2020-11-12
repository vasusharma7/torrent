require("./config");
const process = require("process");
const torrentFile = require("./parse-torrent-file");
const Seeder = require("./seed");
const { Peer } = require("./peer");
const { Torrent, initTorrent } = require("./torrent");
const { exec } = require("../ssh-tunnel/shell");

module.exports.startTorrent = (
  file,
  dest,
  {
    uspeed = -1,
    dspeed = -1,
    transport = null,
    maxConnections = null,
    electron = false,
  }
) => {
  if (global.config.info) console.log("[Proxy Tunnel]: Starting SSH-Tunnel...");

  if (!file) {
    if (global.config.debug)
      console.log("Please provide a torrent file in the arguement");
    process.exit();
  }
  if (!dest) {
    dest = ".";
  }
  Torrent.prototype.transport = transport;
  Torrent.prototype.electron = electron;
  const { torrent, pieces, pieceLen, files } = torrentFile.init(file, dest);
  let seeder = new Seeder(
    global.config.hostname,
    global.config.port,
    global.config.maxConnections,
    torrent,
    pieces,
    pieceLen
  );
  seeder.execute();
  initTorrent(files, pieces, uspeed, dspeed, maxConnections);

  torrentFile.parse(torrent, (peers) => parseCallback(peers));
  const parseCallback = (peers) => {
    const allPeers = [];
    if (Torrent.prototype.connectedPeers.length > maxConnections) {
      if (global.config.debug) console.log("Enough Peers");
      return;
    }
    if (Torrent.prototype.isComplete) {
      if (global.config.debug) console.log("Download is complete");
      return;
    }
    if (global.config.debug) console.log("got the peers", peers);
    peers.forEach((peer) => {
      let connected = false;
      Torrent.prototype.connectedPeers.forEach((cp) => {
        if (connected) return;
        if (cp.info.ip === peer.ip) {
          connected = true;
        }
      });
      if (connected) return;
      allPeers.push(new Peer(peer, torrent, pieces, pieceLen));
    });
    allPeers.forEach((peer) => {
      peer.execute();
    });
    if (global.config.debug)
      console.log(Torrent.prototype.connectedPeers.length, allPeers.length);
  };
  // parseCallback([{ ip: "40.80.81.76", port: "6887" }]);
  // parseCallback([{ ip: "18.225.11.191", port: "6887" }]);
  // parseCallback([{ ip: "210.212.183.7", port: "6885" }]);
};
