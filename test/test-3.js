var __extends = this.__extends || function (d, b) {
        for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
        function __() { this.constructor = d; }
        __.prototype = b.prototype;
        d.prototype = new __();
    };
/// <reference path="typings/tsd.d.ts" />
var fs = require('fs');
var path = require('path');
var time = new Date;
var Stats = (function (_super) {
    __extends(Stats, _super);
    function Stats() {
        _super.apply(this, arguments);
        this.uid = process.getuid();
        this.gid = process.getgid();
        this.rdev = 0;
        this.blksize = 4096;
        this.ino = 0;
        this.size = 0;
        this.blocks = 1;
        this.atime = time;
        this.mtime = time;
        this.ctime = time;
        this.birthtime = time;
        this.dev = 0;
        this.mode = 0;
        this.nlink = 0;
        this._isFile = false;
        this._isDirectory = false;
    }
    Stats.build = function (node) {
        var stats = new Stats;
        if (node instanceof LDirectory) {
            stats._isDirectory = true;
        }
        else if (node instanceof LFile) {
            var data = node.getData();
            stats.size = data.length;
            stats._isFile = true;
        }
        return stats;
    };
    Stats.prototype.isFile = function () {
        return this._isFile;
    };
    Stats.prototype.isDirectory = function () {
        return this._isDirectory;
    };
    return Stats;
})(fs.Stats);
var LNode = (function () {
    function LNode(layer, path) {
        // File descriptor, negative, because real file descriptors cannot be negative.
        this.fd = LNode.fd--;
        this.layer = layer;
        this.path = path;
    }
    LNode.prototype.getData = function () {
        return '';
    };
    LNode.prototype.setData = function (data) {
    };
    LNode.prototype.stats = function () {
        return Stats.build(this);
    };
    LNode.prototype.rename = function (new_name) {
        new_name = this.layer.getRelativePath(new_name);
        var old_name = this.path;
        this.path = new_name;
        this.layer.nodes[new_name] = this;
        delete this.layer.nodes[old_name];
        return new_name;
    };
    LNode.fd = -1;
    return LNode;
})();
var LFile = (function (_super) {
    __extends(LFile, _super);
    function LFile() {
        _super.apply(this, arguments);
    }
    LFile.prototype.getData = function () {
        return this.layer.files[this.path];
    };
    LFile.prototype.setData = function (data) {
        this.layer.files[this.path] = data.toString();
    };
    LFile.prototype.stats = function () {
        return Stats.build(this);
    };
    LFile.prototype.rename = function (new_name) {
        var old_name = this.path;
        new_name = _super.prototype.rename.call(this, new_name);
        this.layer.files[new_name] = this.layer.files[old_name];
        delete this.layer.files[old_name];
    };
    return LFile;
})(LNode);
var LDirectory = (function (_super) {
    __extends(LDirectory, _super);
    function LDirectory() {
        _super.apply(this, arguments);
    }
    return LDirectory;
})(LNode);
/**
 * A single `JSON` file of data mounted to a single mount point.
 */
