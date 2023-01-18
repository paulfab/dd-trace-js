'use strict'

const os = require('os')
const { calculateDDBasePath } = require('../util')

const ddBasePath = calculateDDBasePath(__dirname)

const logs = new Map()

let maxEntries = 10000
let overflowedCount = 0

function sanitize (log, stack) {
  if (!stack) return

  let lines = stack.split(os.EOL)

  // lines[0] ommited because it usually contains Error.message
  const isDDCode = lines[1].includes(ddBasePath)
  lines = lines.filter((line, index) => (isDDCode && index === 0) || line.includes(ddBasePath))

  log['stack_trace'] = lines.join(os.EOL)

  if (!isDDCode) {
    log['message'] = 'omitted'
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

function createHash (log) {
  if (!log) return 0

  const prime = 31
  let result = 1
  result = prime * result + ((!log.level) ? 0 : hashCode(log.level))
  result = prime * result + ((!log.message) ? 0 : hashCode(log.message))
  result = prime * result + ((!log.tags) ? 0 : hashCode(log.tags))
  result = prime * result + ((!log.stack) ? 0 : hashCode(log.stack))
  return result
}

const logCollector = {
  add (message, level, stack, tags) {
    if (!message) return

    if (logs.size >= maxEntries) {
      overflowedCount++
      return
    }

    const log = {
      message,
      level,
      tags
    }

    if (stack) {
      sanitize(log, stack)
    }

    const hash = createHash(log)
    if (!logs.has(hash)) {
      logs.set(hash, log)
      return true
    } else {
      return false
    }
  },

  drain () {
    if (logs.size === 0) return

    const drained = []
    drained.push(...logs.values())

    if (overflowedCount > 0) {
      const overflowErrorLog = {
        message: `Omitted ${overflowedCount} entries due to overflowing`,
        level: 'ERROR'
      }
      drained.push(overflowErrorLog)
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
