import * as fs from 'fs-extra'
import * as path from 'path'
import * as axios from 'axios'
import * as prettier from 'prettier'
import * as os from 'os'
import { Mod } from './standard'

export const CONFIG_FILE = 'mocks-config.js'
export const OUT_DIR = '.mocks'

export class Origin {
  originUrl: string
  baseClass: string
  baseClassWrapper: string
  pageClass: string
  pageClassWrapper: string

  constructor(originUrl: string) {
    this.originUrl = originUrl || ''
    this.baseClass = ''
    this.baseClassWrapper = ''
    this.pageClass = ''
    this.pageClassWrapper = ''
  }
}

export interface CustomField {
  fieldName: string
  mockValue: string | Function
}

export class RegexField {
  fieldName: string
  mockRule: string
  mockValue: string

  constructor(fieldName: string) {
    this.fieldName = fieldName
  }
}

export class MockToolsConfig {
  origins: Array<Origin> = []
  /** mock服务端口号 */
  port: number = 8080
  /** 数组长度 */
  arrayNum: number = 3
  prettierConfig: prettier.ResolveConfigOptions = {
    parser: 'babel',
    printWidth: 200,
    tabWidth: 2,
    useTabs: false,
    semi: false,
    singleQuote: true,
    trailingComma: 'es5',
    bracketSpacing: true,
    arrowParens: 'always',
  }

  // 默认内置的自定义规则
  customFields: Array<CustomField> = [
    { fieldName: '\\w*id\\b', mockValue: '@guid' },
    { fieldName: '\\w*image\\b', mockValue: '@image' },
    { fieldName: '\\w*mobile\\b', mockValue: '^1[3-9]\d{9}$' },
    { fieldName: '\\w*time\\b', mockValue: "@datetime('yyyy-MM-dd HH:mm:ss')" },
  ]

  static createFromConfigPath(configPath: string) {
    try {
      const config = require(configPath) as MockToolsConfig
      return config
    } catch (e) {
      throw new Error('mocks-config.js is error')
    }
  }
}

export enum Surrounding {
  typeScript = 'typeScript',
  javaScript = 'javaScript',
}

export async function lookForFiles(dir: string, fileName: string): Promise<string> {
  const files = await fs.readdir(dir)

  for (let file of files) {
    const currName = path.join(dir, file)

    const info = await fs.lstat(currName)
    if (info.isDirectory()) {
      if (file === '.git' || file === 'node_modules') {
        continue
      }

      const result = await lookForFiles(currName, fileName)

      if (result) {
        return result
      }
    } else if (info.isFile() && file === fileName) {
      return currName
    }
  }
}

/** 检测是否是合法url */
export function judgeIsVaildUrl(url: string) {
  return /^(http|https):.*?$/.test(url)
}

/** 请求url */
export const fetchApiData = async (url: string) => {
  let res = await axios.default.get(url)
  return res.data
}

export function getDuplicateById<T>(arr: T[], idKey = 'name'): null | T {
  if (!arr || !arr.length) {
    return null
  }

  let result

  arr.forEach((item, itemIndex) => {
    if (arr.slice(0, itemIndex).find((o) => o[idKey] === item[idKey])) {
      result = item
      return
    }
  })

  return result
}

export function getMaxSamePath(paths: string[], samePath = '') {
  if (!paths.length) {
    return samePath
  }

  if (paths.some((path) => !path.includes('/'))) {
    return samePath
  }

  const segs = paths.map((path) => {
    const [firstSeg, ...restSegs] = path.split('/')
    return { firstSeg, restSegs }
  })

  if (segs.every((seg, index) => index === 0 || seg.firstSeg === segs[index - 1].firstSeg)) {
    return getMaxSamePath(
      segs.map((seg) => seg.restSegs.join('/')),
      samePath + '/' + segs[0].firstSeg
    )
  }

  return samePath
}

