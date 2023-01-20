'use strict'
const { SOURCE_TYPE, VULNERABILITY_TYPE } = require('./metric-tag')

const MAX_QUEUE_SIZE = 1000

class Point {
  constructor (value, timestamp = new Date().getTime()) {
    this.value = value
    this.timestamp = timestamp
  }
}

class ConflatedMetric {
  constructor () {
    this.value = 0n
  }

  add (value) {
    this.value += value
  }

  drain () {
    const current = this.value
    this.value = 0n
    return current !== 0n ? [new Point(current)] : []
  }
}

class AggregatedMetric {
  constructor () {
    this.value = []
  }

  add (value) {
    this.value.push(new Point(value))
    if (this.value.length === MAX_QUEUE_SIZE) {
      this.value.shift()
    }
  }

  drain () {
    const current = this.value
    this.value = []
    return current
  }
}

class Metric {
  constructor (name, common) {
    this.name = name
    this.common = common
    this.type = 'COUNT'
  }
}

class SingleMetric extends Metric {
  constructor (name, common, handler) {
    super(name, common)
    this.handler = handler
  }

  add (value) {
    this.handler.add(value)
  }

  drain () {
    return this.handler.drain()
  }
}

class TaggedMetric extends Metric {
  constructor (name, common, metricTag, supplier) {
    super(name, common)
    this.metricTag = metricTag
    this.supplier = supplier
    this.handlers = new Map()
  }

  getTagName () {
    return this.metricTag.getName()
  }

  add (value, tag) {
    let handler = this.handlers.get(tag)
    if (!handler) {
      handler = this.supplier()
      this.handlers.set(tag, handler)
    }
    handler.add(value)
  }

  drain () {
    const result = new Map()
    for (const [key, value] of this.handlers) {
      result.set(key, value.drain())
    }
    return result
  }
}

function getExecutedMetric (metricTag) {
  return metricTag === VULNERABILITY_TYPE ? EXECUTED_SINK : EXECUTED_SOURCE
}

function getInstrumentedMetric (metricTag) {
  return metricTag === VULNERABILITY_TYPE ? INSTRUMENTED_SINK : INSTRUMENTED_SOURCE
}

const INSTRUMENTED_PROPAGATION =
  new SingleMetric('instrumented.propagation', true, new ConflatedMetric())
const INSTRUMENTED_SOURCE =
  new TaggedMetric('instrumented.source', true, SOURCE_TYPE, () => new ConflatedMetric())
const INSTRUMENTED_SINK =
  new TaggedMetric('instrumented.sink', true, VULNERABILITY_TYPE, () => new ConflatedMetric())
const INSTRUMENTATION_TIME =
  new SingleMetric('instrumentation.time', true, new ConflatedMetric())

const EXECUTED_PROPAGATION =
  new SingleMetric('executed.propagation', true, new ConflatedMetric())
const EXECUTED_SOURCE =
  new TaggedMetric('executed.source', true, SOURCE_TYPE, () => new ConflatedMetric())
const EXECUTED_SINK =
  new TaggedMetric('executed.sink', true, VULNERABILITY_TYPE, () => new ConflatedMetric())
const EXECUTED_TAINTED =
  new SingleMetric('executed.tainted', true, new ConflatedMetric())
const EXECUTION_TIME =
  new SingleMetric('execution.time', true, new ConflatedMetric())
const REQUEST_TAINTED =
  new SingleMetric('request.tainted', true, new AggregatedMetric())

module.exports = {
  INSTRUMENTED_PROPAGATION,
  INSTRUMENTED_SOURCE,
  INSTRUMENTED_SINK,
  INSTRUMENTATION_TIME,
  EXECUTED_PROPAGATION,
  EXECUTED_SOURCE,
  EXECUTED_SINK,
  EXECUTED_TAINTED,
  EXECUTION_TIME,
  REQUEST_TAINTED,

  getExecutedMetric,
  getInstrumentedMetric
}
