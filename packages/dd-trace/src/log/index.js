'use strict'

const { debugChannel, infoChannel, warnChannel, errorChannel } = require('./channels')
const logWriter = require('./writer')

const memoize = func => {
  const cache = {}
  const memoized = function (key) {
    if (!cache[key]) {
      cache[key] = func.apply(this, arguments)
    }

    return cache[key]
  }

  return memoized
}

function processMsg (msg, options) {
  return {
    message: typeof msg === 'function' ? msg() : msg,
    options
  }
}

const log = {
  use (logger) {
    logWriter.use(logger)
    return this
  },

  toggle (enabled, logLevel) {
    logWriter.toggle(enabled, logLevel)
    return this
  },

  reset () {
    logWriter.reset()
    this._deprecate = memoize((code, message) => {
      errorChannel.publish(processMsg(message))
      return true
    })

    return this
  },

  debug (message, options) {
    if (debugChannel.hasSubscribers) {
      debugChannel.publish(processMsg(message, options))
    }
    return this
  },

  info (message, options) {
    if (infoChannel.hasSubscribers) {
      infoChannel.publish(processMsg(message, options))
    }
    return this
  },

  warn (message, options) {
    if (warnChannel.hasSubscribers) {
      warnChannel.publish(processMsg(message, options))
    }
    return this
  },

  error (err, options) {
    if (errorChannel.hasSubscribers) {
      errorChannel.publish(processMsg(err, options))
    }
    return this
  },

  deprecate (code, message) {
    return this._deprecate(code, message)
  },

  with (defaultOptions) {
    return {
      debug: (message, options) => {
        return this.debug(message, { ...defaultOptions, ...options })
      },
      info: (message, options) => {
        return this.info(message, { ...defaultOptions, ...options })
      },
      warn: (message, options) => {
        return this.warn(message, { ...defaultOptions, ...options })
      },
      error: (err, options) => {
        return this.error(err, { ...defaultOptions, ...options })
      },
      deprecate: (code, message) => {
        return this.deprecate(code, message)
      }
    }
  }
}

log.reset()

module.exports = log
