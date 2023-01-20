'use strict'

const { expect } = require('chai')
const { channel } = require('diagnostics_channel')
const proxyquire = require('proxyquire')
const { VULNERABILITY_TYPE, SOURCE_TYPE } = require('../../../src/appsec/iast/telemetry/metric-tag')
const { getExecutedMetric, getInstrumentedMetric } = require('../../../src/appsec/iast/telemetry/metrics')

describe('IAST Plugin', () => {
  const loadChannel = channel('dd-trace:instrumentation:load')

  const logErrorMock = sinon.stub()
  const addSubMock = sinon.stub()
  const configureMock = sinon.stub()
  class PluginClass {
    addSub (channelName, handler) {
      addSubMock(channelName, handler)
    }
    configure (config) {
      configureMock(config)
    }
  }

  const handler = () => {
    throw new Error('handler error')
  }

  let iastPlugin

  beforeEach(() => {
    addSubMock.reset()
    logErrorMock.reset()
  })

  describe('with telemetry disabled', () => {
    const { IastPlugin } = proxyquire('../../../src/appsec/iast/iast-plugin', {
      '../../plugins/plugin': PluginClass,
      '../../log': {
        error: logErrorMock
      }
    })

    beforeEach(() => {
      iastPlugin = new IastPlugin()
    })

    describe('addSub', () => {
      it('should call Plugin.addSub with channelName and wrapped handler', () => {
        iastPlugin.addSub('test', handler)

        expect(addSubMock).to.be.calledOnce
        const args = addSubMock.getCall(0).args
        expect(args[0]).equal('test')

        const wrapped = args[1]
        expect(wrapped).to.be.a('function')
        expect(wrapped).to.not.be.equal(handler)
        expect(wrapped()).to.not.throw
        expect(logErrorMock).to.be.calledOnce
      })

      it('should call Plugin.addSub with channelName and wrapped handler after registering iastPluginSub', () => {
        const iastPluginSub = { channelName: 'test' }
        iastPlugin.addSub(iastPluginSub, handler)

        expect(addSubMock).to.be.calledOnce
        const args = addSubMock.getCall(0).args
        expect(args[0]).equal('test')

        const wrapped = args[1]
        expect(wrapped).to.be.a('function')
        expect(wrapped).to.not.be.equal(handler)
        expect(wrapped()).to.not.throw
        expect(logErrorMock).to.be.calledOnce
      })

      it('should infer moduleName from channelName after registering iastPluginSub', () => {
        const iastPluginSub = { channelName: 'test' }
        iastPlugin.addSub(iastPluginSub, handler)

        expect(iastPlugin.pluginSubs).to.have.lengthOf(1)
        expect(iastPlugin.pluginSubs[0].moduleName).eq('test')
      })

      it('should infer moduleName from channelName after registering iastPluginSub with real channelName', () => {
        const iastPluginSub = { channelName: 'datadog:test:start' }
        iastPlugin.addSub(iastPluginSub, handler)

        expect(iastPlugin.pluginSubs).to.have.lengthOf(1)
        expect(iastPlugin.pluginSubs[0].moduleName).eq('test')
      })

      it('should call _wrapHandler with correct metric values', () => {
        const wrapHandler = sinon.stub()
        iastPlugin._wrapHandler = wrapHandler
        iastPlugin.addSub({ channelName: 'datadog:test:start', metricTag: VULNERABILITY_TYPE }, handler)

        expect(wrapHandler).to.be.calledOnceWith(handler, getExecutedMetric(VULNERABILITY_TYPE), undefined)

        wrapHandler.reset()
        iastPlugin.addSub({ channelName: 'datadog:test:start', metricTag: SOURCE_TYPE, tag: 'test-tag' }, handler)
        expect(wrapHandler).to.be.calledOnceWith(handler, getExecutedMetric(SOURCE_TYPE), 'test-tag')
      })
    })

    describe('configure', () => {
      it('should mark Plugin configured and call only once onConfigure', () => {
        iastPlugin.onConfigure = sinon.stub()
        iastPlugin.configure(true)
        iastPlugin.configure(false)
        iastPlugin.configure(true)

        expect(iastPlugin.configured).to.be.true
        expect(iastPlugin.onConfigure).to.be.calledOnce
      })
    })
  })

  describe('with telemetry enabled', () => {
    const increaseMock = sinon.stub()
    const { IastPlugin } = proxyquire('../../../src/appsec/iast/iast-plugin', {
      '../../plugins/plugin': PluginClass,
      '../../log': {
        error: logErrorMock
      },
      './telemetry': {
        increase: increaseMock,
        isEnabled: () => true,
        isDebugEnabled: () => true
      }
    })

    beforeEach(() => {
      iastPlugin = new IastPlugin()
      increaseMock.reset()
    })

    describe('configure', () => {
      it('should subscribe dd-trace:instrumentation:load channel', () => {
        iastPlugin.onInstrumentationLoaded = sinon.stub()
        iastPlugin.configure(true)
        iastPlugin.configure(false)
        iastPlugin.configure(true)

        loadChannel.publish({ name: 'test' })

        expect(iastPlugin.onInstrumentationLoaded).to.be.calledOnceWith('test')
      })
    })

    describe('addSub', () => {
      it('should register an pluginSubscription and increment a sink metric when a sink module is loaded', () => {
        iastPlugin.addSub({
          moduleName: 'sink',
          channelName: 'datadog:sink:start',
          tag: 'injection',
          metricTag: VULNERABILITY_TYPE
        })
        iastPlugin.configure(true)

        loadChannel.publish({ name: 'sink' })

        expect(increaseMock).to.be.calledOnceWith(getInstrumentedMetric(VULNERABILITY_TYPE), 'injection')
      })

      it('should register an pluginSubscription and increment a source metric when a source module is loaded', () => {
        iastPlugin.addSub({
          moduleName: 'source',
          channelName: 'datadog:source:start',
          tag: 'http.source',
          metricTag: SOURCE_TYPE
        })
        iastPlugin.configure(true)

        loadChannel.publish({ name: 'source' })

        expect(increaseMock).to.be.calledOnceWith(getInstrumentedMetric(SOURCE_TYPE), 'http.source')
      })

      it('should wrap original handler and increment a sink metric when handler it is executed', () => {
        iastPlugin.addSub({
          moduleName: 'sink',
          channelName: 'datadog:sink:start',
          tag: 'injection',
          metricTag: VULNERABILITY_TYPE
        }, handler)
        iastPlugin.configure(true)

        const wrappedHandler = addSubMock.getCall(0).args[1]
        wrappedHandler()

        expect(increaseMock).to.be.calledOnceWith(getExecutedMetric(VULNERABILITY_TYPE), 'injection')
      })

      it('should wrap original handler and increment a source metric when handler it is executed', () => {
        iastPlugin.addSub({
          moduleName: 'source',
          channelName: 'datadog:source:start',
          tag: 'http.source',
          metricTag: SOURCE_TYPE
        }, handler)
        iastPlugin.configure(true)

        const wrappedHandler = addSubMock.getCall(0).args[1]
        wrappedHandler()

        expect(increaseMock).to.be.calledOnceWith(getExecutedMetric(SOURCE_TYPE), 'http.source')
      })
    })
  })
})
