'use strict'

const log = require('../../log')
const Plugin = require('../../plugins/plugin')
const telemetry = require('./telemetry')

module.exports = class IastPlugin extends Plugin {
  constructor (instrumentedMetric, executedMetric, executedMetricTag) {
    super()
    this.instrumentedMetric = instrumentedMetric
    this.executedMetric = executedMetric
    this.executedMetricTag = executedMetricTag
  }

  _wrapHandler (handler, executedMetricTag) {
    if (telemetry.isDebugEnabled()) {
      const originalHandler = handler
      handler = (message, name) => {
        originalHandler(message, name)
        telemetry.increase(this.executedMetric, executedMetricTag || this.executedMetricTag)
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

  addSub (channelName, handler, executedMetricTag) {
    super.addSub(channelName, this._wrapHandler(handler, executedMetricTag))
  }

  onConfigure () {}

  configure (config) {
    this.onConfigure()

    if (telemetry.isEnabled()) {
      this.enableSinkTelemetry(telemetry)
    }
    super.configure(config)
  }

  enableSinkTelemetry (telemetry) {
    const { channel } = require('diagnostics_channel')
    const loadChannel = channel('dd-trace:instrumentation:load')
    loadChannel.subscribe(({ name }) => this.onInstrumentationLoaded(name, telemetry, this.instrumentedMetric))
  }

  onInstrumentationLoaded (name, telemetry, metric) {
    name = `:${name}:`
    const subscription = this._subscriptions.filter(subscription => subscription._channel.name.includes(name))
    if (subscription && subscription.length) {
      telemetry.increase(metric)
    }
  }
}
