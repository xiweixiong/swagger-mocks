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
exports.MocksServer = exports.Mocks = void 0;
const fs = require("fs-extra");
const path = require("path");
const http = require("http");
const moment = require("moment");
const Mock = require("mockjs");
const ts = require("typescript");
const swagger_1 = require("./scripts/swagger");
const utils_1 = require("./utils");
const debugLog_1 = require("./debugLog");
class Mocks {
    constructor(ds, config) {
        this.ds = ds;
        this.config = config;
    }
    getBaseClassMocksFn(clazz, dsIndex) {
        const props = [];
        clazz.properties.forEach((prop) => {
            let { name, dataType } = prop;
            const templateIndex = dataType.templateIndex;
            if (templateIndex !== -1) {
                props.push(`${name}: typeArgs[${templateIndex}]`);
            }
            else {
                props.push(`${name}: ${this.getDefaultMocks(prop.dataType, dsIndex, prop.name)}`);
            }
        });
        const wrap = this.config.origins[dsIndex];
        if (wrap.baseClass && wrap.baseClassWrapper && clazz.name === wrap.baseClass) {
            return `
        ${clazz.name}: (...typeArgs) => {
          return ${wrap.baseClassWrapper.replace(/{response}/g, 'typeArgs[0]')}
        }
      `;
        }
        if (wrap.pageClass && wrap.pageClassWrapper && clazz.name === wrap.pageClass) {
            return `
        ${clazz.name}: (...typeArgs) => {
          return ${wrap.pageClassWrapper.replace(/{response}/g, 'new Array(10).fill(null).map(() => typeArgs[0])')}
        }
      `;
        }
        return `
      ${clazz.name}: (...typeArgs) => {
        return {
          ${props.join(',\n')}
        }
      }
    `;
    }
    getDefaultMocks(response, dsIndex, fieldName) {
        const { typeName, isDefsType, typeArgs } = response;
        const customFields = this.config.customFields;
        if (fieldName && !isDefsType && typeName !== 'Array') {
            const customField = customFields.find((v) => new RegExp(v.fieldName.toLowerCase()).test(fieldName.toLowerCase()));
            if (customField) {
                if (typeof customField.mockValue === 'function') {
                    return `(${customField.mockValue})(Mock.mock)`;
                }
                else {
                    return `"${customField.mockValue}"`;
                }
            }
        }
        const bases = this.ds[dsIndex].baseClasses;
        if (isDefsType) {
            const defClass = bases.find((bs) => bs.name === typeName);
            if (!defClass)
                return '{}';
            return `defs[${dsIndex}].${defClass.name}(${typeArgs.map((arg) => this.getDefaultMocks(arg, dsIndex)).join(', ')})`;
        }
        else if (typeName === 'Array') {
            if (typeArgs.length) {
                const item = this.getDefaultMocks(typeArgs[0], dsIndex, fieldName);
                return `new Array(${this.config.arrayNum}).fill(null).map(() => (${item}))`;
            }
            return '[]';
        }
        else if (typeName === 'string') {
            return `'@ctitle'`;
        }
        else if (typeName === 'number') {
            return `'@float(1,100,1,99)'`;
        }
        else if (typeName === 'integer') {
            return `'@integer(1,100)'`;
        }
        else if (typeName === 'boolean') {
            return `'@boolean'`;
        }
        else {
            return 'null';
        }
    }
    getMocksCode() {
        const codes = this.ds.map((v, i) => {
            const classes = v.baseClasses.map((clazz) => this.getBaseClassMocksFn(clazz, i));
            const interfaces = v.mods
                .map((mod) => {
                const modName = mod.name;
                return `
          /** ${mod.description} */
          ${modName}: {
            ${mod.interfaces
                    .map((inter) => {
                    const interName = inter.name;
                    const interRes = this.getDefaultMocks(inter.response, i);
                    return `
                  /** ${inter.description} */
                  ${interName}: ${interRes}
                `;
                })
                    .join(',\n')}
          }`;
            })
                .join(',\n');
            return { classes, interfaces };
        });
        return `
      const Mock = require('mockjs')

      const defs = [
        ${codes.map((v) => `{ ${v.classes} }`).join(',')}
      ]
  
      const escapeDeadCycle = (fn) => (...args) => fn(...args)
  
      defs.forEach((def) => {
        Object.keys(def).forEach((key) => {
          def[key] = escapeDeadCycle(def[key])
        })
      })
  
      export default [
        ${codes.map((v) => `{ ${v.interfaces} }`).join(',')}
      ]
    `;
    }
}
exports.Mocks = Mocks;
class MocksServer {
    constructor(config) {
        this.config = config;
        this.dataSources = [];
        utils_1.lookForFiles(process.cwd(), '.gitignore').then((igonrePath) => {
            if (igonrePath) {
                let ignoreContent = fs.readFileSync(igonrePath, 'utf8');
                if (!ignoreContent.includes(utils_1.OUT_DIR)) {
                    ignoreContent = ignoreContent + '\n' + `${utils_1.OUT_DIR}/`;
                    fs.writeFileSync(igonrePath, ignoreContent);
                }
            }
        });
    }
    static getSingleInstance(config) {
        if (!MocksServer.singleInstance) {
            MocksServer.singleInstance = new MocksServer(config);
            return MocksServer.singleInstance;
        }
        MocksServer.singleInstance.config = config;
        return MocksServer.singleInstance;
    }
    checkMockData(force) {
        return __awaiter(this, void 0, void 0, function* () {
            const render = new swagger_1.SwaggerV2Reader(this.config);
            this.dataSources = force ? yield render.fetchRemoteData() : yield render.getDataSource();
            const rootPath = process.cwd();
            const mockPath = path.join(rootPath, utils_1.OUT_DIR, 'mocks.js');
            const code = yield this.getMocksCode();
            if (!fs.existsSync(path.join(rootPath, utils_1.OUT_DIR))) {
                fs.mkdirSync(path.join(rootPath, utils_1.OUT_DIR));
            }
            yield fs.writeFile(mockPath, code);
        });
    }
    getCurrMocksData() {
        return __awaiter(this, void 0, void 0, function* () {
            const rootPath = process.cwd();
            const mockPath = path.join(rootPath, utils_1.OUT_DIR);
            const sourcePath = path.join(mockPath, 'mocks.js');
            const noCacheFix = (Math.random() + '').slice(2, 5);
            const jsPath = path.join(mockPath, `mocks.${noCacheFix}.js`);
            const code = fs.readFileSync(sourcePath, 'utf8');
            const { outputText } = ts.transpileModule(code, {
                compilerOptions: {
                    target: ts.ScriptTarget.ES2015,
                    module: ts.ModuleKind.CommonJS,
                },
            });
            fs.writeFileSync(jsPath, outputText);
            const currMocksData = require(jsPath).default;
            fs.unlinkSync(jsPath);
            return currMocksData;
        });
    }
    getMocksCode() {
        return __awaiter(this, void 0, void 0, function* () {
            const code = new Mocks(this.dataSources, this.config).getMocksCode();
            return utils_1.format(code, this.config.prettierConfig);
        });
    }
    startServer() {
        const ip = utils_1.getIPAdress();
        const port = this.config.port;
        const ds = this.dataSources;
        const server = http
            .createServer((req, res) => __awaiter(this, void 0, void 0, function* () {
            const mocksData = (yield this.getCurrMocksData());
            ds.forEach((source, i) => {
                source.mods.forEach((mod) => {
                    mod.interfaces.forEach((inter) => __awaiter(this, void 0, void 0, function* () {
                        const reg = new RegExp('^' + inter.path.replace(/\//g, '\\/').replace(/{.+?}/g, '[0-9a-zA-Z_-]*?') + '(\\?|$)');
                        if (req.url.match(reg) && req.method.toUpperCase() === inter.method.toUpperCase()) {
                            const mockSrouce = mocksData[i][mod.name][inter.name];
                            const mockData = Mock.mock(mockSrouce);
                            const wrapperRes = JSON.stringify(mockData);
                            res.writeHead(200, {
                                'Content-Type': 'text/json;charset=UTF-8',
                                'Access-Control-Allow-Origin': '*',
                                'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
                                'Access-Control-Max-Age': 2592000,
                            });
                            res.end(wrapperRes, 'utf8');
                        }
                    }));
                });
            });
            res.writeHead(404);
            res.end();
        }))
            .listen(port, () => {
            console.log(debugLog_1.chalk.yellow('\nMock服务已启动 \n'));
            console.log(`  Local:           ${debugLog_1.chalk.cyan(`http://localhost:${port}`)}`);
            console.log(`  On Your Network: ${debugLog_1.chalk.cyan(`http://${ip}:${port}`)}`);
            console.log('\n按 Ctrl + C 停止服务\n');
            process.on('SIGINT', () => {
                server.close(() => {
                    console.log(debugLog_1.chalk.red('Mock服务已停止'));
                });
            });
        })
            .on('request', (req) => {
            const time = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
            const url = req.url;
            const method = req.method;
            const userAgent = req.headers['user-agent'];
            console.log(`${debugLog_1.chalk.green(`[${time}]`)}  "${debugLog_1.chalk.yellow(`${method} ${url}`)}" "${userAgent}"`);
        });
    }
    run(force) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.checkMockData(force);
            this.startServer();
        });
    }
}
exports.MocksServer = MocksServer;
MocksServer.singleInstance = null;
//# sourceMappingURL=mocks.js.map