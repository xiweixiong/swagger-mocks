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
exports.OriginBaseReader = void 0;
const translate_1 = require("../translate");
const _ = require("lodash");
const utils_1 = require("../utils");
const axios = require("axios");
class OriginBaseReader {
    constructor(config) {
        this.config = config;
        this.report = console.log;
    }
    translateChinese(jsonString) {
        return __awaiter(this, void 0, void 0, function* () {
            let retString = jsonString;
            try {
                const matchItems = jsonString
                    .match(/"[a-z0-9\s-]*[\u4e00-\u9fa5]+[a-z0-9\s-«»()\u4e00-\u9fa5]*":/gi);
                if (!matchItems) {
                    return retString;
                }
                let chineseKeyCollect = matchItems.map((item) => item.replace(/["":]/g, ''));
                chineseKeyCollect = _.uniq(chineseKeyCollect.map((item) => (item.includes('«') ? item.split('«')[0] : item)));
                chineseKeyCollect.sort((pre, next) => next.length - pre.length);
                let result = yield Promise.all(chineseKeyCollect.map((text) => translate_1.Translator.translateAsync(text)));
                const toRegStr = (str) => str.replace(/(\W)/g, '\\$1');
                result.forEach((enKey, index) => {
                    const chineseKey = chineseKeyCollect[index];
                    if (enKey) {
                        retString = retString.replace(eval(`/${toRegStr(chineseKey)}/g`), enKey);
                    }
                });
                return retString;
            }
            catch (err) {
                return retString;
            }
        });
    }
    transform2Standard(data) {
        return data;
    }
    fetchMethod(url) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield axios.default.get(url);
            return JSON.stringify(res.data);
        });
    }
    fetchData() {
        return __awaiter(this, void 0, void 0, function* () {
            this.report('获取远程数据中...');
            const data = [];
            for (let i = 0; i < this.config.origins.length; i++) {
                const o = this.config.origins[i];
                let swaggerJsonStr = yield this.fetchMethod(o.originUrl);
                swaggerJsonStr = yield this.translateChinese(swaggerJsonStr);
                data.push(JSON.parse(swaggerJsonStr));
            }
            this.report('远程数据获取成功！');
            return data;
        });
    }
    fetchRemoteData() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield this.fetchData();
                let remoteDataSource = data.map((v) => this.transform2Standard(v));
                this.report('远程数据解析完毕!');
                remoteDataSource.forEach((v) => this.checkDataSource(v));
                this.report('解析后数据校验完毕！');
                this.report('远程对象创建完毕！');
                return remoteDataSource;
            }
            catch (e) {
                throw new Error('读取远程接口数据失败！' + e.toString());
            }
        });
    }
    checkDataSource(dataSource) {
        const { mods, baseClasses } = dataSource;
        const errorModNames = [];
        const errorBaseNames = [];
        mods.forEach((mod) => {
            if (utils_1.hasChinese(mod.name)) {
                errorModNames.push(mod.name);
            }
        });
        baseClasses.forEach((base) => {
            if (utils_1.hasChinese(base.name)) {
                errorBaseNames.push(base.name);
            }
        });
        if (errorBaseNames.length && errorModNames.length) {
            const errMsg = ['当前数据源有如下项不符合规范，需要后端修改'];
            errorModNames.forEach((modName) => errMsg.push(`模块名${modName}应该改为英文名！`));
            errorBaseNames.forEach((baseName) => errMsg.push(`基类名${baseName}应该改为英文名！`));
            throw new Error(errMsg.join('\n'));
        }
    }
}
exports.OriginBaseReader = OriginBaseReader;
//# sourceMappingURL=base.js.map