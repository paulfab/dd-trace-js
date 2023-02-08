const {
  TEST_STATUS,
  TEST_IS_RUM_ACTIVE,
  TEST_CODE_OWNERS,
  getTestEnvironmentMetadata,
  CI_APP_ORIGIN,
  getTestParentSpan,
  getCodeOwnersFileEntries,
  getCodeOwnersForFilename,
  getTestCommonTags,
  getTestSessionCommonTags,
  getTestModuleCommonTags,
  getTestSuiteCommonTags,
  TEST_SUITE_ID,
  TEST_MODULE_ID,
  TEST_SESSION_ID,
  TEST_COMMAND,
  TEST_BUNDLE
} = require('../../dd-trace/src/plugins/util/test')

const { ORIGIN_KEY, COMPONENT } = require('../../dd-trace/src/constants')

const CYPRESS_STATUS_TO_TEST_STATUS = {
  passed: 'pass',
  failed: 'fail',
  pending: 'skip',
  skipped: 'skip'
}

function getTestSpanMetadata (tracer, testName, testSuite, cypressConfig) {
  const childOf = getTestParentSpan(tracer)

  const commonTags = getTestCommonTags(testName, testSuite, cypressConfig.version)

  return {
    childOf,
    ...commonTags
  }
}

module.exports = (on, config) => {
  const tracer = require('../../dd-trace')
  const testEnvironmentMetadata = getTestEnvironmentMetadata('cypress')

  const codeOwnersEntries = getCodeOwnersFileEntries()

  let activeSpan = null
  let testSessionSpan = null
  let testModuleSpan = null
  let testSuiteSpan = null
  let command = null
  let frameworkVersion

  on('before:run', () => {
    const childOf = getTestParentSpan(tracer)

    // todo: update values
    command = 'cypress'
    frameworkVersion = '1.0.0'

    const testSessionSpanMetadata = getTestSessionCommonTags(command, frameworkVersion)
    const testModuleSpanMetadata = getTestModuleCommonTags(command, frameworkVersion)

    testSessionSpan = tracer.startSpan('cypress.test_session', {
      childOf,
      tags: {
        [COMPONENT]: 'cypress',
        ...testEnvironmentMetadata,
        ...testSessionSpanMetadata
      }
    })
    testModuleSpan = tracer.startSpan('cypress.test_module', {
      childOf: testSessionSpan,
      tags: {
        [COMPONENT]: 'cypress',
        ...testEnvironmentMetadata,
        ...testModuleSpanMetadata
      }
    })
  })

  on('after:run', () => {
    // todo: update values
    testModuleSpan.setTag(TEST_STATUS, 'pass')
    // todo: update values
    testSessionSpan.setTag(TEST_STATUS, 'pass')

    testModuleSpan.finish()
    testSessionSpan.finish()

    return new Promise(resolve => {
      tracer._tracer._exporter._writer.flush(() => resolve(null))
    })
  })
  on('task', {
    'dd:testSuiteStart': (suite) => {
      // todo: update values
      const testSuiteSpanMetadata = getTestSuiteCommonTags('cypress', '1.0.0', suite)
      testSuiteSpan = tracer.startSpan('cypress.test_suite', {
        childOf: testModuleSpan,
        tags: {
          [COMPONENT]: 'cypress',
          ...testEnvironmentMetadata,
          ...testSuiteSpanMetadata
        }
      })
      return null
    },
    'dd:testSuiteFinish': (state) => {
      testSuiteSpan.setTag(TEST_STATUS, CYPRESS_STATUS_TO_TEST_STATUS[state])
      testSuiteSpan.finish()
      return null
    },
    'dd:beforeEach': (test) => {
      const { testName, testSuite } = test

      const testSuiteTags = {}

      const testSuiteId = testSuiteSpan.context().toSpanId()
      testSuiteTags[TEST_SUITE_ID] = testSuiteId

      const testSessionId = testSessionSpan.context().toTraceId()
      testSuiteTags[TEST_SESSION_ID] = testSessionId
      testSuiteTags[TEST_COMMAND] = command

      const testModuleId = testModuleSpan.context().toSpanId()
      testSuiteTags[TEST_MODULE_ID] = testModuleId
      testSuiteTags[TEST_COMMAND] = command
      testSuiteTags[TEST_BUNDLE] = command

      const {
        childOf,
        resource,
        ...testSpanMetadata
      } = getTestSpanMetadata(tracer, testName, testSuite, config)

      const codeOwners = getCodeOwnersForFilename(testSuite, codeOwnersEntries)

      if (codeOwners) {
        testSpanMetadata[TEST_CODE_OWNERS] = codeOwners
      }

      if (!activeSpan) {
        activeSpan = tracer.startSpan('cypress.test', {
          childOf,
          tags: {
            [COMPONENT]: 'cypress',
            [ORIGIN_KEY]: CI_APP_ORIGIN,
            ...testSpanMetadata,
            ...testEnvironmentMetadata,
            ...testSuiteTags
          }
        })
      }
      return activeSpan ? activeSpan._spanContext._traceId.toString(10) : null
    },
    'dd:afterEach': (test) => {
      const { state, error, isRUMActive } = test
      if (activeSpan) {
        activeSpan.setTag(TEST_STATUS, CYPRESS_STATUS_TO_TEST_STATUS[state])
        if (error) {
          activeSpan.setTag('error', error)
        }
        if (isRUMActive) {
          activeSpan.setTag(TEST_IS_RUM_ACTIVE, 'true')
        }
        activeSpan.finish()
      }
      activeSpan = null
      return null
    },
    'dd:addTags': (tags) => {
      if (activeSpan) {
        activeSpan.addTags(tags)
      }
      return null
    }
  })
}
