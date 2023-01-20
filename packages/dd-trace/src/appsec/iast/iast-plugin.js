'use strict'

const log = require('../../log')
const Plugin = require('../../plugins/plugin')
const telemetry = require('./telemetry')
const { getInstrumentedMetric, getExecutedMetric } = require('./telemetry/metrics')
const { VULNERABILITY_TYPE, SOURCE_TYPE } = require('./telemetry/metric-tag')

class IastSub {
  constructor (moduleName, channelName, tag, metricTag) {
    this.moduleName = moduleName
    this.channelName = channelName
    this.tag = tag
    this.metricTag = metricTag || VULNERABILITY_TYPE
  }
}

class IastPlugin extends Plugin {
  constructor () {
    super()
    this.configured = false
    this.iastSubs = []
  }

  _wrapHandler (handler, metric, tag) {
    if (telemetry.isDebugEnabled()) {
      const originalHandler = handler
      handler = (message, name) => {
        originalHandler(message, name)
        telemetry.increase(metric, tag)
      }
    }

    return (message, name) => {
      try {
        handler(message, name)
      } catch (e) {
        log.debug(e)
      }
    }
  }

  addSub (iastSub, handler) {
    this.iastSubs.push(iastSub)
    const metric = getExecutedMetric(iastSub.metricTag)
    super.addSub(iastSub.channelName, this._wrapHandler(handler, metric, iastSub.tag))
  }

  onConfigure () {}

  configure (config) {
    if (!this.configured) {
      this.onConfigure()

      if (telemetry.isEnabled()) {
        this.enableTelemetry(telemetry)
      }
      this.configured = true
    }

    super.configure(config)
  }

  getSubscription ({ moduleName, channelName, tag, metricTag }) {
    if (!channelName) return

    if (!moduleName) {
      const firstSep = channelName.indexOf(':')
      if (firstSep === -1) {
        moduleName = channelName
      } else {
        moduleName = channelName.substring(firstSep + 1, channelName.indexOf(':', firstSep + 1))
      }
    }
    return new IastSub(moduleName, channelName, tag, metricTag)
  }

  source (channelName, tag) {
    return this.getSubscription({ channelName, tag, metricTag: SOURCE_TYPE })
  }

  sink (channelName, tag) {
    return this.getSubscription({ channelName, tag, metricTag: VULNERABILITY_TYPE })
  }

  enableTelemetry (telemetry) {
    const { channel } = require('diagnostics_channel')
    const loadChannel = channel('dd-trace:instrumentation:load')
    loadChannel.subscribe(({ name }) =>
      this.onInstrumentationLoaded(name, telemetry)
    )
  }

  onInstrumentationLoaded (name, telemetry) {
    const subs = this.iastSubs.filter(sub => sub.moduleName.includes(name))
    if (subs && subs.length) {
      subs.forEach(sub => {
        telemetry.increase(getInstrumentedMetric(sub.metricTag), sub.tag)
      })
    }
  }
}

module.exports = {
  IastSub,
  IastPlugin
}
