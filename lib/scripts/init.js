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
exports.generateMockConfig = void 0;
const inquirer = require("inquirer");
const path = require("path");
const fs = require("fs-extra");
const debugLog = require("../debugLog");
const utils_1 = require("../utils");
const promptList = [
    {
        type: 'input',
        message: '请设置数据源地址，多个使用英文逗号(,)隔开',
        name: 'originUrl',
        validate: (originUrl) => {
            if (!utils_1.judgeIsVaildUrl(originUrl)) {
                return '请输入正确的数据源地址';
            }
            return true;
        },
    },
    {
        type: 'input',
        message: '请输入mock服务端口',
        name: 'port',
        default: 8080,
    },
];
function generateMockConfig() {
    return __awaiter(this, void 0, void 0, function* () {
        const configPath = yield utils_1.lookForFiles(process.cwd(), utils_1.CONFIG_FILE);
        if (configPath) {
            const result = yield inquirer.prompt({
                type: 'confirm',
                name: 'confirm',
                default: true,
                message: `检测到已存在mock-config文件，继续生成将覆盖配置项，是否继续？`,
            });
            if (!result.confirm) {
                return;
            }
        }
        debugLog.info('配置文件生成中...');
        const answers = yield inquirer.prompt(promptList);
        generateConfig(configPath, answers);
        debugLog.success('文件生成成功。');
        debugLog.info(`
    其余配置项请参阅官方文档 https://github.com/alibaba/pont
  `);
    });
}
exports.generateMockConfig = generateMockConfig;
function generateConfig(configPath, answers) {
    const { originUrl, port } = answers;
    const dirName = path.join(process.cwd(), '/mock-config.js');
    let config = new utils_1.MockToolsConfig();
    if (configPath) {
        config = utils_1.MockToolsConfig.createFromConfigPath(configPath);
    }
    const origins = originUrl.split(',').map((v) => new utils_1.Origin(v));
    config.origins = origins;
    config.port = port;
    fs.writeFileSync(configPath || dirName, JSON.stringify(config, null, 2));
}
//# sourceMappingURL=init.js.map