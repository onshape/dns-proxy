#!/usr/bin/env node
'use strict';

const fs = require('fs');
const rc = require('rc');

////////////////////////////////////////////////////////////
// Load and parse Config

const defaults = {
  port: 53,
  host: '0.0.0.0',
  logging: 'dnsproxy:query,dnsproxy:info',

  // Default nameservers
  nameservers: [
    '10.80.16.143',
    '10.80.16.142',
    '10.152.224.74'
  ],
  // Domain specific nameservers
  servers: {},
  // Domain specific answers
  domains: {
    'dev': '127.0.0.1'
  },
  // Host specific answers (alias)
  hosts: {
    'devlocal': '127.0.0.1'
  },
  fallback_timeout: 350,
  reload_config: true,
  // API Server config
  api: {
    enabled: true,
    host: '0.0.0.0',
    port: 5959,
    key: 'dns-proxy-t7w!184$A6*55WI'
  }
};

const config = rc('dnsproxy', defaults);

process.env.DEBUG_FD = process.env.DEBUG_FD || 1;
process.env.DEBUG = process.env.DEBUG || config.logging;
const d = process.env.DEBUG.split(',');
d.push('dnsproxy:error');
process.env.DEBUG = d.join(',');

const logger = {
  info: require('debug')('dnsproxy:info'),
  debug: require('debug')('dnsproxy:debug'),
  query: require('debug')('dnsproxy:query'),
  error: require('debug')('dnsproxy:error')
};

if (config.reload_config === true) {
  const configFile = config.config;
  fs.watchFile(configFile, function () {
    logger.info('config file changed, reloading config options');
    try {
      Object.assign(config, rc('dnsproxy', defaults));
    } catch (error) {
      logger.error('error reloading configuration');
      logger.error(error);
    }
  });
}

logger.debug('options: %j', config);

require('./dns-proxy')(config, logger);
if (config.api && config.api.enabled) {
  require('./api-server')(config, logger);
}
