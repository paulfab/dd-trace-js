const { expect } = require('chai')
const proxyquire = require('proxyquire')
const { SEND_TELEMETRY_MARK } = require('../../src/telemetry')

describe('telemetry logs', () => {
  const errorChannel = {
    subscribe: sinon.stub(),
    unsubscribe: sinon.stub()
  }
  const warnChannel = {
    subscribe: sinon.stub(),
    unsubscribe: sinon.stub()
  }
  const infoChannel = {
    subscribe: sinon.stub(),
    unsubscribe: sinon.stub()
  }
  const debugChannel = {
    subscribe: sinon.stub(),
    unsubscribe: sinon.stub()
  }

  beforeEach(() => {
    errorChannel.subscribe.reset()
    errorChannel.unsubscribe.reset()
    warnChannel.subscribe.reset()
    warnChannel.unsubscribe.reset()
    infoChannel.subscribe.reset()
    infoChannel.unsubscribe.reset()
    debugChannel.subscribe.reset()
    debugChannel.unsubscribe.reset()
  })

  describe('start', () => {
    it('should be enabled by default and subscribe', () => {
      const logs = proxyquire('../../src/telemetry/logs', {
        '../log/channels': { errorChannel }
      })
      logs.start()
      expect(errorChannel.subscribe).to.have.been.calledOnce
    })

    it('should be disabled and not subscribe if DD_INSTRUMENTATION_TELEMETRY_LOG_COLLECTION_ENABLED = false', () => {
      process.env.DD_INSTRUMENTATION_TELEMETRY_LOG_COLLECTION_ENABLED = 'false'

      const logs = proxyquire('../../src/telemetry/logs', {
        '../log/channels': { errorChannel }
      })
      logs.start()
      expect(errorChannel.subscribe).to.not.have.been.calledOnce

      delete process.env.DD_INSTRUMENTATION_TELEMETRY_LOG_COLLECTION_ENABLED
    })

    it('should subscribe default listeners', () => {
      const logs = proxyquire('../../src/telemetry/logs', {
        '../log/channels': { errorChannel, warnChannel }
      })
      logs.start()
      expect(errorChannel.subscribe).to.have.been.calledOnce
      expect(warnChannel.subscribe).to.have.been.calledOnce
    })

    it('should subscribe debug listeners when TELEMETRY_DEBUG_ENABLED = true', () => {
      process.env.TELEMETRY_DEBUG_ENABLED = 'true'

      const logs = proxyquire('../../src/telemetry/logs', {
        '../log/channels': { errorChannel, warnChannel, infoChannel, debugChannel }
      })
      logs.start()

      expect(errorChannel.subscribe).to.have.been.calledOnce
      expect(warnChannel.subscribe).to.have.been.calledOnce
      expect(infoChannel.subscribe).to.have.been.calledOnce
      expect(debugChannel.subscribe).to.have.been.calledOnce

      delete process.env.TELEMETRY_DEBUG_ENABLED
    })

    it('should call sendData periodically', () => {
      const originalSetInterval = global.setInterval
      const sendData = sinon.stub()

      return new Promise(resolve => {
        global.setInterval = (fn, interval) => {
          expect(interval).eq(60000)
          expect(fn.name).eq('sendLogs')
          return setImmediate(() => {
            resolve(fn())
          })
        }
        const logs = proxyquire('../../src/telemetry/logs', {
          '../log/channels': { errorChannel, warnChannel, infoChannel, debugChannel },
          './send-data': { sendData },
          './log_collector': {
            drain: () => { return { message: 'Error 1', level: 'ERROR' } }
          }
        })
        logs.start({}, {}, {}, 60000)

        global.setInterval = originalSetInterval
      }).then(() => {
        expect(sendData).to.have.been.calledOnce
      })
    })
  })

  describe('stop', () => {
    it('should unsubscribe all listeners', () => {
      const logs = proxyquire('../../src/telemetry/logs', {
        '../log/channels': { errorChannel, warnChannel, infoChannel, debugChannel }
      })
      logs.start()

      logs.stop()

      expect(errorChannel.unsubscribe).to.have.been.calledOnce
      expect(warnChannel.unsubscribe).to.have.been.calledOnce
      expect(infoChannel.unsubscribe).to.have.been.calledOnce
      expect(debugChannel.unsubscribe).to.have.been.calledOnce
    })
  })

  describe('sendData', () => {
    const config = {}
    const app = {}
    const host = {}

    let onWarn
    const warnChannel = {
      subscribe: function (onMessage) {
        onWarn = onMessage
      }
    }

    let onError
    const errorChannel = {
      subscribe: function (onMessage) {
        onError = onMessage
      }
    }

    function processMsg (message, options) {
      return {
        message,
        options
      }
    }

    it('should be called with WARN level', () => {
      const logCollectorAdd = sinon.stub()
      const logs = proxyquire('../../src/telemetry/logs', {
        '../log/channels': { warnChannel },
        './log_collector': {
          add: logCollectorAdd
        }
      })
      logs.start(config, app, host)

      onWarn(processMsg('message', SEND_TELEMETRY_MARK))

      expect(logCollectorAdd).to.be.calledOnceWith('message', 'WARN')
    })

    it('should be called with ERROR level', () => {
      const logCollectorAdd = sinon.stub()
      const logs = proxyquire('../../src/telemetry/logs', {
        '../log/channels': { errorChannel },
        './log_collector': {
          add: logCollectorAdd
        }
      })
      logs.start(config, app, host)

      onError(processMsg('message'))

      expect(logCollectorAdd).to.be.calledOnceWith('message', 'ERROR')
    })

    it('should be called with ERROR level and stack_trace', () => {
      const logCollectorAdd = sinon.stub()
      const logs = proxyquire('../../src/telemetry/logs', {
        '../log/channels': { errorChannel },
        './log_collector': {
          add: logCollectorAdd
        }
      })
      logs.start(config, app, host)

      const error = new Error('message')
      const stack = error.stack
      onError(processMsg(error))

      expect(logCollectorAdd).to.be.calledOnceWith('message', 'ERROR', stack)
    })
  })
})
