'use strict'

const metrics = require('../../../telemetry/metrics')
const { Verbosity, isDebugAllowed, parseVerbosity, getName } = require('./verbosity')
const { inc, add, drain } = require('./telemetry-collector')

const iastTelemetryVerbosity = process.env.DD_IAST_TELEMETRY_VERBOSITY
  ? parseVerbosity(process.env.DD_IAST_TELEMETRY_VERBOSITY)
  : Verbosity.INFORMATION

class Telemetry {
  configure (config) {
    this.enabled = config.telemetryEnabled
    this.verbosity = parseVerbosity(config.iastTelemetryVerbosity) ?? iastTelemetryVerbosity
    metrics.registerProvider(drain)
  }

  isEnabled () {
    return this.enabled
  }

  isDebugEnabled () {
    return this.isEnabled() && isDebugAllowed(this.verbosity)
  }

  getVerbosityName () {
    return getName(this.verbosity)
  }

  increase (metric, tag) {
    inc(metric, tag)
  }

  add (metric, value, tag) {
    add(metric, value, tag)
  }

  wrap (handler, thisArg, metric, tag) {
    const telemetry = this
    return function () {
      telemetry.increase(metric, tag)
      return handler.apply(thisArg, arguments)
    }
  }

  wrapObject (object, metric, tag) {
    for (const method in object) {
      object[method] = this.wrap(object[method], object, metric, tag)
    }
    return object
  }
}

module.exports = new Telemetry()
