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
const program = require("commander");
const path = require("path");
const fs = require("fs-extra");
const chalk = require("chalk");
const init_1 = require("./scripts/init");
const utils_1 = require("./utils");
const mocks_1 = require("./mocks");
const packageFilePath = path.join(__dirname, '..', 'package.json');
const packageInfo = JSON.parse(fs.readFileSync(packageFilePath, 'utf8'));
const currentVersion = packageInfo.version;
program.version(currentVersion).usage('[命令] [配置项]');
(function () {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            program
                .command('init')
                .description('初始化mock-tools配置文件')
                .action(() => {
                init_1.generateMockConfig();
            });
            program
                .command('start')
                .description('启动mock服务')
                .action(() => __awaiter(this, void 0, void 0, function* () {
                const configPath = yield utils_1.lookForFiles(process.cwd(), utils_1.CONFIG_FILE);
                if (!configPath) {
                    console.log(chalk.red('请先运行init初始化配置'));
                    return;
                }
                const config = utils_1.MockToolsConfig.createFromConfigPath(configPath);
                mocks_1.MocksServer.getSingleInstance(config).run();
            }));
            program.parse(process.argv);
        }
        catch (e) {
            console.error(e.stack);
        }
    });
})();
//# sourceMappingURL=cmd.js.map