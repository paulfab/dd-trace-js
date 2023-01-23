'use strict'

const { Metrics, TaggedMetric } = require('./metrics')
const { log } = require('../../../log')

const APPSEC_NAMESPACE = 'appsec'

const metrics = new Map()
for (const iastMetricName in Metrics) {
  const iastMetric = Metrics[iastMetricName]
  metrics.set(iastMetric.name, iastMetric)
}

function inc (metric, tag) {
  if (!metric) return

  if (typeof metric === 'string') {
    add(metrics.get(metric), 1, tag)
  } else {
    add(metric, 1, tag)
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

function getPayloadMetric (name, metric, points, tag) {
  return {
    name,
    common: metric.common,
    type: metric.type,
    points,
    tag,
    namespace: APPSEC_NAMESPACE
  }
}

function drain () {
  const drained = []
  for (const [name, metric] of metrics) {
    const points = metric.drain()
    if (metric instanceof TaggedMetric) {
      if (points && points.size > 0) {
        for (const [taggedName, taggedMetric] of points) {
          if (!taggedMetric || taggedMetric.length === 0) continue
          drained.push(getPayloadMetric(name, metric, taggedMetric, taggedName))
        }
      }
    } else {
      if (points && points.length > 0) {
        drained.push(getPayloadMetric(name, metric, points))
      }
    }
  }
  return drained
}

module.exports = {
  inc,
  add,
  getMetrics,
  drain
}
