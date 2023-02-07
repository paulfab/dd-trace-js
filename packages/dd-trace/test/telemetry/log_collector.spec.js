const { expect } = require('chai')
const { calculateDDBasePath } = require('../../src/util')

const ddBasePath = calculateDDBasePath(__dirname)
const EOL = '\n'

describe('telemetry log collector', () => {
  const logCollector = require('../../src/telemetry/log_collector')

  afterEach(() => {
    logCollector.reset(3)
  })

  describe('add', () => {
    it('should not store logs with same hash', () => {
      expect(logCollector.add('Error', 'ERROR')).to.be.true
      expect(logCollector.add('Error', 'ERROR')).to.be.false
      expect(logCollector.add('Error', 'ERROR')).to.be.false
    })

    it('should store logs with different message', () => {
      expect(logCollector.add('Error 1', 'ERROR')).to.be.true
      expect(logCollector.add('Error 2', 'ERROR')).to.be.true
      expect(logCollector.add('Warn 1', 'WARN')).to.be.true
    })

    it('should store logs with same message but different stack', () => {
      const ddFrame = `at T (${ddBasePath}/packages/dd-trace/test/telemetry/log_collector.spec.js:29:21)`
      expect(logCollector.add('Error 1', 'ERROR', `stack 1\n${ddFrame}`)).to.be.true
      expect(logCollector.add('Error 1', 'ERROR', `stack 2\n${ddFrame}`)).to.be.true
      expect(logCollector.add('Error 1', 'ERROR', `stack 3\n${ddFrame}`)).to.be.true
    })

    it('should store logs with same message, same stack but different level', () => {
      const ddFrame = `at T (${ddBasePath}/packages/dd-trace/test/telemetry/log_collector.spec.js:29:21)`
      expect(logCollector.add('Error 1', 'ERROR', `stack 1\n${ddFrame}`)).to.be.true
      expect(logCollector.add('Error 1', 'WARN', `stack 1\n${ddFrame}`)).to.be.true
      expect(logCollector.add('Error 1', 'DEBUG', `stack 1\n${ddFrame}`)).to.be.true
    })

    it('should include original message and dd frames', () => {
      const ddFrame = `at T (${ddBasePath}/packages/dd-trace/test/telemetry/log_collector.spec.js:29:21)`
      const stack = new Error('Error 1')
        .stack.replace(`Error 1${EOL}`, `Error 1${EOL}${ddFrame}${EOL}`)
      logCollector.add('Error 1', 'ERROR', stack)

      const log = logCollector.drain()[0]
      expect(log.message).equal('Error 1')
      expect(log.stack_trace).to.not.be.undefined

      log.stack_trace.split(EOL).forEach((frame, index) => {
        if (index === 0) return
        expect(frame).to.contain(ddBasePath)
      })
    })

    it('should not include original message if first frame is not a dd frame', () => {
      const thirdPartyFrame = `at callFn (/this/is/not/a/dd/frame/runnable.js:366:21)
        at T (${ddBasePath}/packages/dd-trace/test/telemetry/log_collector.spec.js:29:21)`
      const stack = new Error('Error 1')
        .stack.replace(`Error 1${EOL}`, `Error 1${EOL}${thirdPartyFrame}${EOL}`)

      logCollector.add('Error 1', 'ERROR', stack)
      const log = logCollector.drain()[0]
      expect(log.message).equal('omitted')
      expect(log.stack_trace).to.not.be.undefined

      log.stack_trace.split(EOL).forEach((frame, index) => {
        if (index === 0) return
        expect(frame).to.contain(ddBasePath)
      })
    })
  })

  describe('drain', () => {
    it('should empty stored logs', () => {
      logCollector.add('Error 1', 'ERROR')
      logCollector.add('Error 2', 'ERROR')

      expect(logCollector.drain().length).to.be.equal(2)
      expect(logCollector.drain()).to.be.undefined
    })

    it('should add an error log when max size is reached', () => {
      logCollector.add('Error 1', 'ERROR')
      logCollector.add('Error 2', 'ERROR')
      logCollector.add('Warn 1', 'WARN')
      logCollector.add('Error 4', 'ERROR')
      logCollector.add('Error 5', 'ERROR')

      const logs = logCollector.drain()
      expect(logs.length).to.be.equal(4)
      expect(logs[3]).to.deep.eq({ message: 'Omitted 2 entries due to overflowing', level: 'ERROR', tags: undefined })
    })
  })
})
