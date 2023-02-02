#!/usr/bin/env node

const NAMESPACE = 'datadog';

// packages/datadog-instrumentations/src/helpers/hooks.js
const packages = new Set([
  'body-parser',
  'pg',
  'redis',
  'express',
  'router',
  'qs',
  '@redis/client',
  '@node-redis/client',
]);

const DC_CHANNEL = 'dd-trace:bundledModuleLoadStart';

const ddPlugin = {
  name: 'datadog-esbuild',
  setup(build) {
    build.onResolve({ filter: /.*/ }, args => {
      const package_name = args.path;
      // first call:
      /* args = {
        path: 'pg',
        importer: '/Users/thomas.hunter/Projects/esbuild-demo/app.js',
        namespace: 'file',
        resolveDir: '/Users/thomas.hunter/Projects/esbuild-demo',
        kind: 'require-call',
        pluginData: undefined
      } */
      // second call:
      /* args = {
        path: 'pg',
        importer: 'pg',
        namespace: 'datadog',
        resolveDir: '',
        kind: 'require-call',
        pluginData: undefined
      } */
      if (args.namespace === 'file' && packages.has(package_name)) {
        const pathToPackageJson = require.resolve(`${package_name}/package.json`, { paths: [ args.resolveDir ] });
        const pkg = require(pathToPackageJson);

        console.log('ONRESOLVE', package_name, pkg.version, pathToPackageJson);
        // console.log(args);

        // https://esbuild.github.io/plugins/#on-resolve-arguments
        return {
          path: package_name,
          namespace: NAMESPACE,
          pluginData: {
            version: pkg.version
          }
        };
      } else if (args.namespace === 'datadog') {
        console.log('ONRESOLVE DD', package_name);

        // @see note in onLoad
        if (package_name.startsWith('node:')) return;

        return {
          path: require.resolve(package_name, { paths: [ args.resolveDir ] }),
          namespace: 'file',
        };
      }
    })

    build.onLoad({ filter: /.*/, namespace: NAMESPACE }, args => {
      /* args = {
        path: 'pg',
        namespace: 'datadog',
        suffix: '',
        pluginData: { version: '8.8.0' }
      } */
      console.log('ONLOAD', args.path, args.pluginData.version);
      // TODO: relying on prefixing internal packages with `node:` in this intermediary module for now.
      // If this causes an issue we'll need to update the logic for determining if a module is internal.
      // Note that JSON.stringify adds double quotes for us. For perf gain we can simply add in quotes when we know it's safe.
      let contents = `
        const dc = require('node:diagnostics_channel');
        const channel = dc.channel(${JSON.stringify(DC_CHANNEL + ':' + args.path)});
        const mod = require(${JSON.stringify(args.path)});
        const payload = {
          module: mod,
          path: ${JSON.stringify(args.path)},
          version: ${JSON.stringify(args.pluginData.version)}
        };
        if (!channel.hasSubscribers) console.error('NO SUB! ${JSON.stringify(DC_CHANNEL + ':' + args.path)}');
        channel.publish(payload); // subscriber may mutate payload
        module.exports = payload.module;
        module.exports.__DATADOG_VERSION = ${JSON.stringify(args.pluginData.version)};
      `
      // https://esbuild.github.io/plugins/#on-load-results
      return {
        contents,
        loader: 'js',
      };
    })
  },
}

// TODO: Convert into plugin form
require('esbuild').build({
  entryPoints: ['app.js'],
  bundle: true,
  outfile: 'out.js',
  plugins: [ddPlugin],
  external: [
    'pg-native', // peer dep
    'graphql/language/visitor',
    'graphql/language/printer',
    'graphql/utilities',
  ],
  platform: 'node',
  target: [
    'node16',
  ],
}).catch((err) => {
  console.error(err)
  process.exit(1)
})
