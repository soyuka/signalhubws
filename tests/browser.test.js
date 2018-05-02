global.window = {}
window.WebSocket = require('websocket').w3cwebsocket
var test = require('tape')
var macro = require('./boilerplate')
var server = require('../server')()
var browserClient = require('../index')

var PORT = 9000
server.listen(PORT, () => {
  macro(test, server, browserClient, PORT)
})
