'use strict'

const { debugChannel, infoChannel, warnChannel, errorChannel } = require('../log/channels')
const logCollector = require('./log_collector')
const { sendData } = require('./send-data')
const { isTrue } = require('../util')

const isLogCollectionEnabled = process.env.DD_INSTRUMENTATION_TELEMETRY_LOG_COLLECTION_ENABLED
  ? isTrue(process.env.DD_INSTRUMENTATION_TELEMETRY_LOG_COLLECTION_ENABLED)
  : true

const debugEnabled = process.env.TELEMETRY_DEBUG_ENABLED
  ? isTrue(process.env.TELEMETRY_DEBUG_ENABLED)
  : false

const SEND_TELEMETRY = Symbol('_dd.log.SEND_TELEMETRY')
const SEND_TELEMETRY_MARK = {
  [SEND_TELEMETRY]: true
}

let config, application, host, interval

function isSendTelemetryAvailable (messageObj) {
  return messageObj.options &&
    messageObj.options[SEND_TELEMETRY]
}

function addLog (messageObj, level) {
  const message = messageObj.message

  let logMessage
  let stackTrace
  if (typeof message !== 'object' || !message) {
    logMessage = String(message)
  } else if (!message.stack) {
    logMessage = String(message.message || message)
  } else {
    logMessage = message.message || message
    stackTrace = message.stack
  }
  if (stackTrace || isSendTelemetryAvailable(messageObj)) {
    logCollector.add(logMessage, level, stackTrace)
  }
}

function onDebug (messageObj) {
  addLog(messageObj, 'DEBUG')
}

function onWarn (messageObj) {
  addLog(messageObj, 'WARN')
}

function onError (messageObj) {
  addLog(messageObj, 'ERROR')
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

  if (debugChannel.hasSubscribers) {
    debugChannel.unsubscribe(onDebug)
  }
  if (infoChannel.hasSubscribers) {
    infoChannel.unsubscribe(onDebug)
  }
  if (warnChannel.hasSubscribers) {
    warnChannel.unsubscribe(onWarn)
  }
  if (errorChannel.hasSubscribers) {
    errorChannel.unsubscribe(onError)
  }

  clearInterval(interval)
}

module.exports = { start, stop, SEND_TELEMETRY_MARK }
