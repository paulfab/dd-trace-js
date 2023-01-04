'use strict'

const addresses = require('./addresses')
const Limiter = require('../rate_limiter')
const web = require('../plugins/util/web')
const { storage } = require('../../../datadog-core')

// default limiter, configurable with setRateLimit()
let limiter = new Limiter(100)

const REQUEST_HEADERS_PASSLIST = [
  'accept',
  'accept-encoding',
  'accept-language',
  'content-encoding',
  'content-language',
  'content-length',
  'content-type',
  'forwarded',
  'forwarded-for',
  'host',
  'true-client-ip',
  'user-agent',
  'via',
  'x-client-ip',
  'x-cluster-client-ip',
  'x-forwarded',
  'x-forwarded-for',
  'x-real-ip'
]

const RESPONSE_HEADERS_PASSLIST = [
  'content-encoding',
  'content-language',
  'content-length',
  'content-type'
]

const metricsQueue = new Map()

function resolveHTTPRequest (params) {
  if (!params) return {}

  const headers = params[addresses.HTTP_INCOMING_HEADERS]

  return {
    remote_ip: params[addresses.HTTP_INCOMING_REMOTE_IP],
    headers: filterHeaders(headers, REQUEST_HEADERS_PASSLIST, 'http.request.headers.')
  }
}

function resolveHTTPResponse (params) {
  if (!params) return {}

  const headers = params[addresses.HTTP_INCOMING_RESPONSE_HEADERS]

  return {
    endpoint: params[addresses.HTTP_INCOMING_ENDPOINT],
    headers: filterHeaders(headers, RESPONSE_HEADERS_PASSLIST, 'http.response.headers.')
  }
}

function filterHeaders (headers, passlist, prefix) {
  const result = {}

  if (!headers) return result

  for (let i = 0; i < passlist.length; ++i) {
    const headerName = passlist[i]

    if (headers[headerName]) {
      result[`${prefix}${formatHeaderName(headerName)}`] = headers[headerName] + ''
    }
  }

  return result
}

// TODO: this can be precomputed at start time
function formatHeaderName (name) {
  return name
    .trim()
    .slice(0, 200)
    .replace(/[^a-zA-Z0-9_\-:/]/g, '_')
    .toLowerCase()
}

function reportMetrics (metrics) {
  // TODO metrics should be something incremental
  //  there is already a RFC to report metrics
  const store = storage.getStore()
  const req = store && store.req
  const topSpan = web.root(req)
  if (!topSpan) return false

  if (metrics.duration) {
    topSpan.setTag('_dd.appsec.waf.duration', metrics.duration)
  }

  if (metrics.durationExt) {
    topSpan.setTag('_dd.appsec.waf.duration_ext', metrics.durationExt)
  }

  if (metrics.rulesVersion) {
    topSpan.setTag('_dd.appsec.event_rules.version', metrics.rulesVersion)
  }
}

function reportAttack (attackData, params) {
  const store = storage.getStore()
  const req = store && store.req
  const topSpan = web.root(req)
  if (!topSpan) return false

  const currentTags = topSpan.context()._tags

  const newTags = {
    'appsec.event': 'true'
  }

  if (limiter.isAllowed()) {
    newTags['manual.keep'] = 'true' // TODO: figure out how to keep appsec traces with sampling revamp
  }

  // TODO: maybe add this to format.js later (to take decision as late as possible)
  if (!currentTags['_dd.origin']) {
    newTags['_dd.origin'] = 'appsec'
  }

  const currentJson = currentTags['_dd.appsec.json']

  // merge JSON arrays without parsing them
  if (currentJson) {
    newTags['_dd.appsec.json'] = currentJson.slice(0, -2) + ',' + attackData.slice(1, -1) + currentJson.slice(-2)
  } else {
    newTags['_dd.appsec.json'] = '{"triggers":' + attackData + '}'
  }

  if (params) {
    const resolvedRequest = resolveHTTPRequest(params)

    Object.assign(newTags, resolvedRequest.headers)

    const ua = resolvedRequest.headers['http.request.headers.user-agent']
    if (ua) {
      newTags['http.useragent'] = ua
    }
    if (resolvedRequest.remote_ip) {
      newTags['network.client.ip'] = resolvedRequest.remote_ip
    }
  }

  topSpan.addTags(newTags)
}

function finishRequest (req, wafContext, params) {
  if (!wafContext) return false
  if (!params) return false
  const topSpan = web.root(req)
  if (!topSpan) return false

  if (metricsQueue.size) {
    topSpan.addTags(Object.fromEntries(metricsQueue))

    metricsQueue.clear()
  }
  if (!topSpan.context()._tags['appsec.event']) {
    wafContext.dispose()
    return false
  }

  const resolvedResponse = resolveHTTPResponse(params)

  const newTags = resolvedResponse.headers

  if (resolvedResponse.endpoint) {
    newTags['http.endpoint'] = resolvedResponse.endpoint
  }

  topSpan.addTags(newTags)
  wafContext.dispose()
}

function setRateLimit (rateLimit) {
  limiter = new Limiter(rateLimit)
}

module.exports = {
  metricsQueue,
  resolveHTTPRequest,
  resolveHTTPResponse,
  filterHeaders,
  formatHeaderName,
  reportMetrics,
  reportAttack,
  finishRequest,
  setRateLimit
}
