const path = require("path");
module.exports = global.config = {
  debug: true,
  port: 6887,
  hostPort: 6887,
  hostname: "0.0.0.0",
  maxConnections: 10,
  progress: true,
  info: true,
  activate: `chmod 400 ${path.join(
    __dirname,
    "..",
    "ssh-tunnel",
    "eagle_nest.pem"
  )}`,
  ssh: [
    `ssh   -i ${path.join(
      __dirname,
      "..",
      "ssh-tunnel",
      "eagle_nest.pem"
    )} -R 5002:localhost:6887 -N ubuntu@18.225.11.191`,
    `ssh   -i ${path.join(
      __dirname,
      "..",
      "ssh-tunnel",
      "eagle_nest.pem"
    )} -R 5003:localhost:6887 -N ubuntu@18.225.11.191`,
    `ssh -i ${path.join(
      __dirname,
      "..",
      "ssh-tunnel",
      "eagle_nest.pem"
    )} -R 5004:localhost:6887 -N ubuntu@18.225.11.191`,
  ],
  ip: "18.225.11.191",
};
