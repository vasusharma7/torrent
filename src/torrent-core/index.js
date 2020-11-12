const chalk = require("chalk");
const clear = require("clear");
const figlet = require("figlet");
const inquirer = require("inquirer");
const { startTorrent } = require("./src/main.js");
const { makeTorrent } = require("./src/make-torrent");
const { ArgumentParser } = require("argparse");
const { version } = require("./package.json");
const process = require("process");
const { off } = require("process");
const { maxConnections } = require("./src/config.js");
const parser = new ArgumentParser({
  description: "VS Torrent",
});
parser.add_argument("-v", "--version", { action: "version", version });

parser.add_argument("-d", "--download", {
  help: "Path to Torrent file to download",
});

parser.add_argument("-c", "--connections", {
  help: "Maximum Peer Connections",
});

parser.add_argument("-n", "--name", {
  help: "Name of torrent file to be created",
});

parser.add_argument("-m", "--make", {
  help: "Path to File or Folder to make Torrent",
});

parser.add_argument("-t", "--type", {
  help: "Type of Torrent To Make - Single File (0) | Folder (1)",
});

parser.add_argument("-l", "--location", {
  help: "Path to donwload Torrent or save newly created file",
});

parser.add_argument("-w", "--trackerURLs", {
  help: "Tracker URLs for making torrent files - comma separated",
});
parser.add_argument("-u", "--upload-speed", {
  help: "Maximum Uplaod Speed",
});

parser.add_argument("-s", "--download-speed", {
  help: "Maximum Download Speed",
});

const askTorrentQuestions = () => {
  const questions = [
    {
      name: "torrent_file",
      type: "input",
      message: "Enter the path of torrent file:",
      validate: function (value) {
        if (value.endsWith(".torrent")) {
          return true;
        } else {
          return "Please enter the path of file with torrent extension";
        }
      },
    },
    {
      name: "destination",
      type: "file",
      basePath: "/",
      message: "Enter the path where you want to save the downloaded files:",
      validate: function (value) {
        if (value.length) {
          return true;
        } else {
          return "Please enter correct Path.";
        }
      },
    },

    {
      type: "input",
      name: "connections",
      message: "Maximum Peer Connections",
      validate: function (value) {
        if (value.length) {
          return true;
        } else {
          return "Please enter valid value";
        }
      },
    },
    {
      type: "input",
      name: "upload_speed",
      message: "Maximum Upload Speed",
      validate: function (value) {
        if (value.length) {
          return true;
        } else {
          return "Please enter valid value";
        }
      },
    },
    {
      type: "input",
      name: "download_speed",
      message: "Maximum Download Speed",
      validate: function (value) {
        if (value.length) {
          return true;
        } else {
          return "Please enter valid value";
        }
      },
    },
  ];
  return inquirer.prompt(questions);
};

const askMakeTorrent = () => {
  const questions = [
    {
      type: "checkbox",
      name: "type",
      message: "Select the type of torrent you want to create",
      choices: ["file", "folder"],
    },

    {
      type: "input",
      name: "location",
      message: "Enter the path of file/folder",
      validate: function (value) {
        if (value.length) {
          return true;
        } else {
          return "Please enter correct Path.";
        }
      },
    },
    {
      type: "input",
      name: "trackerURLS",
      message: "Enter tracker urls separated by comma",
      validate: function (value) {
        if (value.length) {
          return true;
        } else {
          return "Please enter valid urls";
        }
      },
    },
    {
      type: "input",
      name: "destination",
      message: "Enter the destination of torrent file",
      validate: function (value) {
        if (value.length) {
          return true;
        } else {
          return "Please enter correct Path.";
        }
      },
    },
    {
      type: "input",
      name: "name",
      message: "Name of torrent file without extension",
      validate: function (value) {
        if (value.length) {
          return true;
        } else {
          return "Please enter valid name.";
        }
      },
    },
  ];
  return inquirer.prompt(questions);
};
const mainChoices = () => {
  const questions = [
    {
      type: "checkbox",
      name: "type",
      message: "Select the operaton",
      choices: ["Create Torrent", "Start Torrent"],
    },
  ];
  return inquirer.prompt(questions);
};

const run = async () => {
  clear();

  console.log(
    chalk.green(figlet.textSync("VS Torrent", { horizontalLayout: "full" }))
  );
  if (process.argv.length == 2) {
    let info = await mainChoices();
    if (info.type == "Create Torrent") {
      info = await askMakeTorrent();
      let trackerURLS = [
        "udp://public.popcorn-tracker.org:6969/announce",
        "http://bt2.careland.com.cn:6969/announce",
      ];
      makeTorrent(
        info.location,
        info.trackerURLS.split(","),
        info.type == "folder",
        info.destination,
        info.name
      );
    } else {
      info = await askTorrentQuestions();
      // console.log(info);
      startTorrent(info.torrent_file, info.destination, {
        maxConnections: info.connections,
        uspeed: info.upload_speed,
        dspeed: info.download_speed,
      });
    }
  } else {
    const args = parser.parse_args();
    // console.log(args);
    if (!args.location) {
      console.log("Please provide location to save torrent, use -h for help");
      return;
    }
    if (args.download) {
      startTorrent(args.download, args.location, {
        maxConnections: parseInt(args.connections),
        uspeed: parseInt(args.upload_speed),
        dspeed: parseInt(args.download_speed),
      });
    } else if (args.make) {
      if (!(args.trackerURLs && args.type && args.location && args.name)) {
        console.log("Please provide all options, use -h for help");
        return;
      }
      makeTorrent(
        args.make,
        args.trackerURLs.split(","),
        args.type == "folder" || args.type == "1",
        args.location,
        args.name
      );
    }
  }
};
run();