export function toUpperFirstLetter(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function getIdentifierFromUrl(url: string, requestType: string, samePath = '') {
  const currUrl = url.slice(samePath.length).match(/([^\.]+)/)[0]

  return (
    requestType +
    currUrl
      .split('/')
      .map((str) => {
        if (str.includes('-')) {
          str = str.replace(/(\-\w)+/g, (_match, p1) => {
            if (p1) {
              return p1.slice(1).toUpperCase()
            }
          })
        }

        if (str.match(/^{.+}$/gim)) {
          return 'By' + toUpperFirstLetter(str.slice(1, str.length - 1))
        }
        return toUpperFirstLetter(str)
      })
      .join('')
  )
}

/** 正则检测是否包含中文名 */
export function hasChinese(str: string) {
  return (
    str &&
    str.match(
      /[\u4E00-\u9FCC\u3400-\u4DB5\uFA0E\uFA0F\uFA11\uFA13\uFA14\uFA1F\uFA21\uFA23\uFA24\uff1a\uff0c\uFA27-\uFA29]|[\ud840-\ud868][\udc00-\udfff]|\ud869[\udc00-\uded6\udf00-\udfff]|[\ud86a-\ud86c][\udc00-\udfff]|\ud86d[\udc00-\udf34\udf40-\udfff]|\ud86e[\udc00-\udc1d]|[\uff01-\uff5e\u3000-\u3009\u2026]/
    )
  )
}

export function transformCamelCase(name: string) {
  let words = [] as string[]
  let result = ''

  if (name.includes('-')) {
    words = name.split('-')
  } else if (name.includes(' ')) {
    words = name.split(' ')
  } else {
    if (typeof name === 'string') {
      result = name
    } else {
      throw new Error('mod name is not a string: ' + name)
    }
  }

  if (words && words.length) {
    result = words
      .map((word) => {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      })
      .join('')
  }

  result = result.charAt(0).toLowerCase() + result.slice(1)

  if (result.endsWith('Controller')) {
    result = result.slice(0, result.length - 'Controller'.length)
  }

  return result
}

export function transformModsName(mods: Mod[]) {
  // 检测所有接口是否存在接口名忽略大小写时重复，如果重复，以下划线命名
  mods.forEach((mod) => {
    const currName = mod.name
    const sameMods = mods.filter((mod) => mod.name.toLowerCase() === currName.toLowerCase())

    if (sameMods.length > 1) {
      mod.name = transformDashCase(mod.name)
    }
  })
}

function transformDashCase(name: string) {
  return name.replace(/[A-Z]/g, (ch) => '_' + ch.toLowerCase())
}

export function toDashCase(name: string) {
  const dashName = name
    .split(' ')
    .join('')
    .replace(/[A-Z]/g, (p) => '-' + p.toLowerCase())

  if (dashName.startsWith('-')) {
    return dashName.slice(1)
  }

  return dashName
}

/** some reversed keyword in js but not in java */
const TS_KEYWORDS = ['delete', 'export', 'import', 'new', 'function']
const REPLACE_WORDS = ['remove', 'exporting', 'importing', 'create', 'functionLoad']

export function getIdentifierFromOperatorId(operationId: string) {
  const identifier = operationId.replace(/(.+)(Using.+)/, '$1')

  const index = TS_KEYWORDS.indexOf(identifier)

  if (index === -1) {
    return identifier
  }

  return REPLACE_WORDS[index]
}

export function format(fileContent: string, prettierOpts = {}) {
  try {
    return prettier.format(fileContent, {
      parser: 'typescript',
      trailingComma: 'all',
      singleQuote: true,
      ...prettierOpts,
    })
  } catch (e) {
    console.log(`代码格式化报错！${e.toString()}\n代码为：${fileContent}`)
    return fileContent
  }
}

export function getIPAdress() {
  var interfaces = os.networkInterfaces()
  for (var devName in interfaces) {
    var iface = interfaces[devName]
    for (var i = 0; i < iface.length; i++) {
      var alias = iface[i]
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        return alias.address
      }
    }
  }
}
