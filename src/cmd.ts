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

program.version(currentVersion).name('mocker').usage('<命令> [配置项]').addHelpCommand(false)

program.description('根据swagger文档生成mock数据，并启动http服务')
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
      .option('-f, --force', '强制加载远程文档', false)
      .action(async ({ force }) => {
        const configPath = await lookForFiles(process.cwd(), CONFIG_FILE)
        if (!configPath) {
          console.log(chalk.red('请先运行init初始化配置'))
          return
        }
        const config = MockToolsConfig.createFromConfigPath(configPath)
        MocksServer.getSingleInstance(config).run(force)
      })

    program.parse(process.argv)
  } catch (e) {
    console.error(e.stack)
  }
})()
