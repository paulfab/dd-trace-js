'use strict'

const TelemetryPlugin = require('./plugin')

const metricProviders = new Set()

class MetricsTelemetryPlugin extends TelemetryPlugin {
  constructor () {
    super('generate-metrics')
  }

  getPayload () {
    const series = []
    metricProviders.forEach(provider => {
      const metrics = provider()
      if (metrics) {
        series.push(...metrics)
      }
    })
    if (series.length > 0) {
      return {
        namespace: 'tracers',
        series
      }
    }
  }

  registerProvider (provider) {
    metricProviders.add(provider)
  }
}

module.exports = new MetricsTelemetryPlugin()
