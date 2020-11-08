const walk = function (dir, files, level, type, done) {
  if (!type) {
    done(files);
    return;
  }
  fs.readdir(dir, function (error, list) {
    if (error) {
      return done(error);
    }
    let i = 0;

    (function next() {
      let file = list[i++];

      if (!file) {
        return done(null);
      }

      file = dir + "/" + file;

      fs.stat(file, function (error, stat) {
        if (stat && stat.isDirectory()) {
          files.push({
            path: file.substring(file.lastIndexOf("/")),
            level: level,
            size: 0,
          });
          walk(file, files, level + 1, type, function (error) {
            next();
          });
        } else {
          const current = fs.openSync(file, "r+");
          // console.log(file.substring(metaData.index + 1));
          files.push({
            path: file.substring(file.lastIndexOf("/")),
            size: 1,
            level: level,
          });

          next();
        }
      });
    })();
  });
};
