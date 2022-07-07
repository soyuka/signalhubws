#!/usr/bin/env node

var fs = require('fs')
var argv = require('minimist')(process.argv.slice(2))

if (argv.help || argv.h) {
  console.log('signalhubws --port|-p 3300')
  process.exit(1)
}

const port = parseInt(
  argv.port || argv.p || process.env.PORT || 3300)
const ssl = fs.existsSync('certs')
  ? {
      key_file_name: 'certs/key.pem',
      cert_file_name: 'certs/cert.pem',
      passphrase: ''
    }
  : null

if (!port) {
  console.error('Signalhubws: invalid port %s', port)
  process.exit(1)
}

var server = require('./server')(null, ssl)

server.listen(port, () => {
  console.log('Signalhubws running on %s', port)
})

process.on('unhandledRejection', function (err) {
  console.error('Unhandled rejection:', err.message)
})
