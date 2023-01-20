'use strict'

const Verbosity = {
  MANDATORY: 1,
  INFORMATION: 2,
  DEBUG: 3
}

function isDebugAllowed (value) {
  return value >= Verbosity.DEBUG
}

function parseVerbosity (verbosity) {
  verbosity = verbosity.toUpperCase()
  return Verbosity[verbosity] ? Verbosity[verbosity] : Verbosity.MANDATORY
}

module.exports = {
  Verbosity,
  isDebugAllowed,
  parseVerbosity
}
