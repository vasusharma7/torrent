require("./config");
const { Torrent } = require("./torrent");
const net = require("net");
const { Socket } = require("dgram");
let port = global.config.myPort;
let hostname = "0.0.0.0";
let buffer = Buffer.alloc(0);
msgLen = (data) => {
  if (!this.handshake) {
    return 49 + data.readUInt8(0);
  } else {
    return 4 + data.readUInt32BE(0);
  }
};
class Seeder {
  constructor(hostname, port, maxConnections) {
    this.server = net.createServer();
    this.server.listen(port, hostname, function () {
      console.log(`Seed Server is listening on ${hostname}:${port}`);
    });
    // emits when any error occurs -> calls closed event immediately after this.
    this.server.on("error", function (error) {
      console.log("Error: " + error);
    });

    //emits when server is bound with server.listen
    this.server.on("listening", function () {
      console.log("Server is listening!");
    });

    this.server.maxConnections = maxConnections;

    //static port allocation
    this.server.listen(port, hostname);

    this.islistening = this.server.listening;

    if (this.islistening) {
      console.log("Server is listening");
    } else {
      console.log("Server is not listening");
    }

    setTimeout(function () {
      this.server.close();
    }, 5000000);
  }
  execute() {
    // emitted when new client connects
    this.server.on("connection", function (socket) {
      //this property shows the number of characters currently buffered to be written. (Number of characters is approximately equal to the number of bytes to be written, but the buffer may contain strings, and the strings are lazily encoded, so the exact number of bytes is not known.)
      //Users who experience large or growing bufferSize should attempt to "throttle" the data flows in their program with pause() and resume().
      let server = this.server;
      console.log("Buffer size : " + socket.bufferSize);

      console.log("---------server details -----------------");

      var address = server.address();
      var port = address.port;
      var family = address.family;
      var ipaddr = address.address;
      console.log("Server is listening at port" + port);
      console.log("Server ip :" + ipaddr);
      console.log("Server is IP4/IP6 : " + family);

      var lport = socket.localPort;
      var laddr = socket.localAddress;
      console.log("Server is listening at LOCAL port" + lport);
      console.log("Server LOCAL ip :" + laddr);

      console.log("------------remote client info --------------");

      var rport = socket.remotePort;
      var raddr = socket.remoteAddress;
      var rfamily = socket.remoteFamily;

      console.log("REMOTE Socket is listening at port" + rport);
      console.log("REMOTE Socket ip :" + raddr);
      console.log("REMOTE Socket is IP4/IP6 : " + rfamily);

      console.log("--------------------------------------------");
      // var no_of_connections =  server.getConnections(); // sychronous version
      server.getConnections((error, count) => {
        console.log(
          "Number of concurrent connections to the server : " + count
        );
      });

      socket.setEncoding("utf8");

      socket.setTimeout(800000, function () {
        console.log("Socket timed out");
      });

      socket.on("data", function (data) {
        var bread = socket.bytesRead;
        var bwrite = socket.bytesWritten;
        console.log("Bytes read : " + bread);
        console.log("Bytes written : " + bwrite);
        console.log("Data sent to server : " + data);

        //echo data
        buffer = Buffer.concat([buffer, data]);
        // console.log(buffer.length)
        while (buffer.length > 4 && buffer.length >= msgLen(buffer)) {
          // console.log("getting buffer",buffer.length,msgLen(buffer));
          parseData(buffer.slice(0, msgLen(buffer)));
          buffer = buffer.slice(msgLen(buffer));
        }
        // var is_kernel_buffer_full = socket.write("Data ::" + data);
        // if (is_kernel_buffer_full) {
        //   console.log(
        //     "Data was flushed successfully from kernel buffer i.e written successfully!"
        //   );
        // } else {
        //   socket.pause();
        // }
      });

      socket.on("drain", function () {
        console.log(
          "write buffer is empty now .. u can resume the writable stream"
        );
        socket.resume();
      });

      socket.on("error", function (error) {
        console.log("Error : " + error);
      });

      socket.on("timeout", function () {
        console.log("Socket timed out !");
        socket.end("Timed out!");
        // can call socket.destroy() here too.
      });

      socket.on("end", function (data) {
        console.log("Socket ended from other end!");
        console.log("End data : " + data);
      });

      socket.on("close", function (error) {
        var bread = socket.bytesRead;
        var bwrite = socket.bytesWritten;
        console.log("Bytes read : " + bread);
        console.log("Bytes written : " + bwrite);
        console.log("Socket closed!");
        if (error) {
          console.log("Socket was closed coz of transmission error");
        }
      });

      setTimeout(function () {
        var isdestroyed = socket.destroyed;
        console.log("Socket destroyed:" + isdestroyed);
        socket.destroy();
      }, 1200000);
    });
  }
}
let seed = new Seeder(hostname, port, 10);
seed.execute();

module.exports = Seeder;
