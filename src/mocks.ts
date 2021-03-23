import * as fs from 'fs-extra'
import * as path from 'path'
import * as http from 'http'
import * as moment from 'moment'
import * as Mock from 'mockjs'
import * as ts from 'typescript'
import { SwaggerV2Reader } from './scripts/swagger'
import { BaseClass, StandardDataSource, StandardDataType } from './standard'
import { format, getIPAdress, lookForFiles, MockToolsConfig, OUT_DIR } from './utils'
import { chalk } from './debugLog'

export class Mocks {
  constructor(private ds: StandardDataSource[], private config: MockToolsConfig) {}

  getBaseClassMocksFn(clazz: BaseClass, dsIndex: number) {
    const props = [] as string[]

    clazz.properties.forEach((prop) => {
      let { name, dataType } = prop
      const templateIndex = dataType.templateIndex

      if (templateIndex !== -1) {
        props.push(`${name}: typeArgs[${templateIndex}]`)
      } else {
        props.push(`${name}: ${this.getDefaultMocks(prop.dataType, dsIndex, prop.name)}`)
      }
    })

    const wrap = this.config.origins[dsIndex]
    if (wrap.baseClass && wrap.baseClassWrapper && clazz.name === wrap.baseClass) {
      return `
        ${clazz.name}: (...typeArgs) => {
          return ${wrap.baseClassWrapper.replace(/{response}/g, 'typeArgs[0]')}
        }
      `
    }
    if (wrap.pageClass && wrap.pageClassWrapper && clazz.name === wrap.pageClass) {
      return `
        ${clazz.name}: (...typeArgs) => {
          return ${wrap.pageClassWrapper.replace(/{response}/g, 'new Array(10).fill(null).map(() => typeArgs[0])')}
        }
      `
    }

    return `
      ${clazz.name}: (...typeArgs) => {
        return {
          ${props.join(',\n')}
        }
      }
    `
  }

  getDefaultMocks(response: StandardDataType, dsIndex: number, fieldName?: string): string {
    const { typeName, isDefsType, typeArgs } = response

    // 自定义字段正则匹配
    const customFields = this.config.customFields
    if (fieldName && !isDefsType && typeName !== 'Array') {
      const customField = customFields.find((v) => new RegExp(v.fieldName.toLowerCase()).test(fieldName.toLowerCase()))
      if (customField) {
        if (typeof customField.mockValue === 'function') {
          return `(${customField.mockValue})(Mock.mock)`
        } else {
          return `"${customField.mockValue}"`
        }
      }
    }

    const bases = this.ds[dsIndex].baseClasses
    if (isDefsType) {
      const defClass = bases.find((bs) => bs.name === typeName)
      if (!defClass) return '{}'

      return `defs[${dsIndex}].${defClass.name}(${typeArgs.map((arg) => this.getDefaultMocks(arg, dsIndex)).join(', ')})`
    } else if (typeName === 'Array') {
      if (typeArgs.length) {
        const item = this.getDefaultMocks(typeArgs[0], dsIndex, fieldName)
        return `new Array(${this.config.arrayNum}).fill(null).map(() => (${item}))`
      }
      return '[]'
    } else if (typeName === 'string') {
      return `'@ctitle'`
    } else if (typeName === 'number') {
      return `'@float(1,100,1,99)'`
    } else if (typeName === 'integer') {
      return `'@integer(1,100)'`
    } else if (typeName === 'boolean') {
      return `'@boolean'`
    } else {
      return 'null'
    }
  }

