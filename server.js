const uWS = require('uWebSockets.js')
const debug = require('debug')('signalhubws')

module.exports = function (WebSocketClass, ssl) {
  ssl = ssl === undefined ? false : ssl

  var Server = WebSocketClass || (ssl ? uWS.SSLApp : uWS.App)
  var sockets = { server: null, clients: new Set() }

  function listen (port, cb) {
    new Server(ssl || {}).ws('/*', {
      /* Server Options */
      compression: uWS.SHARED_COMPRESSOR,
      maxPayloadLength: 16 * 1024 * 1024,
      idleTimeout: 120,

      /** WebSocket connection handler */
      upgrade (res, req, context) {
        var url = req.getUrl()
        debug('Accepting connection', url)

        // need to set `app` in ws when upgrading
        var app = url.split('?')[0].split('#')[0].split('/')
        res.upgrade({ app: app[app.length - 1], echo: true /* echo all messages */ },
          req.getHeader('sec-websocket-key'),
          req.getHeader('sec-websocket-protocol'),
          req.getHeader('sec-websocket-extensions'),
          context)
      },

      open (ws) {
        ws.subscribe(ws.app)
        sockets.clients.add(ws)
      },

      message (ws, message, isBinary) {
        try { var jsond = JSON.parse(Buffer.from(message)) } catch (e) { console.error('malformed message;', e.message); return }

        debug('Got message', jsond)

        if (ws.echo) ws.send(message)
        ws.publish(ws.app, message, isBinary)
      },

      drain: (ws) => { },
      close: (ws, code, message) => {
        debug('Connection closed (code=%s)', code)
        sockets.clients.delete(ws)
      }
    }).any('/*', (res, req) => {
      res.end('Signalhubws server')
    }).listen(port, (listenSocket) => {
      if (listenSocket) {
        sockets.server = listenSocket; cb()
      } else {
        console.error('Failed to listen to port ' + port)
      }
    })
  }

  function close (cb) {
    if (sockets.server) {
      uWS.us_listen_socket_close(sockets.server)
      sockets.server = null
    }
    sockets.clients.forEach(ws => ws.end())
    sockets.clients.clear()
    if (cb) cb()
  }

  return { listen, close }
}
