'use strict'
const InjectionAnalyzer = require('./injection-analyzer')

class SqlInjectionAnalyzer extends InjectionAnalyzer {
  constructor () {
    super('SQL_INJECTION')
  }

  onConfigure () {
    this.addSub(this.sink('apm:mysql:query:start'), ({ sql }) => this.analyze(sql))
    this.addSub(this.sink('apm:mysql2:query:start'), ({ sql }) => this.analyze(sql))
    this.addSub(this.sink('apm:pg:query:start'), ({ originalQuery }) => this.analyze(originalQuery))
  }
}

module.exports = new SqlInjectionAnalyzer()
