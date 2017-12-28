'use strict';

const dgram = require('dgram');
const packet = require('native-dns-packet');

const records = {
  '1': 'A',
  '2': 'NS',
  '5': 'CNAME',
  '6': 'SOA',
  '12': 'PTR',
  '15': 'MX',
  '16': 'TXT',
  '28': 'AAAA'
};

const regExpPattern = /^\/(.*?)\/([gim]*)$/;
const escapePattern = /[|\\{}()[\]^$+*?.]/g;

function toRegularExpression(string) {
  const parts = string.match(regExpPattern);
  if (parts) {
    return new RegExp(parts[1], parts[2]);
  }
  return new RegExp('^' + string.replace(escapePattern, '\\$&') + '$');
}

function listAnswer(response) {
  const results = [];
  const res = packet.parse(response);
  res.answer.map(function (r) {
    results.push(r.address || r.data);
  });
  return results.join(', ') || 'nxdomain';
};

function createAnswer(query, answer) {
  query.header.qr = 1;
  query.header.rd = 1;
  query.header.ra = 1;
  query.answer.push({
    name: query.question[0].name,
    type: 1,
    class: 1,
    ttl: 30,
    address: answer
  });

  const buf = Buffer.alloc(4096);
  const wrt = packet.write(buf, query);
  const res = buf.slice(0, wrt);

  return res;
};

function queryNameserver(config, message, nameserver, port, callback) {
  const sock = dgram.createSocket('udp4');

  let fallback;

  sock.send(message, 0, message.length, port, nameserver, function () {
    fallback = setTimeout(function () {
      queryNameserver(message, config.nameservers[0]);
    }, config.fallback_timeout);
  });

  sock.on('error', function (error) {
    clearTimeout(fallback);
    callback(error);
  });

  sock.on('message', function (response) {
    clearTimeout(fallback);
    sock.close();
    callback(null, response);
  });
}

module.exports = {
  createAnswer: createAnswer,
  listAnswer: listAnswer,
  queryNameserver: queryNameserver,
  toRegularExpression: toRegularExpression,
  records: records
};
