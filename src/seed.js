const { Torrent } = require("./torrent");
const net = require("net");

class Seeder {
  constructor(hostname, port, maxConnections, torrent, pieces, pieceLen) {
    this.torrent = torrent;
    this.pieces = pieces;
    this.pieceLen = pieceLen;
    this.hostname = hostname;
    this.port = port;
    this.server = net.createServer();
    this.clients = [];
    // emits when any error occurs -> calls closed event immediately after this.
    this.server.on("error", function (error) {
      if (global.config.debug) console.log("Error: " + error);
    });

    //emits when server is bound with server.listen
    this.server.on("listening", function () {
      if (global.config.debug) console.log("Server is listening!");
    });

    this.server.maxConnections = maxConnections;

    this.islistening = this.server.listening;

    if (this.islistening) {
      if (global.config.debug) console.log("Server is listening");
      var address = self.server.address();
      var port = address.port;
      var family = address.family;
      var ipaddr = address.address;
      if (global.config.debug)
        console.log("Server is listening at port" + port);
      if (global.config.debug) console.log("Server ip :" + ipaddr);
      if (global.config.debug) console.log("Server is IP4/IP6 : " + family);
    } else {
      if (global.config.debug) console.log("Server is not listening");
    }

    // setTimeout(function () {
    //   this.server.close();
    // }, 5000000);
  }
  execute() {
    //static port allocation
    this.server.listen(this.port, this.hostname);

    // emitted when new client connects
    let self = this;
    this.server.on("connection", function (socket) {
      let info = { port: socket.remotePort, ip: socket.remoteAddress };
      if (global.config.debug) console.log("A client Connected");
      if (global.config.debug) console.table(info);
      let peer = new global.config.Peer(
        info,
        self.torrent,
        self.pieces,
        self.pieceLen,
        socket
      );
      self.clients.push(peer);
      Torrent.prototype.connectedPeers.push(peer);
      peer.execute();

      if (global.config.debug)
        console.log("---------server details -----------------");

      var address = self.server.address();
      var port = address.port;
      var family = address.family;
      var ipaddr = address.address;
      if (global.config.debug)
        console.log("Server is listening at port" + port);
      if (global.config.debug) console.log("Server ip :" + ipaddr);
      if (global.config.debug) console.log("Server is IP4/IP6 : " + family);

      if (global.config.debug)
        console.log("--------------------------------------------");

      var lport = socket.localPort;
      var laddr = socket.localAddress;
      if (global.config.debug)
        console.log("Server is listening at LOCAL port" + lport);
      if (global.config.debug) console.log("Server LOCAL ip :" + laddr);

      if (global.config.debug)
        console.log("--------------------------------------------");
      self.server.getConnections((error, count) => {
        if (global.config.debug)
          console.log(
            "Number of concurrent connections to the server : " + count
          );
      });
    });

    // var no_of_connections =  server.getConnections(); // sychronous version
  }
}

module.exports = Seeder;
