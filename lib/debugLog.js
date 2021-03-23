"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.success = exports.warn = exports.error = exports.info = exports.bindInfo = exports.chalk = void 0;
const chalks = require('chalk');
const log = console.log;
exports.chalk = new chalks.Instance({ level: 1 });
function bindInfo(onLog) {
    return (message) => {
        onLog && onLog(message);
        info(message);
    };
}
exports.bindInfo = bindInfo;
function info(info) {
    log(exports.chalk.bold.blue(info));
}
exports.info = info;
function error(info) {
    log(exports.chalk.bold.red(info));
}
exports.error = error;
function warn(info) {
    log(exports.chalk.bold.yellow(info));
}
exports.warn = warn;
function success(info) {
    log(exports.chalk.bold.green(info));
}
exports.success = success;
//# sourceMappingURL=debugLog.js.map