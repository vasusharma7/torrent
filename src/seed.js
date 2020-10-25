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
      console.log("Error: " + error);
    });

    //emits when server is bound with server.listen
    this.server.on("listening", function () {
      console.log("Server is listening!");
    });

    this.server.maxConnections = maxConnections;

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
    //static port allocation
    this.server.listen(this.port, this.hostname);

    // emitted when new client connects
    let self = this;
    this.server.on("connection", function (socket) {
      let info = { port: socket.remotePort, ip: socket.remoteAddress };
      console.log("A client Connected");
      console.table(info);
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

      console.log("---------server details -----------------");

      var address = self.server.address();
      var port = address.port;
      var family = address.family;
      var ipaddr = address.address;
      console.log("Server is listening at port" + port);
      console.log("Server ip :" + ipaddr);
      console.log("Server is IP4/IP6 : " + family);

      console.log("--------------------------------------------");

      var lport = socket.localPort;
      var laddr = socket.localAddress;
      console.log("Server is listening at LOCAL port" + lport);
      console.log("Server LOCAL ip :" + laddr);

      console.log("--------------------------------------------");
      self.server.getConnections((error, count) => {
        console.log(
          "Number of concurrent connections to the server : " + count
        );
      });
    });

    // var no_of_connections =  server.getConnections(); // sychronous version
  }
}

module.exports = Seeder;
