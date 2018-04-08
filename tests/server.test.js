var test = require('tape')
var macro = require('./boilerplate')
var server = require('../server')()
var browserClient = require('../index')
var serverClient = (app, urls) => browserClient(app, urls, require('websocket').w3cwebsocket)

var PORT = 9001
server.listen(PORT, () => {
  macro(test, server, serverClient, PORT)
})
