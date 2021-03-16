const Mock = require("mockjs");

module.exports = {
  origins: [
    {
      originUrl: 'http://apidoc.t.iwubida.com/gen/v2/api-docs?serviceName=cyclone-assemble-admin',
      baseClass: 'Result',
      baseClassWrapper: "{'code': '200', 'success': true, 'data': {response}, 'message': '处理成功' }",
      pageClass: 'IwubidaPageResult',
      pageClassWrapper: "{'current': 1, 'size': 10, 'totalCount': 100, 'results': {response} }",
    },
    {
      originUrl: 'http://apidoc.t.iwubida.com/gen/v2/api-docs?serviceName=public-ofile-service',
      baseClass: '',
      baseClassWrapper: '',
      pageClass: '',
      pageClassWrapper: '',
    },
  ],
  port: 8081,
  prettierConfig: {
    parser: 'babel',
    printWidth: 200,
    tabWidth: 2,
    useTabs: false,
    semi: false,
    singleQuote: true,
    trailingComma: 'es5',
    bracketSpacing: true,
    arrowParens: 'always',
  },
  customFields: [
    { fieldName: '\\w*id\\b', mockValue: '@guid' },
    { fieldName: '\\w*url\\b', mockValue: '@image' },
    { fieldName: '\\w*image\\b', mockValue: '@image' },
    { fieldName: '\\w*lng\\b', mockValue: '@float(100, 116, 10000, 99999)' },
    { fieldName: '\\w*lat\\b', mockValue: '@float(23, 40, 10000, 99999)' },
    { fieldName: '\\w*mobile\\b', mockValue: '^1[3-9]\d{9}$' },
    { fieldName: '\\w*provincename\\b', mockValue: '@province' },
    { fieldName: '\\w*cityname\\b', mockValue: '@city' },
    { fieldName: '\\w*districtname\\b', mockValue: '@county' },
    { fieldName: '\\w*time\\b', mockValue: "@datetime('yyyy-MM-dd HH:mm:ss')" },
    { fieldName: 'grantRole\\b', mockValue: ['person','business'][Mock.Random.integer(0, 1)] },
  ],
}
