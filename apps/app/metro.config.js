const path = require('node:path');

const { withTamagui } = require('@tamagui/cli/metro');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromWorkspaceSource =
    context.originModulePath.includes(`${path.sep}packages${path.sep}`) ||
    context.originModulePath.includes(`${path.sep}apps${path.sep}app${path.sep}src${path.sep}`);
  if (fromWorkspaceSource && moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    return context.resolveRequest(context, moduleName.slice(0, -3), platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withTamagui(config, {
  components: ['tamagui'],
  config: './tamagui.config.ts',
});
