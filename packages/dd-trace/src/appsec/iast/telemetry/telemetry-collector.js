'use strict'

const iastMetrics = require('./metrics')
const { log } = require('../../../log')

const metrics = new Map()
for (const iastMetricName in iastMetrics) {
  const iastMetric = iastMetrics[iastMetricName]
  metrics.set(iastMetric.name, iastMetric)
}

function inc (metric, tag) {
  if (!metric) return

  if (typeof metric === 'string') {
    add(metrics.get(metric), 1n, tag)
  } else {
    add(metric, 1n, tag)
  }
}

function add (metric, value, tag) {
  try {
    metric && metric.add(value, tag)
  } catch (e) {
    log.error(e)
  }
}

function getMetrics () {
  return metrics.values()
}

module.exports = {
  inc,
  add,
  getMetrics
}
