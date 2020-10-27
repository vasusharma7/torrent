const dgram = require("dgram");
const Buffer = require("buffer").Buffer;
const urlParse = require("url").parse;
const crypto = require("crypto"); // 1
const torrentUtils = require("./torrent-file-utils");
const port = global.config.myPort;
// const port = 0x1AE7

function respType(resp) {
  const action = resp.readUInt32BE(0);
  if (action === 0) return "connect";
  if (action === 1) return "announce";
}

module.exports.getPeers = (torrent, url, callback) => {
  const socket = dgram.createSocket("udp4");
  if (global.config.debug) console.log(url);
  // const url = torrent.announce.toString("utf8");
  // const url = torrent["announce-list"][0].toString("utf8");

  udpSend(socket, buildConnReq(), url);
  socket.on("error", (err) => {
    if (global.config.debug) console.log(err);
  });
  socket.on("message", (response) => {
    // if(global.config.debug)console.log("response", response)
    switch (respType(response)) {
      case "connect":
        const connResp = parseConnResp(response);
        // if(global.config.debug)console.log("connection response", connResp);
        const announceReq = buildAnnounceReq(torrent, connResp.connectionId);
        udpSend(socket, announceReq, url);
        break;

      case "announce":
        const announceResp = parseAnnounceResp(response);
        callback(announceResp.peers);
        break;
    }
  });
};

function udpSend(socket, message, rawUrl, callback = () => {}) {
  const url = urlParse(rawUrl);
  // if(global.config.debug)console.log(url);
  // const port = url.port ? url.port : 80
  let port = url.port ? url.port : 80;
  socket.send(message, 0, message.length, port, url.hostname, (err) => {});
}

function buildConnReq() {
  const buf = Buffer.alloc(16);

  // connection id
  //writing big endian unsigned int - 8 bytes

  //magic number 0x417271001980
  buf.writeUInt32BE(0x417, 0); // 3
  buf.writeUInt32BE(0x27101980, 4);

  // action - connection - send constant 0 value for making connection
  //4 bytes 0
  buf.writeUInt32BE(0, 8);

  // transaction id - random
  crypto.randomBytes(4).copy(buf, 12); //- 4 bytes

  return buf;
}
function parseConnResp(resp) {
  return {
    action: resp.readUInt32BE(0),
    transactionId: resp.readUInt32BE(4),
    connectionId: resp.slice(8),
    //used slice - since nodejs cannot read/wtire 64 bit integers correctly - so kept as buffer only
  };
  //0 ,4 and 8 are offsets
}

function buildAnnounceReq(torrent, connId) {
  if (global.config.debug) console.log("building announce");
  //should be 98 but accepting 100 ?? -

  const buf = Buffer.alloc(100);
  //connection id from connect
  connId.copy(buf, 0); //- 4 bytes
  //announce 1
  buf.writeUInt32BE(1, 8);

  //random transaction ID
  crypto.randomBytes(4).copy(buf, 12);

  //info hash of torrent file
  torrentUtils.getInfoHash(torrent).copy(buf, 16);

  //peer id
  torrentUtils.myPeerId().copy(buf, 36);

  //downloaded = 0
  buf.writeUInt32BE(0, 56);
  buf.writeUInt32BE(0, 60);

  //size left = complete
  torrentUtils.left(torrent).copy(buf, 64);

  //uploaded = 0
  buf.writeUInt32BE(0, 72);
  buf.writeUInt32BE(0, 76);

  //event = 0// 0: none; 1: completed; 2: started; 3: stopped
  buf.writeUInt32BE(0, 80);

  //ip address
  //set to zero because I want tracker to use the IP address of sender of this UDP packet i.e. ultimately my IP
  buf.writeUInt32BE(0, 84);

  //key random
  crypto.randomBytes(4).copy(buf, 88); //- 4 bytes

  //num_want -1 // default
  buf.writeInt32BE(-1, 92);

  //port  6881 - 6889
  buf.writeInt32BE(port, 96);

  return buf;
}

function parseAnnounceResp(resp) {
  // if(global.config.debug)console.log(resp)
  var info = [];
  info["action"] = resp.readUInt32BE(0);
  info["transactionId"] = resp.readUInt32BE(4);
  info["intervals"] = resp.readUInt32BE(8);
  info["leechers"] = resp.readUInt32BE(12);
  info["seeders"] = resp.readUInt32BE(16);
  info["peers"] = [];
  if (global.config.debug)
    console.log("seeders", info["seeders"], "leechers", info["leechers"]);
  var peers = resp.slice(20);
  var offset = 0;
  while (offset < peers.length) {
    // if(global.config.debug)console.log(peers.slice(offset, offset + 6))
    var ip = peers.slice(offset, offset + 4).join(".");
    var port = peers.readUInt16BE(offset + 4);
    offset += 6;
    info["peers"].push({ ip, port });
  }

  return info;
}
