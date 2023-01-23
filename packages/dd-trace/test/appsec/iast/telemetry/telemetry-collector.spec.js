'use strict'

const { expect } = require('chai')
const { Metrics } = require('../../../../src/appsec/iast/telemetry/metrics')
const { inc } = require('../../../../src/appsec/iast/telemetry/telemetry-collector')

const INSTRUMENTED_PROPAGATION = Metrics.INSTRUMENTED_PROPAGATION
const INSTRUMENTED_SOURCE = Metrics.INSTRUMENTED_SOURCE
const REQUEST_TAINTED = Metrics.REQUEST_TAINTED

describe('IAST TelemetryCollector', () => {
  describe('inc', () => {
    it('should increment a conflated metric', () => {
      inc(INSTRUMENTED_PROPAGATION.name)

      let points = INSTRUMENTED_PROPAGATION.drain()
      expect(points.length).to.be.eq(1)
      expect(points[0].value).to.be.eq(1)

      points = INSTRUMENTED_PROPAGATION.drain()
      expect(points.length).to.be.eq(0)
    })

    it('should increment a conflated metric every time it is called', () => {
      inc(INSTRUMENTED_PROPAGATION.name)
      inc(INSTRUMENTED_PROPAGATION.name)
      inc(INSTRUMENTED_PROPAGATION.name)

      let points = INSTRUMENTED_PROPAGATION.drain()
      expect(points.length).to.be.eq(1)
      expect(points[0].value).to.be.eq(3)

      points = INSTRUMENTED_PROPAGATION.drain()
      expect(points.length).to.be.eq(0)
    })

    it('should increment a conflated tagged metric', () => {
      inc(INSTRUMENTED_SOURCE.name, 'tag1')

      let taggedPoints = INSTRUMENTED_SOURCE.drain()
      expect(taggedPoints.size).to.be.eq(1)
      let tag1Points = taggedPoints.get('tag1')
      expect(tag1Points.length).to.be.eq(1)
      expect(tag1Points[0].value).to.be.eq(1)

      taggedPoints = INSTRUMENTED_SOURCE.drain()
      expect(taggedPoints.size).to.be.eq(1)
      tag1Points = taggedPoints.get('tag1')
      expect(tag1Points.length).to.be.eq(0)
    })

    it('should increment a conflated tagged metric every time is called', () => {
      inc(INSTRUMENTED_SOURCE.name, 'tag1')
      inc(INSTRUMENTED_SOURCE.name, 'tag1')
      inc(INSTRUMENTED_SOURCE.name, 'tag1')

      const taggedPoints = INSTRUMENTED_SOURCE.drain()
      expect(taggedPoints.size).to.be.eq(1)
      const tag1Points = taggedPoints.get('tag1')
      expect(tag1Points.length).to.be.eq(1)
      expect(tag1Points[0].value).to.be.eq(3)
    })

    it('should increment an aggregated metric', () => {
      inc(REQUEST_TAINTED.name)
      inc(REQUEST_TAINTED.name)

      let points = REQUEST_TAINTED.drain()
      expect(points.length).to.be.eq(2)
      expect(points[0].value).to.be.eq(1)

      points = REQUEST_TAINTED.drain()
      expect(points.length).to.be.eq(0)
    })
  })
})
