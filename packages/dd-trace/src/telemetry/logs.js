'use strict'

const { storage } = require('../../../datadog-core')
const { isTrue } = require('../util')
const { sendData } = require('./send-data')
const { Level, subscribe, unsubscribe } = require('../log_channels')

// TODO: those config values can change via RC?
const isLogCollectionEnabled = process.env.DD_INSTRUMENTATION_TELEMETRY_LOG_COLLECTION_ENABLED
  ? isTrue(process.env.DD_INSTRUMENTATION_TELEMETRY_LOG_COLLECTION_ENABLED)
  : true

const debugEnabled = process.env.TELEMETRY_DEBUG_ENABLED
  ? isTrue(process.env.TELEMETRY_DEBUG_ENABLED)
  : false

let config, application, host, listeners

const defaultListeners = {
  [Level.Warn]: onWarn,
  [Level.Error]: onError
}

function onDebug (message) {
  sendLogs({
    message,
    level: 'DEBUG'
  })
}

function onWarn (message) {
  sendLogs({
    message,
    level: 'WARN'
  })
}

function onError (err) {
  if (err instanceof Function) {
    err = err()
  }

  let message
  let stackTrace
  if (typeof err !== 'object' || !err) {
    message = String(err)
  } else if (!err.stack) {
    message = String(err.message || err)
  } else {
    message = err.message || err
    stackTrace = err.stack
  }

  sendLogs({
    message,
    stack_trace: stackTrace,
    level: 'ERROR'
  })
}

function addTags (payload) {
  const context = storage.getStore()
  if (context && context.span) {
    // const spanContext = context.span.context()
    // payload.tags = `traceId:`
  }
  return payload
}

function sendLogs (payload) {
  sendData(config, application, host, 'logs', addTags(payload))
}

function start (_config, _application, _host) {
  if (!isLogCollectionEnabled) return

  config = _config
  application = _application
  host = _host

  if (debugEnabled) {
    listeners = Object.assign({}, defaultListeners, {
      [Level.Debug]: onDebug,
      [Level.Info]: onDebug
    })
  } else {
    listeners = defaultListeners
  }

  subscribe(listeners)
}

function stop () {
  if (!isLogCollectionEnabled) return

  config = null
  application = null
  host = null
  listeners = defaultListeners

  unsubscribe(listeners)
}

module.exports = { start, stop }
