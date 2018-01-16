var WebSocketServer = require('uws').Server
var debug = require('debug')('signalhubws')

module.exports = function () {
  var wss

  function listen (port, cb) {
    wss = new WebSocketServer({port: port})

    wss.on('connection', function (ws) {
      var app = ws.upgradeReq.url.split('?')[0].split('#')[0].substring(1).split('/')
      ws.app = app[app.length - 1]
      ws.on('message', (data) => {
        var jsond
        try {
          jsond = JSON.parse(data)
        } catch (e) {
          console.error(e.message)
          return
        }

        debug('Got message', jsond)

        wss.clients.forEach((client) => {
          if (jsond.app === client.app) {
            debug('Broadcasting on app: %s', client.app)
            client.send(data)
          }
        })
      })
    })

    wss.on('listening', function () {
      cb()
    })
  }

  return {
    listen: listen,
    close: () => {
      wss.close()
    }
  }
}