  getMocksCode() {
    const codes = this.ds.map((v, i) => {
      const classes = v.baseClasses.map((clazz) => this.getBaseClassMocksFn(clazz, i))
      const interfaces = v.mods
        .map((mod) => {
          const modName = mod.name

          return `
          /** ${mod.description} */
          ${modName}: {
            ${mod.interfaces
              .map((inter) => {
                const interName = inter.name
                const interRes = this.getDefaultMocks(inter.response, i)

                return `
                  /** ${inter.description} */
                  ${interName}: ${interRes}
                `
              })
              .join(',\n')}
          }`
        })
        .join(',\n')

      return { classes, interfaces }
    })

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
    `
  }
}

export class MocksServer {
  dataSources: Array<StandardDataSource> = []

  constructor(private config: MockToolsConfig) {
    /** gitignore 添加忽略 {OUT_DIR} 文件夹 */
    lookForFiles(process.cwd(), '.gitignore').then((igonrePath) => {
      if (igonrePath) {
        let ignoreContent = fs.readFileSync(igonrePath, 'utf8')
        if (!ignoreContent.includes(OUT_DIR)) {
          ignoreContent = ignoreContent + '\n' + `${OUT_DIR}/`
          fs.writeFileSync(igonrePath, ignoreContent)
        }
      }
    })
  }

  static singleInstance = null as MocksServer
  static getSingleInstance(config: MockToolsConfig) {
    if (!MocksServer.singleInstance) {
      MocksServer.singleInstance = new MocksServer(config)
      return MocksServer.singleInstance
    }
    MocksServer.singleInstance.config = config
    return MocksServer.singleInstance
  }

  /** 检查是否存在mock数据文件 */
  async checkMockData(force?: boolean) {
    const render = new SwaggerV2Reader(this.config)
    this.dataSources = force ? await render.fetchRemoteData() : await render.getDataSource()
    const rootPath = process.cwd()
    const mockPath = path.join(rootPath, OUT_DIR, 'mocks.js')
    const code = await this.getMocksCode()
    if (!fs.existsSync(path.join(rootPath, OUT_DIR))) {
      fs.mkdirSync(path.join(rootPath, OUT_DIR))
    }
    await fs.writeFile(mockPath, code)
  }

  async getCurrMocksData() {
    const rootPath = process.cwd()
    const mockPath = path.join(rootPath, OUT_DIR)
    const sourcePath = path.join(mockPath, 'mocks.js')
    const noCacheFix = (Math.random() + '').slice(2, 5)
    const jsPath = path.join(mockPath, `mocks.${noCacheFix}.js`)
    const code = fs.readFileSync(sourcePath, 'utf8')

    const { outputText } = ts.transpileModule(code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2015,
        module: ts.ModuleKind.CommonJS,
      },
    })
    fs.writeFileSync(jsPath, outputText)
    const currMocksData = require(jsPath).default
    fs.unlinkSync(jsPath)

    return currMocksData
  }

  async getMocksCode() {
    const code = new Mocks(this.dataSources, this.config).getMocksCode()
    return format(code, this.config.prettierConfig) as string
  }

  startServer() {
    const ip = getIPAdress()
    const port = this.config.port
    const ds = this.dataSources

    const server = http
      .createServer(async (req, res) => {
        const mocksData = (await this.getCurrMocksData()) as Array<any>

        ds.forEach((source, i) => {
          source.mods.forEach((mod) => {
            mod.interfaces.forEach(async (inter) => {
              // 把 url int path 的参数，转换为匹配参数的正则表达式
              const reg = new RegExp('^' + inter.path.replace(/\//g, '\\/').replace(/{.+?}/g, '[0-9a-zA-Z_-]*?') + '(\\?|$)')
              if (req.url.match(reg) && req.method.toUpperCase() === inter.method.toUpperCase()) {
                const mockSrouce = mocksData[i][mod.name][inter.name]
                const mockData = Mock.mock(mockSrouce)
                const wrapperRes = JSON.stringify(mockData)
                res.writeHead(200, {
                  'Content-Type': 'text/json;charset=UTF-8',
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
                  'Access-Control-Max-Age': 2592000, // 30 days
                })
                res.end(wrapperRes, 'utf8')
              }
            })
          })
        })
        res.writeHead(404)
        res.end()
      })
      .listen(port, () => {
        console.log(chalk.yellow('\nMock服务已启动 \n'))
        console.log(`  Local:           ${chalk.cyan(`http://localhost:${port}`)}`)
        console.log(`  On Your Network: ${chalk.cyan(`http://${ip}:${port}`)}`)
        console.log('\n按 Ctrl + C 停止服务\n')
        process.on('SIGINT', () => {
          server.close(() => {
            console.log(chalk.red('Mock服务已停止'))
          })
        })
      })
      .on('request', (req: http.IncomingMessage) => {
        const time = moment().format('YYYY-MM-DD HH:mm:ss.SSS')
        const url = req.url
        const method = req.method
        const userAgent = req.headers['user-agent']
        console.log(`${chalk.green(`[${time}]`)}  "${chalk.yellow(`${method} ${url}`)}" "${userAgent}"`)
      })
  }

  async run(force?: boolean) {
    await this.checkMockData(force)
    this.startServer()
  }
}
