import * as _ from 'lodash'
const { youdao, baidu, google } = require('translation.js')
import * as assert from 'assert'

export class Translate {
  private engines = [google, youdao, baidu]

  startCaseClassName(result) {
    let wordArray = _.startCase(result).split(' ')
    if (wordArray.length > 6) {
      wordArray = [].concat(wordArray.slice(0, 5), wordArray.slice(-1))
    }
    return wordArray.join('')
  }

  async translateAsync(text: string, engineIndex = 0) {
    if (engineIndex >= this.engines.length) {
      throw new Error('translate error, all translate engine can not access')
    }

    let enKey
    let index = engineIndex

    try {
      let res = await this.engines[index].translate(text)
      enKey = this.startCaseClassName(res.result[0])

      assert.ok(enKey)

      return enKey
    } catch (err) {
      return this.translateAsync(text, index + 1)
    }
  }
}

export const Translator = new Translate()
