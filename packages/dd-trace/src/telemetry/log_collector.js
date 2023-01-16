'use strict'

const os = require('os')
const { calculateDDBasePath } = require('../util')

const maxEntries = 10000
const ddBasePath = calculateDDBasePath(__dirname)

const logs = new Set()
let overflowedCount = 0

function sanitize (log, stack) {
  let lines = stack.split(os.EOL)
  lines = lines.map(line => line.includes(ddBasePath) ? line : '[omitted]')
  log['stack_trace'] = lines.join(os.EOL)
}

const logCollector = {
  add (message, level, stack) {
    if (!message) return

    if (logs.size >= maxEntries) {
      overflowedCount++
      return
    }

    const log = {
      message,
      level
    }

    if (stack) {
      sanitize(log, stack)
    }

    logs.add(log)
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

  reset () {
    logs.clear()
    overflowedCount = 0
  }
}

logCollector.reset()

module.exports = logCollector
