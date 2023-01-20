'use strict'

const { expect } = require('chai')
const proxyquire = require('proxyquire')
const { VULNERABILITY_TYPE, SOURCE_TYPE } = require('../../../src/appsec/iast/telemetry/metric-tag')
const { getExecutedMetric } = require('../../../src/appsec/iast/telemetry/metrics')

describe('IAST Plugin', () => {
  describe('addSub', () => {
    const addSubMock = sinon.stub()
    class PluginClass {
      addSub (channelName, handler) {
        addSubMock(channelName, handler)
      }
    }

    const logErrorMock = sinon.stub()
    const { IastPlugin } = proxyquire('../../../src/appsec/iast/iast-plugin', {
      '../../plugins/plugin': PluginClass,
      '../../log': {
        error: logErrorMock
      }
    })
    const handler = () => {
      throw new Error('handler error')
    }

    let iastPlugin

    beforeEach(() => {
      iastPlugin = new IastPlugin()
      addSubMock.reset()
      logErrorMock.reset()
    })

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
})
