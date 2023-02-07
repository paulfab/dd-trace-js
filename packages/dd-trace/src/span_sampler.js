'use strict'
const { globMatch } = require('../src/util')
const { USER_KEEP, AUTO_KEEP } = require('../../../ext').priority
const RateLimiter = require('./rate_limiter')
const Sampler = require('./sampler')

class SpanSamplingRule {
  constructor ({ service, name, sampleRate = 1.0, maxPerSecond } = {}) {
    this.service = service
    this.name = name
    this.maxPerSecond = maxPerSecond

    this.sampler = new Sampler(sampleRate)
    this.limiter = undefined

    if (Number.isFinite(maxPerSecond)) {
      this.limiter = new RateLimiter(maxPerSecond)
    }
  }

  get sampleRate () {
    return this.sampler.rate()
  }

  static from (config) {
    return new SpanSamplingRule(config)
  }

  match (service, name) {
    if (this.service && !globMatch(this.service, service)) {
      return false
    }

    if (this.name && !globMatch(this.name, name)) {
      return false
    }

    return true
  }

  sample () {
    if (!this.sampler.isSampled()) {
      return false
    }

    if (this.limiter) {
      return this.limiter.isAllowed()
    }

    return true
  }
}

class SpanSampler {
  constructor ({ spanSamplingRules = [] } = {}) {
    this._rules = spanSamplingRules.map(SpanSamplingRule.from)
  }

  findRule (service, name) {
    for (const rule of this._rules) {
      if (rule.match(service, name)) {
        return rule
      }
    }
  }

  sample (spanContext) {
    const decision = spanContext._sampling.priority
    if (decision === USER_KEEP || decision === AUTO_KEEP) return

    const { started } = spanContext._trace
    for (const span of started) {
      const tags = spanContext._tags || {}
      const name = span._name
      const service = tags.service ||
        tags['service.name'] ||
        span.tracer()._service

      const rule = this.findRule(service, name)
      if (rule && rule.sample()) {
        span.context()._sampling.spanSampling = {
          sampleRate: rule.sampleRate,
          maxPerSecond: rule.maxPerSecond
        }
      }
    }
  }
}

module.exports = SpanSampler
