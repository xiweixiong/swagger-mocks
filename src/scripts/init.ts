import * as inquirer from 'inquirer'
import * as path from 'path'
import * as fs from 'fs-extra'
import * as debugLog from '../debugLog'
import { CONFIG_FILE, MockToolsConfig, lookForFiles, judgeIsVaildUrl, Origin, format } from '../utils'

const promptList = [
  {
    type: 'input',
    message: '请设置数据源地址，多个使用英文逗号(,)隔开',
    name: 'originUrl',
    validate: (originUrl) => {
      if (!judgeIsVaildUrl(originUrl)) {
        return '请输入正确的数据源地址'
      }
      return true
    },
  },
  {
    type: 'input',
    message: '请输入mock服务端口',
    name: 'port',
    default: 8080,
  },
]

export async function generateMockConfig() {
  const configPath = await lookForFiles(process.cwd(), CONFIG_FILE)
  if (configPath) {
    const result = await inquirer.prompt({
      type: 'confirm',
      name: 'confirm',
      default: true,
      message: `检测到已存在mocker-config文件，继续生成将覆盖配置项，是否继续？`,
    })

    if (!result.confirm) {
      return
    }
  }

  debugLog.info('配置文件生成中...')

  const answers = await inquirer.prompt(promptList)

  generateConfig(configPath, answers)

  debugLog.success('文件生成成功。')

  debugLog.info(`
    其余配置项请参阅官方文档 https://github.com/xiweixiong/mock-swagger#readme
  `)
}

function generateConfig(configPath: string, answers: any) {
  const { originUrl, port } = answers
  const dirName = path.join(process.cwd(), '/mocker-config.js')
  let config = new MockToolsConfig()
  if (configPath) {
    config = MockToolsConfig.createFromConfigPath(configPath)
  }

  const origins: Origin[] = (originUrl as string).split(',').map((v) => new Origin(v))
  config.origins = origins
  config.port = port
  const configStr = `
    module.exports = ${JSON.stringify(config)}
  `
  const formatStr = format(configStr, { ...config.prettierConfig, printWidth: 120 }) as string
  fs.writeFileSync(configPath || dirName, formatStr)
}
