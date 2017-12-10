var server = require('./server')()
var argv = require('minimist')(process.argv.slice(2))

if (argv.help || argv.h) {
  console.log('signalhubws --port|-p 3300')
  process.exit(1)
}

const port = argv.port || argv.p || 3300

server.listen(port, () => {
  console.log('Signalhubws running on %s', port)
})
