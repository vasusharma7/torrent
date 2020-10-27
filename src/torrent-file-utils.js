const crypto = require("crypto");
const bencode = require("bencode");
var seed = require("random-bytes-seed");
// const toBufferBE = require("bigint-buffer").toBufferBE;
crypto.randomBytes = seed("random-constant");

module.exports.getInfoHash = (torrent) => {
  const info = bencode.encode(torrent.info);
  // if(global.config.debug)console.log("1", crypto.createHash("sha1").update(info))
  const crypted = crypto.createHash("sha1").update(info).digest();
  // if(global.config.debug)console.log("2", crypto.createHash("sha1").update(info).digest())
  // if(global.config.debug)console.log("crypted hash", crypted);
  return crypted;
};

module.exports.myPeerId = () => {
  const buf = Buffer.alloc(20);
  const myId = crypto.randomBytes(12);
  buf.write("-VS7777-");
  myId.copy(buf, 8);
  // if(global.config.debug)console.log(buf)
  return buf;
};

module.exports.left = (torrent) => {
  //   const block = Buffer.alloc(8);
  const size = torrent.info.files
    ? torrent.info.files.map((file) => file.length).reduce((a, b) => a + b)
    : torrent.info.length;

  var buf = new Buffer.alloc(8);
  buf.fill(0);

  buf.writeUInt32BE(size >> 8, 0); //write the high order bits (shifted over)
  buf.writeUInt32BE(size & 0x00ff, 4); //write the low order bits

  return buf;

  //   if(global.config.debug)console.log(size);
  //   block.writeBigUInt64BE(BigInt(size));
  // return block

  // return toBufferBE(parseInt(size, 16), 8);
};
