'use strict'
const request = require('../../../exporters/common/request')
const log = require('../../../log')

const { AgentlessCiVisibilityEncoder } = require('../../../encode/agentless-ci-visibility')
const BaseWriter = require('../../../exporters/common/writer')

function safeJSONStringify (value) {
  return JSON.stringify(value, (key, value) =>
    key !== 'dd-api-key' ? value : undefined
  )
}

class Writer extends BaseWriter {
  constructor ({ url, tags }) {
    super(...arguments)
    const { 'runtime-id': runtimeId, env, service } = tags
    this._url = url
    this._encoder = new AgentlessCiVisibilityEncoder(this, { runtimeId, env, service })
  }

  _sendPayload (data, _, done) {
    const options = {
      path: '/api/v2/citestcycle',
      method: 'POST',
      headers: {
        'dd-api-key': process.env.DATADOG_API_KEY || process.env.DD_API_KEY,
        'Content-Type': 'application/msgpack'
      },
      timeout: 15000
    }

    options.protocol = this._url.protocol
    options.hostname = this._url.hostname
    options.port = this._url.port

    log.debug(() => `Request to the event intake: ${safeJSONStringify(options)}`)
    request(data, options, (err, res) => {
      if (err) {
        log.error(err)
        done(err)
        return
      }
      log.debug(`Response from the event intake: ${res}`)
      done()
    })
  }
}

module.exports = Writer
