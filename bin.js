var server = require('./server')
var argv = require('minimist')(process.argv.slice(2))

server({port: argv.port || 3300, path: argv.app || 'app'}, (wss) => {
  console.log('Websocket tourne sur %s (app: %s)', argv.port, argv.app)
})
