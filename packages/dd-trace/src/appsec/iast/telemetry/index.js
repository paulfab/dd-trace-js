'use strict'

const metrics = require('../../../telemetry/metrics')
const { Verbosity, isDebugAllowed, parseVerbosity } = require('./verbosity')
const { inc, drain } = require('./telemetry-collector')

const iastTelemetryVerbosity = process.env.DD_IAST_TELEMETRY_VERBOSITY
  ? parseVerbosity(process.env.DD_IAST_TELEMETRY_VERBOSITY)
  : Verbosity.INFORMATION

class Telemetry {
  configure (config) {
    this.enabled = config.telemetryEnabled
    this.verbosity = config.iastTelemetryVerbosity ?? iastTelemetryVerbosity
    metrics.registerProvider(drain)
  }

  isEnabled () {
    return this.enabled
  }

  isDebugEnabled () {
    return this.isEnabled() && isDebugAllowed(this.verbosity)
  }

  increase (metric, tag) {
    inc(metric, tag)
  }
}

module.exports = new Telemetry()
