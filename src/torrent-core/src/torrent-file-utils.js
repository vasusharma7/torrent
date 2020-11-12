const crypto = require("crypto");
const bencode = require("bencode");
var seed = require("random-bytes-seed");
const { Torrent } = require("./torrent");

crypto.randomBytes = seed("random-constant");

module.exports.getInfoHash = (torrent) => {
  const info = bencode.encode(torrent.info);

  const crypted = crypto.createHash("sha1").update(info).digest();

  return crypted;
};

module.exports.myPeerId = () => {
  const buf = Buffer.alloc(20);
  const myId = crypto.randomBytes(12);
  buf.write("-VS7777-");
  myId.copy(buf, 8);

  return buf;
};

module.exports.left = (torrent) => {
  //   const block = Buffer.alloc(8);
  let size = torrent.info.files
    ? torrent.info.files.map((file) => file.length).reduce((a, b) => a + b)
    : torrent.info.length;
  size = Math.max(
    0,
    size - Torrent.prototype.downloaded.size * torrent.info["piece length"]
  );
  if (global.config.debug) console.log("left size", size);
  var buf = new Buffer.alloc(8);
  buf.fill(0);

  buf.writeUInt32BE(size >> 8, 0); //write the high order bits (shifted over)
  buf.writeUInt32BE(size & 0x00ff, 4); //write the low order bits

  return buf;
};
