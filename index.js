'use strict';

var crypto = require('crypto')
var moment = require('moment')
var url = require('url');

/**
 * Adapted from
 * ws: a node.js websocket client
 * Copyright(c) 2011 Einar Otto Stangvik <einaros@gmail.com>
 * MIT Licensed
 *
 */

var WS = module.exports = require('ws');

WS.RelayedServer = require('./lib/HybridConnectionWebSocketServer');

/**
 * Create a new HybridConnectionsWebSocketServer.
 *
 * @param {Object} options Server options
 * @param {Function} fn Optional connection listener.
 * @returns {WS.RelayedServer}
 * @api public
 */
WS.createRelayedServer = function createRelayedServer(options, fn) {
  var server = new WS.RelayedServer(options);

  if (typeof fn === 'function') {
    server.on('connection', fn);
  }

  return server;
};

/**
 * Create a new WebSocket connection.
 *
 * @param {String} address The URL/address we need to connect to.
 * @param {String} token Optional relay access token for sending.
 * @param {Object} agent Optional Proxy Agent
 * @param {Function} fn Open listener.
 * @returns {WS}
 * @api public
 */
WS.relayedConnect = function relayedConnect(address, token, agent, fn) {
  var opt = null;
  if (token != null) {
    opt = { headers : { 'ServiceBusAuthorization' : token}};
  }
  if(agent != null && typeof agent === 'object') {
    opt.agent = agent
  }
  var client = new WS(address, null, opt);

  if (typeof fn === 'function') {
    client.on('open', function() { fn(client) });
  }
  if (typeof agent === 'function') {
    client.on('open', function() { fn(client) });
  }

  return client;
};

/**
 * Create a Relay Token
 *
 * @param {String} uri The URL/address to connect to.
 * @param {String} keyName The SharedAccessSignature key name.
 * @param {String} key The SharedAccessSignature key value.
 * @param {number} expirationSeconds Optional number of seconds until the generated token should expire.  Default is 1 hour (3600) if not specified.
 * @api public
 */
WS.createRelayToken = function createRelayToken(uri, keyName, key, expirationSeconds) {
    var parsedUrl = url.parse(uri);
    parsedUrl.protocol = 'http';
    parsedUrl.search = parsedUrl.hash = parsedUrl.port = null;
    parsedUrl.pathname = parsedUrl.pathname.replace('$hc/','');
    uri = url.format(parsedUrl);

    if (!expirationSeconds) {
      // Token expires in one hour (3600 seconds)
      expirationSeconds = 3600;
    }

    var unixSeconds = moment().add(expirationSeconds, 'seconds').unix();
    var string_to_sign = encodeURIComponent(uri) + '\n' + unixSeconds;
    var hmac = crypto.createHmac('sha256', key);
    hmac.update(string_to_sign);
    var signature = hmac.digest('base64');
    var token = 'SharedAccessSignature sr=' + encodeURIComponent(uri) + '&sig=' + encodeURIComponent(signature) + '&se=' + unixSeconds + '&skn=' + keyName;
    return token;
};

/**
 * Create a Relay Token and append it to an existing Uri
 *
 * @param {String} uri The URL/address to connect to.
 * @param {String} keyName The SharedAccessSignature key name.
 * @param {String} key The SharedAccessSignature key value.
 * @param {number} expirationSeconds Optional number of seconds until the generated token should expire.  Default is 1 hour (3600) if not specified.
 * @api public
 */
WS.appendRelayToken = function appendRelayToken(uri, keyName, key, expirationSeconds) {
   var token = WS.createRelayToken(uri, keyName, key, expirationSeconds);

    var parsedUrl = url.parse(uri);
    parsedUrl.search = parsedUrl.search + '&sb-hc-token=' + encodeURIComponent(token);
    return url.format(parsedUrl);
}

/**
 * Create a Uri for using with Relay Hybrid Connections
 *
 * @param {String} serviceBusNamespace The ServiceBus namespace, e.g. 'contoso.servicebus.windows.net'.
 * @param {String} path The endpoint path.
 * @api public
 */
WS.createRelayBaseUri = function createRelayBaseUri(serviceBusNamespace, path) {
    return 'wss://' + serviceBusNamespace + ':443/$hc/' + path;
}

/**
 * Create a Uri for sending to a Relay Hybrid Connection endpoint
 *
 * @param {String} serviceBusNamespace The ServiceBus namespace, e.g. 'contoso.servicebus.windows.net'.
 * @param {String} path The endpoint path.
 * @param {String} token Optional SharedAccessSignature token for authenticating the sender.
 * @param {String} id Optional A Guid string for end to end correlation.
 * @api public
 */
WS.createRelaySendUri = function createRelaySendUri(serviceBusNamespace, path, token, id) {
    var uri = WS.createRelayBaseUri(serviceBusNamespace, path);
    uri = uri + (uri.indexOf('?') == -1 ? '?' : '&') + 'sb-hc-action=connect';
    if (token != null) {
        uri = uri + '&sb-hc-token=' + encodeURIComponent(token);
    }
    if (id != null) {
        uri = uri + '&sb-hc-id=' + encodeURIComponent(id);
    }
    return uri;
}

/**
 * Create a Uri for listening on a Relay Hybrid Connection endpoint
 *
 * @param {String} serviceBusNamespace The ServiceBus namespace, e.g. 'contoso.servicebus.windows.net'.
 * @param {String} path The endpoint path.
 * @param {String} token Optional SharedAccessSignature token for authenticating the listener.
 * @param {String} id Optional A Guid string for end to end correlation.
 * @api public
 */
WS.createRelayListenUri = function createRelayListenUri(serviceBusNamespace, path, token, id) {
    var uri = WS.createRelayBaseUri(serviceBusNamespace, path);
    uri = uri + (uri.indexOf('?') == -1 ? '?' : '&') + 'sb-hc-action=listen';
    if (token != null) {
        uri = uri + '&sb-hc-token=' + encodeURIComponent(token);
    }
    if (id != null) {
        uri = uri + '&sb-hc-id=' + encodeURIComponent(id);
    }
    return uri;
}