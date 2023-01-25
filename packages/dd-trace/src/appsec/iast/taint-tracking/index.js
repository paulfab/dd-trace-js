const { enableRewriter, disableRewriter } = require('./rewriter')
const { createTransaction, removeTransaction, enableTaintOperations, disableTaintOperations } = require('./operations')
const taintTrackingPlugin = require('./plugin')

module.exports = {
  enableTaintTracking (debugEnabled) {
    enableRewriter()
    enableTaintOperations(debugEnabled)
    taintTrackingPlugin.enable()
  },
  disableTaintTracking () {
    disableRewriter()
    disableTaintOperations()
    taintTrackingPlugin.disable()
  },
  createTransaction: createTransaction,
  removeTransaction: removeTransaction
}