var Layer = (function () {
    function Layer(mountpoint) {
        /**
         * A map of relative file names to file contents 'string'.
         * {
         *  "test.txt": "...."
         *  "some/path/hello.txt": "world ..."
         * }
         */
        this.files = {};
        /**
         * Relative path mapping to `LNode` objects.
         */
        this.nodes = {};
        /**
         * A map of pseudo 'file descriptors' to LNodes.
         */
        this.fds = {};
        this.mountpoint = path.resolve(mountpoint) + path.sep;
    }
    Layer.prototype.getRelativePath = function (filepath) {
        return path.relative(this.mountpoint, filepath);
    };
    Layer.prototype.getNode = function (p) {
        var relative = this.getRelativePath(p);
        if (this.nodes[relative])
            return this.nodes[relative];
        else
            return null;
    };
    Layer.prototype.getFile = function (p) {
        var node = this.getNode(p);
        return node instanceof LFile ? node : null;
    };
    Layer.prototype.getDirectory = function (p) {
        var node = this.getNode(p);
        return node instanceof LDirectory ? node : null;
    };
    Layer.prototype.getByFd = function (fd) {
        return this.fds[fd];
    };
    Layer.prototype.addNode = function (node) {
        if (node instanceof LFile) {
            this.nodes[node.path] = node;
        }
        this.fds[node.fd] = node;
        var parts = node.path.split(path.sep);
        if (parts.length > 1) {
            var p = parts[0];
            for (var i = 1; i < parts.length; i++) {
                this.nodes[p] = new LDirectory(this, p);
                p += path.sep + parts[i];
            }
        }
    };
    Layer.prototype.generateNodes = function (archive) {
        if (archive === void 0) { archive = {}; }
        this.files = archive;
        for (var filepath in this.files) {
            var node = new LFile(this, filepath);
            this.addNode(node);
        }
    };
    return Layer;
})();
/**
 * A collection of layers.
 */
