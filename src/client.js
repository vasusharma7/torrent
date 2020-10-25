class Client {
  constructor(seeder, server, socket) {
    this.seeder = seeder;
    this.server = server;
    this.socket = socket;
    this.state = {
      isChoked: true,
      isInterested: false,
      choked: true,
      amInterested: false,
      handshake: false,
    };
    //this property shows the number of characters currently buffered to be written. (Number of characters is approximately equal to the number of bytes to be written, but the buffer may contain strings, and the strings are lazily encoded, so the exact number of bytes is not known.)
    //Users who experience large or growing bufferSize should attempt to "throttle" the data flows in their program with pause() and resume().
    console.log("Buffer size : " + socket.bufferSize);

    console.log("------------remote client info --------------");

    var rport = socket.remotePort;
    var raddr = socket.remoteAddress;
    var rfamily = socket.remoteFamily;

    console.log("REMOTE Socket is listening at port" + rport);
    console.log("REMOTE Socket ip :" + raddr);
    console.log("REMOTE Socket is IP4/IP6 : " + rfamily);
    this.info = {
      ip: raddr,
      port: rport,
    };

    socket.setEncoding("utf8");

    socket.setTimeout(800000, function () {
      console.log("Socket timed out");
    });

    socket.on("data", function (data) {
      try {
        var bread = socket.bytesRead;
        var bwrite = socket.bytesWritten;
        console.log("Bytes read : " + bread);
        console.log("Bytes written : " + bwrite);
        console.log("Data sent to server : " + data);

        //echo data
        buffer = Buffer.concat([buffer, data]);
        // console.log(buffer.length)
        while (buffer.length > 4 && buffer.length >= this.msgLen(buffer)) {
          // console.log("getting buffer",buffer.length,msgLen(buffer));
          this.parseData(buffer.slice(0, msgLen(buffer)));
          buffer = buffer.slice(msgLen(buffer));
        }
      } catch (err) {
        console.log("\t\t\t~~~~~~~~error~~~~~~~~~~\n", err.message);
      }
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
  }

  parseData = (data) => {
    const parsed = messages.parseResponse(data, this.torrent);
    switch (parsed.type) {
      case "handshake":
        this.handleHandshake(parsed);
        this.state.handshake = true;
        break;
      case "bitfield":
        console.log(
          "Client is sending bitfield messsage to a seeder ! so absurd"
        );
        break;
      case "piece":
        console.log("Client is sending in the piece to a seeder ! so absurd");
        break;
      case "interested":
        this.handleIntereded();
        break;
      case "not_interested":
        this.state.isInterested = false;
        break;
      case "request":
        this.handleRequest(parsed);
        break;
      case "have":
        console.log("Client is have info to a seeder ! so absurd");
        break;
      case "ignore":
        console.log("keep alive", parsed.id, parsed.len, this.info.ip);
        break;
      case "cancel":
        console.log("Client is cacelling a piece request");
        console.log("cancel", this.info.ip);
        break;
      case "unchoke":
        console.log("Client is unChoking a seeder ! so absurd");
        break;
      case "choke":
        console.log("Client is choking a seeder ! so absurd");
        break;
      default:
        console.log(parsed.type, parsed.id, parsed.len, this.info.ip);
        break;
    }
  };
  checkKernelBuffer = (is_kernel_buffer_full) => {
    if (is_kernel_buffer_full) {
      console.log(
        "Data was flushed successfully from kernel buffer i.e written successfully!"
      );
    } else {
      socket.pause();
    }
  };
  sendHave() {
    Torrent.prototype.sendHaves(this);
  }
  sendBitField() {
    //send the bitfield
    return;
  }
  /**
   *@summary send have - bitfield - unchoke
   */
  handleIntereded = () => {
    this.state.isInterested = true;
    this.sendHave();
    this.sendBitField();
    let is_kernel_buffer_full = this.socket.write(messages.unChoke());
    checkKernelBuffer(is_kernel_buffer_full);
    this.state.isChoked = false;
  };
  /**
   * @summary send handshake
   */
  handleHandshake = (parsed) => {
    if (parsed) {
      let is_kernel_buffer_full = this.socket.write(messages.handshake());
      checkKernelBuffer(is_kernel_buffer_full);
    } else this.socket.destroy();
  };
  handleRequest = (parsed) => {
    console.log(
      "xxxxxxxxxxxxxxxxxxxxxxxxx-----------------CLIENT IS REQUESTING----------------xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      parsed.payload
    );
    this.servePiece(this, parsed.payload);
  };
}
