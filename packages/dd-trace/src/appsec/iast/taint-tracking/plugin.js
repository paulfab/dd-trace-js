
const { getIastContext } = require('../iast-context')
const { storage } = require('../../../../../datadog-core')
const { HTTP_REQUEST_PARAMETER, HTTP_REQUEST_BODY } = require('./origin-types')
const { taintObject } = require('./operations')
const IastPlugin = require('../iast-plugin')
const { INSTRUMENTED_SOURCE, EXECUTED_SOURCE } = require('../telemetry/metrics')

class TaintTrackingPlugin extends IastPlugin {
  constructor () {
    super(INSTRUMENTED_SOURCE, EXECUTED_SOURCE)
    this._type = 'taint-tracking'
  }

  onConfigure () {
    this.addSub(
      'datadog:body-parser:read:finish',
      ({ request }) => this._taintTrackingHandler(HTTP_REQUEST_BODY, request, 'body'),
      HTTP_REQUEST_BODY
    )
    this.addSub(
      'datadog:qs:parse:finish',
      ({ qs }) => this._taintTrackingHandler(HTTP_REQUEST_PARAMETER, qs),
      HTTP_REQUEST_PARAMETER)
  }

  _taintTrackingHandler (type, target, property) {
    const iastContext = getIastContext(storage.getStore())
    if (!property) {
      target = taintObject(iastContext, target, type)
    } else {
      target[property] = taintObject(iastContext, target[property], type)
    }
  }

  enable () {
    this.configure(true)
  }

  disable () {
    this.configure(false)
  }
}

module.exports = new TaintTrackingPlugin()
