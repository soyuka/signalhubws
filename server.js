var WebSocketServer = require('ws').Server
var debug = require('debug')('signalhubws')

module.exports = function () {
  var wss
  var clients = []

  function listen (port, cb) {
    wss = new WebSocketServer({port: port})

    wss.on('connection', function (ws, req) {
      var app = req.url.split('?')[0].split('#')[0].substring(1).split('/')
      ws.app = app[app.length - 1]
      clients.push(ws)

      ws.on('message', (data) => {
        var jsond
        try {
          jsond = JSON.parse(data)
        } catch (e) {
          console.error(e.message)
          return
        }

        debug('Got message', jsond)

        clients.forEach((client) => {
          if (client.readyState === 1 && jsond.app === client.app) {
            debug('Broadcasting on app: %s', client.app)
            client.send(data)
          }
        })
      })

      ws.on('close', () => {
        const i = clients.findIndex(c => c === ws)
        clients.splice(i, 1)
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