var Drive = (function () {
    function Drive() {
        /**
         * Collection of file layers, where the top ones owerride the bottom ones.
         */
        this.layers = [];
        /**
         * `fs` overrides already attached.
         */
        this.attached = false;
    }
    /**
     * Attach this drive to `fs`.
     */
    Drive.prototype.attach = function () {
        if (!this.attached) {
            var self = this;
            // fs.readFileSync(filename[, options])
            var readFileSync = fs.readFileSync;
            fs.readFileSync = function (file, opts) {
                var f = self.getFile(file);
                if (f)
                    return opts ? f.getData() : new Buffer(f.getData());
                else
                    return readFileSync.apply(fs, arguments);
            };
            // fs.readFile(filename[, options], callback)
            var readFile = fs.readFile;
            fs.readFile = function (file, opts, cb) {
                if (typeof opts == "function") {
                    cb = opts;
                    opts = null;
                }
                var f = self.getFile(file);
                if (f) {
                    if ((typeof opts == "object") && opts.encoding) {
                        cb(null, f.getData());
                    }
                    else {
                        cb(null, new Buffer(f.getData()));
                    }
                }
                else
                    return readFile.apply(fs, arguments);
            };
            // fs.realpathSync(path[, cache])
            var realPathSync = fs.realPathSync;
            fs.realPathSync = function (file, opts) {
                var filepath = self.getFilePath(file);
                if (filepath !== null)
                    return filepath;
                else
                    return realPathSync.apply(fs, arguments);
            };
            // fs.statSync(path)
            var realpath = fs.realpath;
            fs.realpath = function (filepath, cache, callback) {
                if (typeof cache == "function")
                    callback = cache;
                filepath = self.getFilePath(filepath);
                if (filepath !== null) {
                    process.nextTick(function () {
                        callback(null, filepath);
                    });
                }
                else
                    realpath.apply(fs, arguments);
            };
            // fs.statSync(path)
            var statSync = fs.statSync;
            fs.statSync = function (p) {
                var f = self.getNode(p);
                return f ? f.stats() : statSync.apply(fs, arguments);
            };
            // fs.lstatSync(path)
            var lstatSync = fs.lstatSync;
            fs.lstatSync = function (p) {
                var f = self.getNode(p);
                return f ? f.stats() : lstatSync.apply(fs, arguments);
            };
            //fs.renameSync(oldPath, newPath)
            var renameSync = fs.renameSync;
            fs.renameSync = function (oldPath, newPath) {
                var n = self.getNode(oldPath);
                if (n)
                    n.rename(newPath);
                else
                    return renameSync.apply(fs, arguments);
            };
            //fs.renameSync(oldPath, newPath)
            var rename = fs.rename;
            fs.rename = function (oldPath, newPath, cb) {
                var n = self.getNode(oldPath);
                if (n) {
                    n.rename(newPath);
                    process.nextTick(cb);
                }
                else
                    return rename.apply(fs, arguments);
            };
            //fs.fstatSync(fd)
            var fstatSync = fs.fstatSync;
            fs.fstatSync = function (fd) {
                var n = self.getByFd(fd);
                return n ? n.stats() : fstatSync.apply(fs, arguments);
            };
            // fs.fstat(fd, callback)
            var fstat = fs.fstat;
            fs.fstat = function (fd, callback) {
                var n = self.getByFd(fd);
                if (n)
                    process.nextTick(function () {
                        callback(null, n.stats());
                    });
                else
                    fstat.apply(fs, arguments);
            };
            // fs.writeFileSync(filename, data[, options])
            var writeFileSync = fs.writeFileSync;
            fs.writeFileSync = function (filename, data, options) {
                var n = self.getFile(filename);
                if (n) {
                    n.setData(data);
                    return undefined;
                }
                else {
                    return writeFileSync.apply(fs, arguments);
                }
            };
            // fs.writeFile(filename, data[, options], callback)
            var writeFile = fs.writeFile;
            fs.writeFile = function (filename, data, options, callback) {
                if (typeof options == "function") {
                    callback = options;
                }
                var n = self.getFile(filename);
                if (n) {
                    n.setData(data);
                    if (callback)
                        process.nextTick(callback);
                }
                else {
                    writeFile.apply(fs, arguments);
                }
            };
            // fs.existsSync(filename)
            var existsSync = fs.existsSync;
            fs.existsSync = function (filename) {
                var n = self.getFile(filename);
                return n ? true : existsSync.apply(fs, filename);
            };
            // fs.exists(filename, callback)
            var exists = fs.exists;
            fs.exists = function (filename, callback) {
                var n = self.getFile(filename);
                if (n) {
                    if (callback)
                        process.nextTick(function () {
                            callback(true);
                        });
                }
                else {
                    writeFile.apply(fs, arguments);
                }
            };
        }
        this.attached = true;
    };
    Drive.prototype.addLayer = function (layer) {
        this.layers.push(layer);
    };
    Drive.prototype.getFilePath = function (p) {
        var filepath = path.resolve(p);
        var node = this.getNode(filepath);
        return node ? node : null;
    };
    Drive.prototype.getNode = function (p) {
        var filepath = path.resolve(p);
        for (var i = 0; i < this.layers.length; i++) {
            var n = this.layers[i].getNode(filepath);
            if (n)
                return n;
        }
        return null;
    };
    Drive.prototype.getFile = function (p) {
        var node = this.getNode(p);
        return node instanceof LFile ? node : null;
    };
    Drive.prototype.getDirectory = function (p) {
        var node = this.getNode(p);
        return node instanceof LFile ? node : null;
    };
    Drive.prototype.getByFd = function (fd) {
        for (var i = 0; i < this.layers.length; i++) {
            var n = this.layers[i].getByFd(fd);
            if (n)
                return n;
        }
        return null;
    };
    Drive.prototype.mount = function (mountpoint, archive) {
        if (archive === void 0) { archive = {}; }
        if (!fs.existsSync(mountpoint))
            throw Error("Mount point does not exist: " + mountpoint);
        if (!fs.statSync(mountpoint).isDirectory())
            throw Error("Mount point is not a directory: " + mountpoint);
        var layer = new Layer(mountpoint);
        layer.generateNodes(archive);
        this.addLayer(layer);
        this.attach();
    };
    return Drive;
})();
var nodefs = function nodefs() {
};
nodefs.Stats = Stats;
nodefs.LNode = LNode;
nodefs.LFile = LFile;
nodefs.LDirectory = LDirectory;
nodefs.Layer = Layer;
nodefs.Drive = Drive;
nodefs.mount = function (mountpoint, archive) {
    if (archive === void 0) { archive = {}; }
    var drive = new Drive;
    drive.mount(mountpoint, archive);
    return drive;
};
module.exports = nodefs;
