'use strict'

const dc = require('diagnostics_channel')

// TODO: RITM and IITM refer to a dd-trace:moduleLoadStart channel.
// Can we reuse that? Or would it lead to doubley instrumenting a module?
const CHANNEL = 'dd-trace:bundledModuleLoadStart'

class DiagnosticsChannelInTheMiddle {

  // This runs many times, once for the name of each supported module
  // For that reason it will listen on module-specific channels.
  prep(modules, options, onrequire) {
    this.modules = modules
    this.options = options
    this.onrequire = onrequire
    console.log('PREP', modules);
    for (let module of modules) {
      console.log('SUBSCRIBE', `${CHANNEL}:${module}`)
      dc.subscribe(`${CHANNEL}:${module}`, this._onModuleLoad.bind(this)) // TODO: shouldn't need a .bind
    }
    return this
  }

  unhook() {
    for (let module of this.modules) {
      dc.unsubscribe(`${CHANNEL}:${module}`, this._onModuleLoad.bind(this)) // TODO: .bind breaks this
    }
  }

  /**
   * @param {string} arg.module name of the module
   * @param {string} arg.path path to the module
   * @param {string} [arg.version] version of the module
   */
  _onModuleLoad(payload) {
    console.log(`onModuleLoad(${payload.path}@${payload.version})`);
    // TODO: this returns the same module that was passed in
    payload.module = this.onrequire(payload.module, payload.path, undefined); // TODO: moduleBaseDir
  }
};

module.exports = new DiagnosticsChannelInTheMiddle();