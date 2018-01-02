'use strict';

const restify = require('restify');
const apiErrors = require('restify-errors');

module.exports = function(config) {
  ////////////////////////////////////////////////////////////
  // Create and boot the API Server (if enabled)

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

  apiServer.get('/api/v1/nameservers', function(req, res, next) {
    res.send(200, config.nameservers);
    next();
  });

  apiServer.post('/api/v1/nameservers', validateApiKey, function(req, res, next) {
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

  apiServer.put('/api/v1/nameservers', validateApiKey, function(req, res, next) {
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

  apiServer.del('/api/v1/nameservers/:address', validateApiKey, function(req, res, next) {
    if (config.nameservers.includes(req.params.address)) {
      config.nameservers = config.nameservers.filter(address => address !== req.params.address);
      res.send(200, config.nameservers);
      return next();
    }
    return next(new apiErrors.NotFoundError());
  });

  apiServer.get('/api/v1/servers', function(req, res, next) {
    res.send(200, config.servers);
    next();
  });

  apiServer.post('/api/v1/servers', validateApiKey, function(req, res, next) {
    if (req.body && typeof req.body === 'object') {
      Object.assign(config.servers, req.body);
      res.send(200, config.servers);
      return next();
    }
    return next(new apiErrors.BadRequestError());
  });

  apiServer.put('/api/v1/servers', validateApiKey, function(req, res, next) {
    if (req.body && typeof req.body === 'object') {
      config.servers = req.body;
      res.send(200, config.servers);
      return next();
    }
    return next(new apiErrors.BadRequestError());
  });

  apiServer.del('/api/v1/servers/:server', validateApiKey, function(req, res, next) {
    if (config.servers[req.params.server]) {
      delete config.servers[req.params.server];
      res.send(200, config.servers);
      return next();
    }
    return next(new apiErrors.NotFoundError());
  });

  apiServer.get('/api/v1/domains', function(req, res, next) {
    res.send(200, config.domains);
    next();
  });

  apiServer.post('/api/v1/domains', validateApiKey, function(req, res, next) {
    if (req.body && typeof req.body === 'object') {
      Object.assign(config.domains, req.body);
      res.send(200, config.domains);
      return next();
    }
    return next(new apiErrors.BadRequestError());
  });

  apiServer.post('/api/v1/domains', validateApiKey, function(req, res, next) {
    if (req.body && typeof req.body === 'object') {
      config.domains = req.body;
      res.send(200, config.domains);
      return next();
    }
    return next(new apiErrors.BadRequestError());
  });

  apiServer.del('/api/v1/domains/:domain', validateApiKey, function(req, res, next) {
    if (config.domains[req.params.domain]) {
      delete config.domains[req.params.domain];
      res.send(200, config.domains);
      return next();
    }
    return next(new apiErrors.NotFoundError());
  });

  apiServer.get('/api/v1/hosts', function(req, res, next) {
    res.send(200, config.hosts);
    next();
  });

  apiServer.post('/api/v1/hosts', validateApiKey, function(req, res, next) {
    if (req.body && typeof req.body === 'object') {
      Object.assign(config.hosts, req.body);
      res.send(200, config.hosts);
      return next();
    }
    return next(new apiErrors.BadRequestError());
  });

  apiServer.post('/api/v1/hosts', validateApiKey, function(req, res, next) {
    if (req.body && typeof req.body === 'object') {
      config.hosts = req.body;
      res.send(200, config.hosts);
      return next();
    }
    return next(new apiErrors.BadRequestError());
  });

  apiServer.del('/api/v1/hosts/:host', validateApiKey, function(req, res, next) {
    if (config.hosts[req.params.host]) {
      delete config.hosts[req.params.host];
      res.send(200, config.hosts);
      return next();
    }
    return next(new apiErrors.NotFoundError());
  });

  apiServer.get('/api/v1/config', function(req, res, next) {
    res.send(200, config);
    return next();
  });

  apiServer.post('/api/v1/config/save', validateApiKey, function(req, res, next) {
    res.send(200, config);
    return next();
  });

  apiServer.listen(config.api.port, config.api.host, function () {
    console.log('%s listening at %s', apiServer.name, apiServer.url);
  });
};
