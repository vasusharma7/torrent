const torrentUtils = require("./torrent-file-utils");
const { bitLength } = require("bignum");
// <pstrlen><pstr><reserved><info_hash><peer_id>
const messageId = {
  0: "choke",
  1: "unchoke",
  2: "interested",
  3: "not_interested",
  4: "have",
  5: "bitfield",
  6: "request",
  7: "piece",
  8: "cancel",
  9: "port",
};
const handshake = (torrent) => {
  console.log("building handshake");

  const buffer = Buffer.alloc(68);
  buffer.writeUInt8(19, 0);
  buffer.write("BitTorrent protocol", 1);
  buffer.writeUInt32BE(0, 20);
  buffer.writeUInt32BE(0, 24);
  torrentUtils.getInfoHash(torrent).copy(buffer, 28);
  torrentUtils.myPeerId().copy(buffer, 48);

  return buffer;
};
// keep-alive: <len=0000>
const keepAlive = () => {
  // console.log("building keepAlive")

  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(0, 0);
  return buffer;
};
// choke: <len=0001><id=0>
const choke = () => {
  console.log("building Choke");

  const buffer = Buffer.alloc(5);

  buffer.writeUInt32BE(1, 0);
  buffer.writeUInt8(0, 4);
  return buffer;
};

// unchoke: <len=0001><id=1>
const unChoke = () => {
  console.log("building UnChoke");

  const buffer = Buffer.alloc(5);

  buffer.writeUInt32BE(1, 0);
  buffer.writeUInt8(1, 4);
  return buffer;
};

// interested: <len=0001><id=2>
const interested = () => {
  console.log("building interested");

  const buffer = Buffer.alloc(5);

  buffer.writeUInt32BE(1, 0);
  buffer.writeUInt8(2, 4);
  return buffer;
};

// not interested: <len=0001><id=3>
const notInterested = () => {
  console.log("building notInterested");

  const buffer = Buffer.alloc(5);

  buffer.writeUInt32BE(1, 0);
  buffer.writeUInt8(3, 4);
  return buffer;
};

// have: <len=0005><id=4><piece index>
const have = (pieceIndex) => {
  console.log("building have");

  const buffer = Buffer.alloc(9);

  buffer.writeUInt32BE(5, 0);
  buffer.writeUInt8(4, 4);

  buffer.writeInt32BE(pieceIndex, 5);

  return buffer;
};
// bitfield: <len=0001+X><id=5><bitfield>
const bitfield = (payload) => {
  console.log("building bitfield");

  const buffer = Buffer.alloc(5 + payload.length);

  buffer.writeUInt32BE(1 + payload.length, 0);
  buffer.writeUInt8(5, 4);

  payload.copy(buffer, 5);

  return buffer;
};
// request: <len=0013 > <id=6 > <index><begin><length>
const request = (payload) => {
  console.log("building request", payload);

  const buffer = Buffer.alloc(17);

  buffer.writeUInt32BE(13, 0);

  buffer.writeUInt8(6, 4);

  buffer.writeUInt32BE(payload.index, 5);
  buffer.writeUInt32BE(payload.begin, 9);
  buffer.writeUInt32BE(payload.length, 13);

  return buffer;
};

const piece = (payload) => {
  console.log("building piece");

  const buffer = Buffer.alloc(13 + payload.block.length);

  buffer.writeUInt32BE(9 + payload.block.length, 0);

  buffer.writeUInt8(7, 4);

  buffer.writeUInt32BE(payload.index, 5);
  buffer.writeUInt32BE(payload.begin, 9);
  payload.block.copy(buffer, 13);

  return buffer;
};
// cancel <len=0013><id=8><index><begin><length>
const cancel = () => {
  console.log("building cancel");

  const buffer = Buffer.alloc(17);

  buffer.writeUInt32BE(13, 0);

  buffer.writeUInt8(8, 4);

  buffer.writeUInt32BE(payload.index, 5);
  buffer.writeUInt32BE(payload.begin, 9);
  buffer.writeUInt32BE(payload.length, 13);

  return buffer;
};
// <pstrlen><pstr><reserved><info_hash><peer_id>
const parseHandshake = (data, torrent) => {
  let pstrlen = data.readUInt8(0);
  // if (pstrlen != 19) return 0;

  let pstr = data.slice(1, pstrlen + 1).toString("utf8");
  let info_hash = data.slice(28, 48);
  let peer_id = data.slice(48).toString("utf8");
  let result = { pstrlen, pstr, info_hash, peer_id };

  //check if info hash is same or not !!

  if (!Buffer.compare(torrentUtils.getInfoHash(torrent), result.info_hash))
    return 1;

  return 0;
};
const parseBitfield = (bitfield) => {
  let parsed = [];
  for (let offset = 0; offset < bitfield.length; offset += 1) {
    let temp = bitfield.readUInt8(offset).toString(2);
    temp = temp.padStart(8, "0");
    // console.log(temp);
    parsed.push(temp);
  }
  // for (let i = 0; i < bitfield.length; i++) {
  //   parsed.push(bitfield.readUInt8(i).toString(2));
  // }
  parsed = parsed.join("");
  // console.log("PARSED", parsed.length, parsed, bitfield.length, bitfield);
  // console.log(parsed);
  // console.log(bitfield);
  return parsed;
};
const parseResponse = (data, torrent) => {
  if (parseHandshake(data, torrent)) return { type: "handshake" };
  let len = data.readUInt32BE(0);
  let id = -1;
  let payload = {};
  if (len + 4 >= 5) {
    id = data.readUInt8(4);
    switch (id) {
      case 4:
        payload["index"] = data.readUInt32BE(5);
        break;
      case 5:
        // console.log("LENGTH IS - ", len)
        payload["bitfield"] = parseBitfield(data.slice(5));
        break;
      case 6:
      case 8:
        payload["index"] = data.readUInt32BE(5);
        payload["begin"] = data.readUInt32BE(9);
        payload["length"] = data.readUInt32BE(13);
        break;
      case 7:
        // console.log("PIECE");
        payload["index"] = data.readUInt32BE(5);
        payload["begin"] = data.readUInt32BE(9);
        payload["block"] = data.slice(13);
        break;
    }
  }
  if (!messageId[id]) {
    console.log("length is - ", len);
  }
  return {
    type: messageId[id] ? messageId[id] : "ignore",
    payload: payload,
    size: len,
    id: id,
    len: len,
  };
};
module.exports = {
  parseResponse,
  piece,
  keepAlive,
  interested,
  notInterested,
  have,
  bitfield,
  choke,
  unChoke,
  request,
  cancel,
  handshake,
  parseHandshake,
  messageId,
  parseBitfield,
};
