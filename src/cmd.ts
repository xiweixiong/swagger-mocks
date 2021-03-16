import * as program from 'commander'
import * as path from 'path'
import * as fs from 'fs-extra'
import * as chalk from 'chalk'

import { generateMockConfig } from './scripts/init'
import { lookForFiles, CONFIG_FILE, MockToolsConfig } from './utils'
import { MocksServer } from './mocks'

const packageFilePath = path.join(__dirname, '..', 'package.json')
const packageInfo = JSON.parse(fs.readFileSync(packageFilePath, 'utf8'))
const currentVersion = packageInfo.version

program.version(currentVersion).usage('[命令] [配置项]')
;(async function () {
  try {
    program
      .command('init')
      .description('初始化mock-tools配置文件')
      .action(() => {
        generateMockConfig()
      })

    program
      .command('start')
      .description('启动mock服务')
      .action(async () => {
        const configPath = await lookForFiles(process.cwd(), CONFIG_FILE)
        if (!configPath) {
          console.log(chalk.red('请先运行init初始化配置'))
          return
        }
        const config = MockToolsConfig.createFromConfigPath(configPath)
        MocksServer.getSingleInstance(config).run()
      })

    program.parse(process.argv)
  } catch (e) {
    console.error(e.stack)
  }
})()
