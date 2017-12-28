'use strict';

const fs = require('fs');
const rc = require('rc');

////////////////////////////////////////////////////////////
// Load and parse Config

const defaults = {
  port: 53,
  host: '127.0.0.1',
  logging: 'dnsproxy:query,dnsproxy:info',

  // Default nameservers
  nameservers: [
    '8.8.8.8',
    '8.8.4.4'
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
  api: {
    enabled: true,
    host: '127.0.0.1',
    port: 5959,
    key: 'dns-proxy-t7w!184$A6*55WI'
  }
};

let config = rc('dnsproxy', defaults);

process.env.DEBUG_FD = process.env.DEBUG_FD || 1;
process.env.DEBUG = process.env.DEBUG || config.logging;
const d = process.env.DEBUG.split(',');
d.push('dnsproxy:error');
process.env.DEBUG = d.join(',');

const loginfo = require('debug')('dnsproxy:info');
const logdebug = require('debug')('dnsproxy:debug');
const logquery = require('debug')('dnsproxy:query');
const logerror = require('debug')('dnsproxy:error');

if (config.reload_config === true) {
  const configFile = config.config;
  fs.watchFile(configFile, function () {
    loginfo('config file changed, reloading config options');
    try {
      config = rc('dnsproxy', defaults);
    } catch (e) {
      logerror('error reloading configuration');
      logerror(e);
    }
  });
}

logdebug('options: %j', config);

////////////////////////////////////////////////////////////
// Create and boot the DNS Server

const dgram = require('dgram');
const packet = require('native-dns-packet');
const util = require('./util.js');

const dnsServer = dgram.createSocket('udp4');

dnsServer.on('listening', function () {
  console.log('dns-proxy DNS Server listening at dns://%s:%s', config.host, config.port);
});

dnsServer.on('error', function (err) {
  logerror('udp socket error');
  logerror(err);
});

dnsServer.on('message', function (message, rinfo) {
  let nameserver = config.nameservers[0];

  const query = packet.parse(message);
  const domain = query.question[0].name;
  const type = query.question[0].type;

  logdebug('query: %j', query);

  for (const host in config.hosts) {
    const hostPattern = util.toRegularExpression(host);
    if (hostPattern.test(domain)) {
      let answer = config.hosts[host];
      if (typeof config.hosts[config.hosts[host]] !== 'undefined') {
        answer = config.hosts[config.hosts[host]];
      }

      logquery('type: host, domain: %s, answer: %s, source: %s:%s, size: %d', domain, config.hosts[host], rinfo.address, rinfo.port, rinfo.size);

      const res = util.createAnswer(query, answer);
      dnsServer.send(res, 0, res.length, rinfo.port, rinfo.address);

      return;
    }
  }

  for (const suffix in config.domains) {
    if (domain.endsWith(suffix)) {
      let answer = config.domains[suffix];
      if (typeof config.domains[config.domains[suffix]] !== 'undefined') {
        answer = config.domains[config.domains[suffix]];
      }

      logquery('type: server, domain: %s, answer: %s, source: %s:%s, size: %d', domain, config.domains[suffix], rinfo.address, rinfo.port, rinfo.size);

      const res = util.createAnswer(query, answer);
      dnsServer.send(res, 0, res.length, rinfo.port, rinfo.address);

      return;
    }
  }

  for (const server in config.servers) {
    if (domain.endsWith(server)) {
      nameserver = config.servers[server];
    }
  }

  const nameParts = nameserver.split(':');
  nameserver = nameParts[0];
  const port = nameParts[1] || 53;

  util.queryNameserver(config, message, nameserver, port, function(error, response) {
    if (error) {
      logerror('Socket Error: %s', error);
    } else {
      logquery('type: primary, nameserver: %s, query: %s, type: %s, answer: %s, source: %s:%s, size: %d', nameserver, domain, util.records[type] || 'unknown', util.listAnswer(response), rinfo.address, rinfo.port, rinfo.size);
      dnsServer.send(response, 0, response.length, rinfo.port, rinfo.address);
    }
  });
});

dnsServer.bind(config.port, config.host);

////////////////////////////////////////////////////////////
// Create and boot the API Server

if (config.api && config.api.enabled) {

  const restify = require('restify');
  const apiErrors = require('restify-errors');

  const apiServer = restify.createServer({
    name: 'dns-proxy API Server'
  });

  apiServer.use(restify.pre.sanitizePath());
  apiServer.use(restify.plugins.dateParser());
  apiServer.use(restify.plugins.queryParser());
  apiServer.use(restify.plugins.bodyParser());
  apiServer.use(restify.plugins.authorizationParser());

  function validateApiKey(req, res, next) {
    if (config.api.key) {
      if (req.authorization) {
        if (req.authorization.scheme === 'Basic') {
          req.authorization.apiKey = req.authorization.basic.username;
        } else if (req.authorization.scheme === 'Bearer') {
          req.authorization.apiKey = req.authorization.credentials;
        }
        if (req.authorization.apiKey === config.api.key) {
          return next();
        }
      }
      return next(new apiErrors.UnauthorizedError());
    } else {
      return next();
    }
  }

  apiServer.get('/api/nameservers', function(req, res, next) {
    res.send(200, config.nameservers);
    next();
  });

  apiServer.post('/api/nameservers', validateApiKey, function(req, res, next) {
    if (req.body) {
      if (Array.isArray(req.body)) {
        config.nameservers.push(...req.body);
        res.send(200, config.nameservers);
        return next();
      } else if (typeof req.body === 'string') {
        config.nameservers.unshift(req.body);
        res.send(200, config.nameservers);
        return next();
      }
    }
    return next(new apiErrors.BadRequestError());
  });

  apiServer.put('/api/nameservers', validateApiKey, function(req, res, next) {
    if (req.body) {
      if (Array.isArray(req.body)) {
        config.nameservers = req.body;
        res.send(200, config.nameservers);
        return next();
      } else if (typeof req.body === 'string') {
        config.nameservers = [ req.body ];
        res.send(200, config.nameservers);
        next();
      }
    }
    return next(new apiErrors.BadRequestError());
  });

  apiServer.del('/api/nameservers/:address', validateApiKey, function(req, res, next) {
    if (config.nameservers.includes(req.params.address)) {
      config.nameservers = config.nameservers.filter(address => address !== req.params.address);
      res.send(200, config.nameservers);
      return next();
    }
    return next(new apiErrors.NotFoundError());
  });

  apiServer.get('/api/servers', function(req, res, next) {
    res.send(200, config.servers);
    next();
  });

  apiServer.post('/api/servers', validateApiKey, function(req, res, next) {
    if (req.body && typeof req.body === 'object') {
      Object.assign(config.servers, req.body);
      res.send(200, config.servers);
      return next();
    }
    return next(new apiErrors.BadRequestError());
  });

  apiServer.put('/api/servers', validateApiKey, function(req, res, next) {
    if (req.body && typeof req.body === 'object') {
      config.servers = req.body;
      res.send(200, config.servers);
      return next();
    }
    return next(new apiErrors.BadRequestError());
  });

  apiServer.del('/api/servers/:server', validateApiKey, function(req, res, next) {
    if (config.servers[req.params.server]) {
      delete config.servers[req.params.server];
      res.send(200, config.servers);
      return next();
    }
    return next(new apiErrors.NotFoundError());
  });

  apiServer.get('/api/domains', function(req, res, next) {
    res.send(200, config.domains);
    next();
  });

  apiServer.post('/api/domains', validateApiKey, function(req, res, next) {
    if (req.body && typeof req.body === 'object') {
      Object.assign(config.domains, req.body);
      res.send(200, config.domains);
      return next();
    }
    return next(new apiErrors.BadRequestError());
  });

  apiServer.post('/api/domains', validateApiKey, function(req, res, next) {
    if (req.body && typeof req.body === 'object') {
      config.domains = req.body;
      res.send(200, config.domains);
      return next();
    }
    return next(new apiErrors.BadRequestError());
  });

  apiServer.del('/api/domains/:domain', validateApiKey, function(req, res, next) {
    if (config.domains[req.params.domain]) {
      delete config.domains[req.params.domain];
      res.send(200, config.domains);
      return next();
    }
    return next(new apiErrors.NotFoundError());
  });

  apiServer.get('/api/hosts', function(req, res, next) {
    res.send(200, config.hosts);
    next();
  });

  apiServer.post('/api/hosts', validateApiKey, function(req, res, next) {
    if (req.body && typeof req.body === 'object') {
      Object.assign(config.hosts, req.body);
      res.send(200, config.hosts);
      return next();
    }
    return next(new apiErrors.BadRequestError());
  });

  apiServer.post('/api/hosts', validateApiKey, function(req, res, next) {
    if (req.body && typeof req.body === 'object') {
      config.hosts = req.body;
      res.send(200, config.hosts);
      return next();
    }
    return next(new apiErrors.BadRequestError());
  });

  apiServer.del('/api/hosts/:host', validateApiKey, function(req, res, next) {
    if (config.hosts[req.params.host]) {
      delete config.hosts[req.params.host];
      res.send(200, config.hosts);
      return next();
    }
    return next(new apiErrors.NotFoundError());
  });

  apiServer.listen(config.api.port, config.api.host, function () {
    console.log('%s listening at %s', apiServer.name, apiServer.url);
  });
}
