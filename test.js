var server = require('./server')
var client = require('./index')
var tape = require('tape')
global.window = {}
window.WebSocket = require('uws')

server({port: 3002, path: 'app'}, (wss) => {
  tape('subscribe', function (t) {
    var c = client('app', [`localhost:3002`])

    c.subscribe('hello').on('data', function (message) {
      t.same(message, {hello: 'world'})
      t.end()
      c.close()
    }).on('open', function () {
      c.broadcast('hello', {hello: 'world'})
    })
  })

  tape('subscribe with trailing /', function (t) {
    var c = client('app', [`localhost:3002`])

    c.subscribe('hello').on('data', function (message) {
      t.same(message, {hello: 'world'})
      t.end()
      c.close()
    }).on('open', function () {
      c.broadcast('hello', {hello: 'world'})
    })
  })

  tape('subscribe to many', function (t) {
    var c = client('app', [`localhost:3002`])
    var msgs = ['stranger', 'friend']

    c.subscribe(['hello', 'goodbye']).on('data', function (message) {
      t.same(message, {msg: msgs.shift()})
      if (msgs.length === 0) {
        c.close(function () {
          t.equal(c.channels.size, 0, 'all subscribers closed')
          t.end()
        })
      }
    }).on('open', function () {
      c.broadcast('hello', {msg: 'stranger'}, function () {
        c.broadcast('goodbye', {msg: 'friend'})
      })
    })
  })

  tape('close multiple', function (t) {
    var c = client('app', [`localhost:3002`])
    c.on('open', () => {
      c.subscribe(['hello', 'goodbye'])
      c.subscribe(['hi', 'bye'])
      c.close(function () {
        t.equal(c.channels.size, 0, 'all subscribers closed')
        t.end()
      })
    })
  })

  tape('subscribe to channels with slash in the name', function (t) {
    var c = client('app', [`localhost:3002`])

    c.subscribe('hello/people').on('data', function (message) {
      t.same(message, [1, 2, 3])
      t.end()
      c.close()
    }).on('open', function () {
      c.broadcast('hello/people', [1, 2, 3])
    })
  })

  tape('open emitted with multiple hubs', function (t) {
    var c = client('app', [`localhost:3002`, `localhost:3002`])

    c.subscribe('hello').on('open', function () {
      t.ok(true, 'got an open event')
      c.close()
      t.end()
    })
  })

  tape('end', function (t) {
    wss.close()
    t.ok(true)
    t.end()
  })
})
