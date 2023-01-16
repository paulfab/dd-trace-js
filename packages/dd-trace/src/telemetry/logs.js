'use strict'

const { isTrue } = require('../util')
const { sendData } = require('./send-data')
const { Level, subscribe, unsubscribe } = require('../log/channels')
const logCollector = require('./log_collector')

// TODO: those config values can change via RC?
const isLogCollectionEnabled = process.env.DD_INSTRUMENTATION_TELEMETRY_LOG_COLLECTION_ENABLED
  ? isTrue(process.env.DD_INSTRUMENTATION_TELEMETRY_LOG_COLLECTION_ENABLED)
  : true

const debugEnabled = process.env.TELEMETRY_DEBUG_ENABLED
  ? isTrue(process.env.TELEMETRY_DEBUG_ENABLED)
  : false

const defaultListeners = {
  [Level.Warn]: onWarn,
  [Level.Error]: onError
}

let config, application, host, listeners, interval

function onDebug (message) {
  logCollector.add(message, 'DEBUG')
}

function onWarn (message) {
  logCollector.add(message, 'WARN')
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

  logCollector.add(message, 'ERROR', stackTrace)
}

function sendLogs () {
  const logs = logCollector.drain()
  if (logs) {
    sendData(config, application, host, 'logs', logs)
  }
}

function start (aConfig, appplicationObject, hostObject, heartbeatInterval) {
  if (!isLogCollectionEnabled) return

  config = aConfig
  application = appplicationObject
  host = hostObject

  if (debugEnabled) {
    listeners = Object.assign({}, defaultListeners, {
      [Level.Debug]: onDebug,
      [Level.Info]: onDebug
    })
  } else {
    listeners = defaultListeners
  }

  subscribe(listeners)

  interval = setInterval(sendLogs, heartbeatInterval)
  interval.unref()
}

function stop () {
  if (!isLogCollectionEnabled) return

  config = null
  application = null
  host = null
  listeners = defaultListeners

  unsubscribe(listeners)

  clearInterval(interval)
}

module.exports = { start, stop }
