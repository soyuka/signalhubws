var WebSocketServer = require('uws').Server

module.exports = function () {
  var wss

  function listen (port, cb) {
    wss = new WebSocketServer({port: port})

    wss.on('connection', function (ws) {
      ws.app = ws.upgradeReq.url.split('?')[0].split('#')[0].substring(1)
      ws.on('message', (data) => {
        const jsond = JSON.parse(data)
        wss.clients.forEach((client) => {
          if (jsond.app === client.app) {
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
