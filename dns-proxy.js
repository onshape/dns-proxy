'use strict';

const dgram = require('dgram');
const packet = require('native-dns-packet');
const util = require('./util.js');

module.exports = function(config, logger) {
  ////////////////////////////////////////////////////////////
  // Create and boot the DNS Server

  const dnsServer = dgram.createSocket('udp4');

  dnsServer.on('listening', function () {
    console.log('dns-proxy DNS Server listening at dns://%s:%s', config.host, config.port);
  });

  dnsServer.on('error', function (err) {
    logger.error('udp socket error');
    logger.error(err);
  });

  dnsServer.on('message', function (message, rinfo) {
    let nameserver = config.nameservers[0];

    const query = packet.parse(message);
    const domain = query.question[0].name;
    const type = query.question[0].type;

    logger.debug('query: %j', query);

    for (const host in config.hosts) {
      const hostPattern = util.toRegularExpression(host);
      if (hostPattern.test(domain)) {
        let answer = config.hosts[host];
        if (typeof config.hosts[config.hosts[host]] !== 'undefined') {
          answer = config.hosts[config.hosts[host]];
        }

        logger.query('type: host, domain: %s, answer: %s, source: %s:%s, size: %d', domain, config.hosts[host], rinfo.address, rinfo.port, rinfo.size);

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

        logger.query('type: server, domain: %s, answer: %s, source: %s:%s, size: %d', domain, config.domains[suffix], rinfo.address, rinfo.port, rinfo.size);

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
        logger.error('Socket Error: %s', error);
      } else {
        logger.query('type: primary, nameserver: %s, query: %s, type: %s, answer: %s, source: %s:%s, size: %d', nameserver, domain, util.records[type] || 'unknown', util.listAnswer(response), rinfo.address, rinfo.port, rinfo.size);
        dnsServer.send(response, 0, response.length, rinfo.port, rinfo.address);
      }
    });
  });

  dnsServer.bind(config.port, config.host);
};
