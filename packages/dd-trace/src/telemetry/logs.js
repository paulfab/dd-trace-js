'use strict'

const { isTrue } = require('../util')
const { sendData } = require('./send-data')
const { debugChannel, infoChannel, warnChannel, errorChannel } = require('../log/channels')
const logCollector = require('./log_collector')

// TODO: those config values can change via RC?
const isLogCollectionEnabled = process.env.DD_INSTRUMENTATION_TELEMETRY_LOG_COLLECTION_ENABLED
  ? isTrue(process.env.DD_INSTRUMENTATION_TELEMETRY_LOG_COLLECTION_ENABLED)
  : true

const debugEnabled = process.env.TELEMETRY_DEBUG_ENABLED
  ? isTrue(process.env.TELEMETRY_DEBUG_ENABLED)
  : false

let config, application, host, interval

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
    debugChannel.subscribe(onDebug)
    infoChannel.subscribe(onDebug)
  }
  warnChannel.subscribe(onWarn)
  errorChannel.subscribe(onError)

  if (heartbeatInterval) {
    interval = setInterval(sendLogs, heartbeatInterval)
    interval.unref()
  }
}

function stop () {
  if (!isLogCollectionEnabled) return

  config = null
  application = null
  host = null

  debugChannel.unsubscribe(onDebug)
  infoChannel.unsubscribe(onDebug)
  warnChannel.unsubscribe(onWarn)
  errorChannel.unsubscribe(onError)

  clearInterval(interval)
}

module.exports = { start, stop }
