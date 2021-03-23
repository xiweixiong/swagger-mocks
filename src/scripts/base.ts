import { Translator } from '../translate'
import * as _ from 'lodash'
import * as path from 'path'
import { hasChinese, MockToolsConfig, format, OUT_DIR } from '../utils'
import { StandardDataSource } from '../standard'
import * as axios from 'axios'
import * as fs from 'fs-extra'

export class OriginBaseReader {
  constructor(protected config: MockToolsConfig) {}

  report = console.log

  /** 翻译中文类名等 */
  async translateChinese(jsonString: string) {
    let retString = jsonString
    try {
      const matchItems = jsonString
        // 匹配中英文混合及包含 空格，«，»，-, (,)的情况
        .match(/"[a-z0-9\s-]*[\u4e00-\u9fa5]+[a-z0-9\s-«»()\u4e00-\u9fa5]*":/gi)
      if (!matchItems) {
        return retString
      }

      let chineseKeyCollect = matchItems.map((item) => item.replace(/["":]/g, ''))

      // 去重
      chineseKeyCollect = _.uniq(chineseKeyCollect.map((item) => (item.includes('«') ? item.split('«')[0] : item)))

      // 按长度倒序排序，防止替换时中文名部分重名
      // 例如: 请求参数vo, 请求参数, 替换时先替换 请求参数vo, 后替换请求参数
      chineseKeyCollect.sort((pre, next) => next.length - pre.length)

      let result = await Promise.all(chineseKeyCollect.map((text) => Translator.translateAsync(text)))
      // const normalizeRegStr = (str: string) => str.replace(/(\W)/g, '$1');
      const toRegStr = (str) => str.replace(/(\W)/g, '\\$1')
      result.forEach((enKey: string, index) => {
        const chineseKey = chineseKeyCollect[index]
        // this.report(chineseKey + ' ==> ' + enKey);
        if (enKey) {
          retString = retString.replace(eval(`/${toRegStr(chineseKey)}/g`), enKey)
        }
      })
      return retString
    } catch (err) {
      return retString
    }
  }

  /** 数据转换，可覆盖 */
  transform2Standard(data) {
    return data
  }

  /** 数据获取 */
  async fetchMethod(url: string): Promise<string> {
    const res = await axios.default.get(url)
    return JSON.stringify(res.data)
  }

  /** 获取远程数据源 */
  async fetchData() {
    // 获取数据源
    this.report('获取远程数据中...')

    const data = []
    for (let i = 0; i < this.config.origins.length; i++) {
      const o = this.config.origins[i]
      // 翻译中文类名等
      let swaggerJsonStr: string = await this.fetchMethod(o.originUrl)
      swaggerJsonStr = await this.translateChinese(swaggerJsonStr)
      data.push(JSON.parse(swaggerJsonStr))
    }

    this.report('远程数据获取成功！')

    // 存储源json文件
    this.saveSnapshot(data)

    return data
  }

  /** 获取接口数据，解析并返回 */
  async fetchRemoteData(): Promise<Array<StandardDataSource>> {
    try {
      const data = await this.fetchData()

      // 将数据源转换为标准数据源格式
      let remoteDataSource: StandardDataSource[] = data.map((v) => this.transform2Standard(v))

      // 对解析后的标准数据源进行校验
      remoteDataSource.forEach((v) => this.checkDataSource(v))

      return remoteDataSource
    } catch (e) {
      throw new Error('读取远程接口数据失败！' + e.toString())
    }
  }

  async readLocal() {
    this.report('读取本地数据中...')
    const rootPath = process.cwd()
    let snapshotPath = path.join(rootPath, OUT_DIR, this.snapshotFilename)
    const localDataStr = await fs.readFile(snapshotPath, { encoding: 'utf8' })
    this.report('读取本地完成')

    return JSON.parse(localDataStr)
  }

  /** 读取本地快照文件 */
  async readLocalData() {
    try {
      const data = await this.readLocal()

      // 将数据源转换为标准数据源格式
      let remoteDataSource: StandardDataSource[] = data.map((v) => this.transform2Standard(v))

      // 对解析后的标准数据源进行校验
      remoteDataSource.forEach((v) => this.checkDataSource(v))

      return remoteDataSource
    } catch (e) {
      throw new Error('读取本地接口数据失败！' + e.toString())
    }
  }

  async getDataSource() {
    const data = this.existsSnapshot() ? await this.readLocalData() : await this.fetchRemoteData()
    return data
  }

  protected checkDataSource(dataSource: StandardDataSource) {
    const { mods, baseClasses } = dataSource

    const errorModNames = [] as string[]
    const errorBaseNames = [] as string[]

    mods.forEach((mod) => {
      if (hasChinese(mod.name)) {
        errorModNames.push(mod.name)
      }
    })

    baseClasses.forEach((base) => {
      if (hasChinese(base.name)) {
        errorBaseNames.push(base.name)
      }
    })

    if (errorBaseNames.length && errorModNames.length) {
      const errMsg = ['当前数据源有如下项不符合规范，需要后端修改']
      errorModNames.forEach((modName) => errMsg.push(`模块名${modName}应该改为英文名！`))
      errorBaseNames.forEach((baseName) => errMsg.push(`基类名${baseName}应该改为英文名！`))

      throw new Error(errMsg.join('\n'))
    }
  }

  snapshotFilename = 'api-snapshot.json'
  /** 是否存在快照 */
  existsSnapshot() {
    const rootPath = process.cwd()
    return fs.existsSync(path.join(rootPath, OUT_DIR, this.snapshotFilename))
  }

  /** 存储swagger文档快照 */
  saveSnapshot(data: any[]) {
    const str = format(JSON.stringify(data), { ...this.config.prettierConfig, parser: 'json' }) as string
    const rootPath = process.cwd()
    const snapshotPath = path.join(rootPath, OUT_DIR, this.snapshotFilename)
    if (!fs.existsSync(path.join(rootPath, OUT_DIR))) {
      fs.mkdirSync(path.join(rootPath, OUT_DIR))
    }
    fs.writeFileSync(snapshotPath, str, { encoding: 'utf-8' })
  }
}
