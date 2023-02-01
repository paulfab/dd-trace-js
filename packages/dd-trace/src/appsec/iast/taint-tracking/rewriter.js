'use strict'

const Module = require('module')
const shimmer = require('../../../../../datadog-shimmer')
const log = require('../../../log')
const { isPrivateModule, isNotLibraryFile } = require('./filter')
const { csiMethods } = require('./csi-methods')
const telemetry = require('../telemetry')
const { Metrics } = require('../telemetry/metrics')
const { Verbosity } = require('../telemetry/verbosity')

let rewriter
let getPrepareStackTrace
function getRewriter () {
  if (!rewriter) {
    try {
      const iastRewriter = require('@datadog/native-iast-rewriter')
      const Rewriter = iastRewriter.Rewriter
      getPrepareStackTrace = iastRewriter.getPrepareStackTrace
      rewriter = new Rewriter({ csiMethods, telemetryVerbosity: telemetry.getVerbosityName() })
    } catch (e) {
      log.warn(`Unable to initialize TaintTracking Rewriter: ${e.message}`)
    }
  }
  return rewriter
}

let originalPrepareStackTrace = Error.prepareStackTrace
function getPrepareStackTraceAccessor () {
  let actual = getPrepareStackTrace(originalPrepareStackTrace)
  return {
    get () {
      return actual
    },
    set (value) {
      actual = getPrepareStackTrace(value)
      originalPrepareStackTrace = value
    }
  }
}

const telemetryOffRewrite = function (content, filename) {
  if (isPrivateModule(filename) && isNotLibraryFile(filename)) {
    return rewriter.rewrite(content, filename)
  }
}

const telemetryInformationRewrite = function (content, filename) {
  const response = telemetryOffRewrite(content, filename)

  // TODO: propagation_debug!
  const metrics = response.metrics
  if (metrics && metrics.instrumentedPropagation) {
    telemetry.add(Metrics.INSTRUMENTED_PROPAGATION, metrics.instrumentedPropagation)
  }

  return response
}

const telemetryDebugRewrite = function (content, filename) {
  const start = new Date().getTime()
  const response = telemetryInformationRewrite(content, filename)
  const rewriteTime = new Date().getTime() - start
  telemetry.add(Metrics.INSTRUMENTATION_TIME, rewriteTime)
  return response
}

function getRewriteFunction () {
  switch (telemetry.verbosity) {
    case Verbosity.OFF:
      return telemetryOffRewrite
    case Verbosity.DEBUG:
      return telemetryDebugRewrite
    default:
      return telemetryInformationRewrite
  }
}

function getCompileMethodFn (compileMethod) {
  const rewriteFn = getRewriteFunction()
  return function (content, filename) {
    try {
      const response = rewriteFn(content, filename)
      content = response.content
    } catch (e) {
      log.debug(e)
    }
    return compileMethod.apply(this, [content, filename])
  }
}

function enableRewriter () {
  const rewriter = getRewriter()
  if (rewriter) {
    Object.defineProperty(global.Error, 'prepareStackTrace', getPrepareStackTraceAccessor())
    shimmer.wrap(Module.prototype, '_compile', compileMethod => getCompileMethodFn(compileMethod))
  }
}

function disableRewriter () {
  shimmer.unwrap(Module.prototype, '_compile')
  Error.prepareStackTrace = originalPrepareStackTrace
}

module.exports = {
  enableRewriter, disableRewriter
}
