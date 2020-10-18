const crypto = require("crypto");
const bencode = require("bencode");
var seed = require("random-bytes-seed");
const bignum = require("bignum");
crypto.randomBytes = seed("random-constant");

module.exports.getInfoHash = (torrent) => {
  const info = bencode.encode(torrent.info);
  // console.log("1", crypto.createHash("sha1").update(info))
  const crypted = crypto.createHash("sha1").update(info).digest();
  // console.log("2", crypto.createHash("sha1").update(info).digest())
  // console.log("crypted hash", crypted);
  return crypted;
};

module.exports.myPeerId = () => {
  const buf = Buffer.alloc(20);
  const myId = crypto.randomBytes(12);
  buf.write("-VS7777-");
  myId.copy(buf, 8);
  // console.log(buf)
  return buf;
};

module.exports.left = (torrent) => {
  //   const block = Buffer.alloc(8);
  const size = torrent.info.files
    ? torrent.info.files.map((file) => file.length).reduce((a, b) => a + b)
    : torrent.info.length;
  //   console.log(size);
  //   block.writeBigUInt64BE(BigInt(size));
  // return block
  return bignum.toBuffer(size, { size: 8 });
};
