#!/usr/bin/env node

"use strict"

const { Command } = require("commander")
const fs = require('fs')
const chalk = require("chalk")
const axios = require('axios')
const path = require("path")
const prettier = require("prettier")

const program = new Command();
program.version('1.0.0').usage('[命令] [配置项]')

const BASE_PATH = process.cwd()
const PONT_CONFIG = 'mock-config.js'

const fetchApiData = async (url) => {
  let res = await axios.get(url);
  return res.data
}

let config = null

; (function () {
  try {
    program.command('generate').description('生成mock')
      .action(async () => {
        // 读取配置文件
        try {
          const pontConfigStr = fs.readFileSync(path.join(BASE_PATH, PONT_CONFIG)).toString()
          config = JSON.parse(pontConfigStr)
        } catch (error) {
          console.log(chalk.red('读取配置文件错误'))
        }

        const docs = []
        for (let i = 0; i < config.origins.length; i++) {
          const originUrl = config.origins[i];
          const doc = await fetchApiData(originUrl)
          docs.push(doc)
        }

        create(docs)
      })

    program.parse(process.argv)
  } catch (e) {
    console.error(e.stack)
  }
})()

/** 创建mock */
const create = (docs) => {
  const prettierConfig = config.prettierConfig || {}

  let mockStr = ''
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];

    for (const [apiPath, apiObj] of Object.entries(doc.paths)) {
      const valueStr = generateResult(apiObj, doc)
      mockStr += `
        Mock.mock(new RegExp('${apiPath}'), () => Mock.mock(${valueStr}))
      `
    }
  }

  let mock = prettier.format(`
    import Mock, { Random } from 'mockjs'

    Mock.setup({
      timeout: '200-600'
    })

    ${mockStr}

    export default {}
  `, prettierConfig)  
  
  const dir = '.api-mocks'
  const mockFile = `${dir}/mocks.ts`
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir)
  }
  fs.writeFileSync(mockFile, mock)

  // const igonrePath = '.gitignore'
  // let ignoreContent = fs.readFileSync(igonrePath, 'utf8')
  // if (!ignoreContent.includes('.api-mocks')) {
  //   ignoreContent = ignoreContent + '\n' + '.api-mocks/'
  //   fs.writeFileSync(igonrePath, ignoreContent)
  // }

}

const generateResult = (apiObj, doc) => {
  const method = apiObj.post ? apiObj.post : apiObj.get;
  const originalRef = method.responses['200'].schema.originalRef
  const ref = doc.definitions[originalRef]
  return refs(ref, doc)
}


const refs = (ref, doc, fieldName) => {
  if (!ref) return 'undefined'

  let res = ''
  if (ref.title && ref.title.indexOf(`${config.baseClass}«`) === 0) {
    const valueRef = ref.properties.data
    let value = refs(valueRef, doc)
    if (value.indexOf('":') === 0) value = value.substring(2)
    res = config.baseClassWrapper.replace('{response}', value)
  } else if (ref.title && ref.title.indexOf(`${config.pageClass}«`) === 0) {
    const valueRef = ref.properties.results
    res = config.pageClassWrapper.replace('{response}', refs(valueRef, doc))
  } else if (ref.type === 'array') {
    const valueRef = ref.items
    let value = refs(valueRef, doc)
    if (value.indexOf('":') === 0) value = value.substring(2)
    res = `${fieldName ? '|1-10": ' : ''}[${value}]`
  } else if (!ref.type && ref.originalRef) {
    const valueRef = doc.definitions[ref.originalRef]
    res = `${fieldName ? '": ' : ''}${refs(valueRef, doc)}`
  } else if (ref.properties) {
    const strs = []
    for (const [key, valueRef] of Object.entries(ref.properties)) {
      strs.push(`"${key}${refs(valueRef, doc, key)}`)
    }
    res = `{ ${strs.join(',')} }`
  } else {
    if (fieldName && config.customs[fieldName]) {
      // 自定义字段
      const custom = config.customs[fieldName]
      res = `${custom.rule||''}": ${custom.value}`
    } else if (fieldName && (/\w*url\b/.test(fieldName.toLowerCase()) || /\w*image\b/.test(fieldName.toLowerCase()))) {
      // 图片字段
      res = `": "@image"`
    } else if (fieldName && /\w*id\b/.test(fieldName.toLowerCase())) {
      // 主键、外键字段
      res = `": "@guid"`
    } else if (fieldName && /\w*lng\b/.test(fieldName.toLowerCase())) {
      // 经度
      res = `": "@float(100, 116, 10000, 99999)"`
    } else if (fieldName && /\w*lat\b/.test(fieldName.toLowerCase())) {
      // 纬度
      res = `": "@float(23, 40, 10000, 99999)"`
    } else if (fieldName && /\w*mobile\b/.test(fieldName.toLowerCase())) {
      // 手机号码
      res = `": /^1[3-9]\d{9}$/`
    } else if (fieldName && /\w*provincename\b/.test(fieldName.toLowerCase())) {
      // 省名称
      res = `": "@province"`
    } else if (fieldName && /\w*cityname\b/.test(fieldName.toLowerCase())) {
      // 市名称
      res = `": "@city"`
    } else if (fieldName && /\w*districtname\b/.test(fieldName.toLowerCase())) {
      // 区名称
      res = `": "@county"`
    } else if (fieldName && /\w*image\b/.test(fieldName.toLowerCase())) {

      res = `": "@image"`
    } else if (ref.type === 'number') {
      // 浮点数
      res = `": "@float(1,100,1,99)"`
    } else if (ref.type === 'boolean') {
      // boolean字段
      res = `": "@boolean"`
    } else if (ref.type === 'integer') {
      // 整数字段
      res = `": "@integer(1,100)"`
    } else if (ref.type === 'string') {
      if (ref.format === 'date-time') {
        res = `": "@datetime('yyyy-MM-dd HH:mm:ss')"`
      } else if (ref.format === 'date') {
        res = `": "@date('yyyy-MM-dd')"`
      } else {
        res = `": "@ctitle"`
      }
    } else {
      res = `": undefined`
    }
  }

  return res
}