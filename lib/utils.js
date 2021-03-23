"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIPAdress = exports.format = exports.getIdentifierFromOperatorId = exports.toDashCase = exports.transformModsName = exports.transformCamelCase = exports.hasChinese = exports.getIdentifierFromUrl = exports.toUpperFirstLetter = exports.getMaxSamePath = exports.getDuplicateById = exports.fetchApiData = exports.judgeIsVaildUrl = exports.lookForFiles = exports.Surrounding = exports.MockToolsConfig = exports.RegexField = exports.Origin = exports.OUT_DIR = exports.CONFIG_FILE = void 0;
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const prettier = require("prettier");
const os = require("os");
exports.CONFIG_FILE = 'mocker-config.js';
exports.OUT_DIR = '.mocks';
class Origin {
    constructor(originUrl) {
        this.originUrl = originUrl || '';
        this.baseClass = '';
        this.baseClassWrapper = '';
        this.pageClass = '';
        this.pageClassWrapper = '';
    }
}
exports.Origin = Origin;
class RegexField {
    constructor(fieldName) {
        this.fieldName = fieldName;
    }
}
exports.RegexField = RegexField;
class MockToolsConfig {
    constructor() {
        this.origins = [];
        this.port = 8080;
        this.arrayNum = 3;
        this.prettierConfig = {
            parser: 'babel',
            printWidth: 200,
            tabWidth: 2,
            useTabs: false,
            semi: false,
            singleQuote: true,
            trailingComma: 'es5',
            bracketSpacing: true,
            arrowParens: 'always',
        };
        this.customFields = [
            { fieldName: '\\w*id\\b', mockValue: '@guid' },
            { fieldName: '\\w*image\\b', mockValue: '@image' },
            { fieldName: '\\w*mobile\\b', mockValue: '^1[3-9]\d{9}$' },
            { fieldName: '\\w*time\\b', mockValue: "@datetime('yyyy-MM-dd HH:mm:ss')" },
        ];
    }
    static createFromConfigPath(configPath) {
        try {
            const config = require(configPath);
            return config;
        }
        catch (e) {
            throw new Error('mocker-config.js is error');
        }
    }
}
exports.MockToolsConfig = MockToolsConfig;
var Surrounding;
(function (Surrounding) {
    Surrounding["typeScript"] = "typeScript";
    Surrounding["javaScript"] = "javaScript";
})(Surrounding = exports.Surrounding || (exports.Surrounding = {}));
function lookForFiles(dir, fileName) {
    return __awaiter(this, void 0, void 0, function* () {
        const files = yield fs.readdir(dir);
        for (let file of files) {
            const currName = path.join(dir, file);
            const info = yield fs.lstat(currName);
            if (info.isDirectory()) {
                if (file === '.git' || file === 'node_modules') {
                    continue;
                }
                const result = yield lookForFiles(currName, fileName);
                if (result) {
                    return result;
                }
            }
            else if (info.isFile() && file === fileName) {
                return currName;
            }
        }
    });
}
exports.lookForFiles = lookForFiles;
function judgeIsVaildUrl(url) {
    return /^(http|https):.*?$/.test(url);
}
exports.judgeIsVaildUrl = judgeIsVaildUrl;
const fetchApiData = (url) => __awaiter(void 0, void 0, void 0, function* () {
    let res = yield axios.default.get(url);
    return res.data;
});
exports.fetchApiData = fetchApiData;
function getDuplicateById(arr, idKey = 'name') {
    if (!arr || !arr.length) {
        return null;
    }
    let result;
    arr.forEach((item, itemIndex) => {
        if (arr.slice(0, itemIndex).find((o) => o[idKey] === item[idKey])) {
            result = item;
            return;
        }
    });
    return result;
}
exports.getDuplicateById = getDuplicateById;
function getMaxSamePath(paths, samePath = '') {
    if (!paths.length) {
        return samePath;
    }
    if (paths.some((path) => !path.includes('/'))) {
        return samePath;
    }
    const segs = paths.map((path) => {
        const [firstSeg, ...restSegs] = path.split('/');
        return { firstSeg, restSegs };
    });
    if (segs.every((seg, index) => index === 0 || seg.firstSeg === segs[index - 1].firstSeg)) {
        return getMaxSamePath(segs.map((seg) => seg.restSegs.join('/')), samePath + '/' + segs[0].firstSeg);
    }
    return samePath;
}
exports.getMaxSamePath = getMaxSamePath;
function toUpperFirstLetter(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
exports.toUpperFirstLetter = toUpperFirstLetter;
function getIdentifierFromUrl(url, requestType, samePath = '') {
    const currUrl = url.slice(samePath.length).match(/([^\.]+)/)[0];
    return (requestType +
        currUrl
            .split('/')
            .map((str) => {
            if (str.includes('-')) {
                str = str.replace(/(\-\w)+/g, (_match, p1) => {
                    if (p1) {
                        return p1.slice(1).toUpperCase();
                    }
                });
            }
            if (str.match(/^{.+}$/gim)) {
                return 'By' + toUpperFirstLetter(str.slice(1, str.length - 1));
            }
            return toUpperFirstLetter(str);
        })
            .join(''));
}
exports.getIdentifierFromUrl = getIdentifierFromUrl;
function hasChinese(str) {
    return (str &&
        str.match(/[\u4E00-\u9FCC\u3400-\u4DB5\uFA0E\uFA0F\uFA11\uFA13\uFA14\uFA1F\uFA21\uFA23\uFA24\uff1a\uff0c\uFA27-\uFA29]|[\ud840-\ud868][\udc00-\udfff]|\ud869[\udc00-\uded6\udf00-\udfff]|[\ud86a-\ud86c][\udc00-\udfff]|\ud86d[\udc00-\udf34\udf40-\udfff]|\ud86e[\udc00-\udc1d]|[\uff01-\uff5e\u3000-\u3009\u2026]/));
}
exports.hasChinese = hasChinese;
function transformCamelCase(name) {
    let words = [];
    let result = '';
    if (name.includes('-')) {
        words = name.split('-');
    }
    else if (name.includes(' ')) {
        words = name.split(' ');
    }
    else {
        if (typeof name === 'string') {
            result = name;
        }
        else {
            throw new Error('mod name is not a string: ' + name);
        }
    }
    if (words && words.length) {
        result = words
            .map((word) => {
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
            .join('');
    }
    result = result.charAt(0).toLowerCase() + result.slice(1);
    if (result.endsWith('Controller')) {
        result = result.slice(0, result.length - 'Controller'.length);
    }
    return result;
}
exports.transformCamelCase = transformCamelCase;
function transformModsName(mods) {
    mods.forEach((mod) => {
        const currName = mod.name;
        const sameMods = mods.filter((mod) => mod.name.toLowerCase() === currName.toLowerCase());
        if (sameMods.length > 1) {
            mod.name = transformDashCase(mod.name);
        }
    });
}
exports.transformModsName = transformModsName;
function transformDashCase(name) {
    return name.replace(/[A-Z]/g, (ch) => '_' + ch.toLowerCase());
}
function toDashCase(name) {
    const dashName = name
        .split(' ')
        .join('')
        .replace(/[A-Z]/g, (p) => '-' + p.toLowerCase());
    if (dashName.startsWith('-')) {
        return dashName.slice(1);
    }
    return dashName;
}
exports.toDashCase = toDashCase;
const TS_KEYWORDS = ['delete', 'export', 'import', 'new', 'function'];
const REPLACE_WORDS = ['remove', 'exporting', 'importing', 'create', 'functionLoad'];
function getIdentifierFromOperatorId(operationId) {
    const identifier = operationId.replace(/(.+)(Using.+)/, '$1');
    const index = TS_KEYWORDS.indexOf(identifier);
    if (index === -1) {
        return identifier;
    }
    return REPLACE_WORDS[index];
}
exports.getIdentifierFromOperatorId = getIdentifierFromOperatorId;
function format(fileContent, prettierOpts = {}) {
    try {
        return prettier.format(fileContent, Object.assign({ parser: 'typescript', trailingComma: 'all', singleQuote: true }, prettierOpts));
    }
    catch (e) {
        console.log(`代码格式化报错！${e.toString()}\n代码为：${fileContent}`);
        return fileContent;
    }
}
exports.format = format;
function getIPAdress() {
    var interfaces = os.networkInterfaces();
    for (var devName in interfaces) {
        var iface = interfaces[devName];
        for (var i = 0; i < iface.length; i++) {
            var alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
}
exports.getIPAdress = getIPAdress;
//# sourceMappingURL=utils.js.map