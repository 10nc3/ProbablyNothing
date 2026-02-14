const contextRouter = require('./context-router');
const nyanApi = require('./nyan-api');
const memoryManager = require('./memory-manager');
const webSearch = require('./web-search');
const modeRegistry = require('./mode-registry');
const llmClient = require('./llm-client');
const envDetect = require('./env-detect');

module.exports = {
  getContext: contextRouter.getContext,
  route: contextRouter.route,

  atomicQuery: nyanApi.atomicQuery,
  getPsiEMA: nyanApi.getPsiEMA,

  memory: memoryManager,

  webSearch,

  detectMode: modeRegistry.detectMode,

  llmClient,

  detectEnvironment: envDetect.detectEnvironment,
  buildDynamicChain: envDetect.buildDynamicChain,
};
