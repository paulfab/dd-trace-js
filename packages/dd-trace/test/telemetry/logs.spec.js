const { expect } = require('chai')
const proxyquire = require('proxyquire')

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

    it('should be disabled and not subscribe', () => {
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

    it('should subscribe debug listeners', () => {
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
})
