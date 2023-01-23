'use strict'

const log = require('../log')
const { sendData } = require('./send-data')

module.exports = class TelemetryPlugin {
  constructor (reqType) {
    this.reqType = reqType
  }

  start (aConfig, appplicationObject, hostObject, heartbeatInterval) {
    this.config = aConfig
    this.application = appplicationObject
    this.host = hostObject

    if (this.onStart() && heartbeatInterval) {
      this.interval = setInterval(() => { this.onSendData() }, heartbeatInterval)
      this.interval.unref()
    }
  }

  onSendData () {
    try {
      const payload = this.getPayload()
      if (payload) {
        sendData(this.config, this.application, this.host, this.reqType, payload)
      }
    } catch (e) {
      log.error(e)
    }
  }

  onStart () { return true }

  onStop () {}

  getPayload () {}

  stop () {
    this.onStop()

    this.config = null
    this.application = null
    this.host = null

    if (this.interval) {
      clearInterval(this.interval)
    }
  }
}
