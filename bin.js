#!/usr/bin/env node

var fs = require('fs');
var argv = require('minimist')(process.argv.slice(2))

if (argv.help || argv.h) {
  console.log('signalhubws --port|-p 3300')
  process.exit(1)
}

const port = process.env.PORT || argv.port || argv.p || 3300,
      ssl = fs.existsSync('certs') ?
        {
          key_file_name: 'certs/key.pem',
          cert_file_name: 'certs/cert.pem',
          passphrase: ''
        }
        : null

var server = require('./server')(ssl)

server.listen(port, () => {
  console.log('Signalhubws running on %s', port)
})

process.on('unhandledRejection', function (err) {
  console.error('Unhandled rejection:', err.message)
})
