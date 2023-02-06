'use strict'

const { calculateDDBasePath } = require('../util')
const log = require('../log')

const ddBasePath = calculateDDBasePath(__dirname)
const EOL = '\n'
const STACK_FRAME_LINE_REGEX = /^\s*at/gm

const logs = new Map()

// NOTE: Is this a reasonable number?
let maxEntries = 10000
let overflowedCount = 0

function sanitize (log, stack) {
  if (!stack) return

  let stackLines = stack.split(EOL)

  let firstIndex = -1
  for (let i = 0; i < stackLines.length; i++) {
    if (stackLines[i].match(STACK_FRAME_LINE_REGEX)) {
      firstIndex = i
      break
    }
  }

  const isDDCode = firstIndex > -1 ? stackLines[firstIndex].includes(ddBasePath) : false
  stackLines = stackLines.filter((line, index) => (isDDCode && index < firstIndex) || line.includes(ddBasePath))

  log.stack_trace = stackLines.join(EOL)

  if (!isDDCode) {
    log.message = 'omitted'
  }
}

function hashCode (hashSource) {
  let hash = 0
  let offset = 0
  const size = hashSource.length
  for (let i = 0; i < size; i++) {
    hash = ((hash << 5) - hash) + hashSource.charCodeAt(offset++)
  }
  return hash
}

function createHash (logEntry) {
  if (!logEntry) return 0

  const prime = 31
  let result = 1
  result = prime * result + ((!logEntry.level) ? 0 : hashCode(logEntry.level))
  result = prime * result + ((!logEntry.message) ? 0 : hashCode(logEntry.message))

  // NOTE: tags are not used at the moment
  // result = prime * result + ((!log.tags) ? 0 : hashCode(log.tags))
  result = prime * result + ((!logEntry.stack_trace) ? 0 : hashCode(logEntry.stack_trace))
  return result
}

function newLogEntry (message, level, tags) {
  return {
    message,
    level,
    tags
  }
}

const logCollector = {
  add (message, level, stack, tags) {
    if (!message) return

    // NOTE: should errors have higher priority? and discard log entries with lower priority?
    if (logs.size >= maxEntries) {
      overflowedCount++
      return
    }

    const logEntry = newLogEntry(message, level, tags)
    try {
      if (stack) {
        sanitize(logEntry, stack)
      }

      const hash = createHash(logEntry)
      if (!logs.has(hash)) {
        logs.set(hash, logEntry)
        return true
      }
    } catch (e) {
      log.error(`Unable to add log to logCollector: ${e.message}`)
    }
    return false
  },

  drain () {
    if (logs.size === 0) return

    const drained = []
    drained.push(...logs.values())

    if (overflowedCount > 0) {
      drained.push(newLogEntry(`Omitted ${overflowedCount} entries due to overflowing`, 'ERROR'))
    }

    this.reset()

    return drained
  },

  reset (max) {
    logs.clear()
    overflowedCount = 0
    if (max) {
      maxEntries = max
    }
  }
}

logCollector.reset()

module.exports = logCollector
