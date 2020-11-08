module.exports = global.config = {
  // debug: false,
  // port: 6777,
  // hostname: "0.0.0.0",
  // maxConnections: 10,
  // progress: true,
  // electron: true,
  debug: true,
  port: 6777,
  hostPort: 6777,
  hostname: "0.0.0.0",
  maxConnections: 10,
  progress: true,
  electron: false,
  ssh:
    "ssh -i ~/keys/eagle_nest.pem -R 5000:localhost:6777 -N ubuntu@18.225.11.191",
  ip: "18.225.11.191",
};
