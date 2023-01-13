const { expect } = require('chai')
const proxyquire = require('proxyquire')
const { Level } = require('../../src/log_channels')

describe('telemetry logs', () => {
  describe('start', () => {
    it('should be enabled by default and subscribe', () => {
      const subscribe = sinon.stub()
      const logs = proxyquire('../../src/telemetry/logs', {
        '../log_channels': { subscribe }
      })
      logs.start()
      expect(subscribe).to.have.been.calledOnce
    })

    it('should be disabled and not subscribe if DD_INSTRUMENTATION_TELEMETRY_LOG_COLLECTION_ENABLED = false', () => {
      process.env.DD_INSTRUMENTATION_TELEMETRY_LOG_COLLECTION_ENABLED = 'false'

      const subscribe = sinon.stub()
      const logs = proxyquire('../../src/telemetry/logs', {
        '../log_channels': { subscribe }
      })
      logs.start()
      expect(subscribe).to.not.have.been.called

      delete process.env.DD_INSTRUMENTATION_TELEMETRY_LOG_COLLECTION_ENABLED
    })

    it('should subscribe default listeners', () => {
      const subscribe = sinon.stub()
      const logs = proxyquire('../../src/telemetry/logs', {
        '../log_channels': { subscribe }
      })
      logs.start()

      expect(subscribe).to.have.been.calledOnce

      const listeners = subscribe.getCall(0).args[0]
      expect(listeners).to.include.all.keys('error', 'warn')
    })

    it('should subscribe debug listeners when TELEMETRY_DEBUG_ENABLED = true', () => {
      process.env.TELEMETRY_DEBUG_ENABLED = 'true'

      const subscribe = sinon.stub()
      const logs = proxyquire('../../src/telemetry/logs', {
        '../log_channels': { subscribe }
      })
      logs.start()

      expect(subscribe).to.have.been.calledOnce

      const listeners = subscribe.getCall(0).args[0]
      expect(listeners).to.include.all.keys('error', 'warn', 'info', 'debug')

      delete process.env.TELEMETRY_DEBUG_ENABLED
    })
  })

  describe('sendData', () => {
    const config = {}
    const app = {}
    const host = {}

    let listeners
    const subscribe = (_listeners) => {
      listeners = _listeners
    }

    it('should be called with WARN level', () => {
      const sendData = sinon.stub()
      const logs = proxyquire('../../src/telemetry/logs', {
        '../log_channels': { subscribe },
        './send-data': { sendData }
      })
      logs.start(config, app, host)

      listeners[Level.Warn]('message')

      expect(sendData).to.be.calledOnceWith(config, app, host, 'logs', { message: 'message', level: 'WARN' })
    })

    it('should be called with ERROR level', () => {
      const sendData = sinon.stub()
      const logs = proxyquire('../../src/telemetry/logs', {
        '../log_channels': { subscribe },
        './send-data': { sendData }
      })
      logs.start(config, app, host)

      listeners[Level.Error]('message')

      expect(sendData).to.be.calledOnceWith(config, app, host, 'logs', { message: 'message', level: 'ERROR' })
    })

    it('should be called with ERROR level and stack_trace', () => {
      const sendData = sinon.stub()
      const logs = proxyquire('../../src/telemetry/logs', {
        '../log_channels': { subscribe },
        './send-data': { sendData }
      })
      logs.start(config, app, host)

      const error = new Error('message')
      const stack = error.stack
      listeners[Level.Error](error)

      expect(sendData).to.be.calledOnceWith(config, app, host, 'logs', {
        message: 'message', level: 'ERROR', stack_trace: logs.sanitizeStackTrace(stack)
      })
    })
  })
})
