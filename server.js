var WebSocketServer = require('uws').Server

function server (args, cb) {
  var wss = new WebSocketServer(args)

  wss.on('connection', function (ws) {
    ws.on('message', (data) => {
      wss.broadcast(data)
    })
  })
  cb(wss)
}

module.exports = server
