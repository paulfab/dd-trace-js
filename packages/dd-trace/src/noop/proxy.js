'use strict'

const NoopTracer = require('./tracer')
const NoopAppsecSDK = require('../appsec/sdk/noop')

const noop = new NoopTracer()
const noopAppsec = new NoopAppsecSDK()

class Tracer {
  constructor () {
    this._tracer = noop
    this.appsec = noopAppsec
  }

  init () {
    return this
  }

  use () {
    return this
  }

  trace (name, options, fn) {
    if (!fn) {
      fn = options
      options = {}
    }

    if (typeof fn !== 'function') return

    options = options || {}

    return this._tracer.trace(name, options, fn)
  }

  wrap (name, options, fn) {
    if (!fn) {
      fn = options
      options = {}
    }

    if (typeof fn !== 'function') return fn

    options = options || {}

    return this._tracer.wrap(name, options, fn)
  }

  setUrl () {
    this._tracer.setUrl.apply(this._tracer, arguments)
    return this
  }

  startSpan () {
    return this._tracer.startSpan.apply(this._tracer, arguments)
  }

  inject () {
    return this._tracer.inject.apply(this._tracer, arguments)
  }

  extract () {
    return this._tracer.extract.apply(this._tracer, arguments)
  }

  scope () {
    return this._tracer.scope.apply(this._tracer, arguments)
  }

  getRumData () {
    return this._tracer.getRumData.apply(this._tracer, arguments)
  }

  setUser () {
    this._tracer.setUser.apply(this._tracer, arguments)
    return this
  }
}

module.exports = Tracer
