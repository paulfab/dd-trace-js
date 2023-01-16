'use strict'

const os = require('os')

const { isTrue, calculateDDBasePath } = require('../util')
const { sendData } = require('./send-data')
const { Level, subscribe, unsubscribe } = require('../log/channels')

// TODO: those config values can change via RC?
const isLogCollectionEnabled = process.env.DD_INSTRUMENTATION_TELEMETRY_LOG_COLLECTION_ENABLED
  ? isTrue(process.env.DD_INSTRUMENTATION_TELEMETRY_LOG_COLLECTION_ENABLED)
  : true

const debugEnabled = process.env.TELEMETRY_DEBUG_ENABLED
  ? isTrue(process.env.TELEMETRY_DEBUG_ENABLED)
  : false

const ddBasePath = calculateDDBasePath(__dirname)
const defaultListeners = {
  [Level.Warn]: onWarn,
  [Level.Error]: onError
}

let config, application, host, listeners

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

  const payload = {
    level: 'ERROR'
  }

  let message
  if (typeof err !== 'object' || !err) {
    message = String(err)
  } else if (!err.stack) {
    message = String(err.message || err)
  } else {
    message = err.message || err
    payload['stack_trace'] = sanitizeStackTrace(err.stack)
  }

  payload['message'] = message

  sendLogs(payload)
}

function sanitizeStackTrace (stackTrace) {
  let lines = stackTrace.split(os.EOL)
  lines = lines.map(line => line.includes(ddBasePath) ? line : '[omitted]')
  return lines.join(os.EOL)
}

// TODO
function addTags (payload) {
  return payload
}

function sendLogs (payload) {
  sendData(config, application, host, 'logs', addTags(payload))
}

function start (aConfig, appplicationObject, hostObject) {
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
}

function stop () {
  if (!isLogCollectionEnabled) return

  config = null
  application = null
  host = null
  listeners = defaultListeners

  unsubscribe(listeners)
}

module.exports = { start, stop, sanitizeStackTrace }
