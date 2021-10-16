const uWS = require('uWebSockets.js')
const debug = require('debug')('signalhubws')

module.exports = function (ssl, ServerClass) {
  var app
  var Server = ServerClass || (ssl ? uWS.SSLApp : uWS.App)

  function listen (port, cb) {
    app = new Server(ssl || {}).ws('/*', {
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
        res.upgrade({ app: app[app.length - 1] },
          req.getHeader('sec-websocket-key'),
          req.getHeader('sec-websocket-protocol'),
          req.getHeader('sec-websocket-extensions'),
          context)
      },

      open (ws) {
        ws.subscribe(ws.app)
      },

      message (ws, message, isBinary) {
        try { var jsond = JSON.parse(Buffer.from(message)) } catch (e) { console.error('malformed message;', e.message); return }

        debug('Got message', jsond)

        ws.publish(ws.app, message, isBinary)
      },

      drain: (ws) => { },
      close: (ws, code, message) => { }
    }).any('/*', (res, req) => {
      res.end('Signalhubws server')
    }).listen(port, (token) => {
      if (token) cb()
      else { console.error('Failed to listen to port ' + port) }
    })
  }

  return { listen, close: (cb) => app.close(cb) }
}
