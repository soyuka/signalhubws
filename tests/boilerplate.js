/**
 * This is pretty much a copy/paste from
 * https://github.com/mafintosh/signalhub/blob/master/test.js
 */
module.exports = function (test, server, client, port) {
  test('subscribe', function (t) {
    var c = client('app', [`localhost:${port}`])

    c.subscribe('hello').on('data', function (message) {
      t.same(message, { hello: 'world' })
      t.end()
      c.close()
    }).on('open', function () {
      c.broadcast('hello', { hello: 'world' })
    })
  })

  test('subscribe two apps', function (t) {
    t.plan(2)

    var missing = 2
    var c1 = client('app1', [`localhost:${port}`])

    c1.subscribe('hello').on('data', function (message) {
      t.same(message, { hello: 'world' })
      done()
    }).on('open', function () {
      c1.broadcast('hello', { hello: 'world' })
    })

    var c2 = client('app2', [`localhost:${port}`])

    c2.subscribe('hello').on('data', function (message) {
      t.same(message, { hello: 'world' })
      done()
    }).on('open', function () {
      c2.broadcast('hello', { hello: 'world' })
    })

    function done () {
      if (--missing) return
      setTimeout(function () {
        c1.close()
        c2.close()
        t.end()
      }, 100)
    }
  })

  test('subscribe with trailing /', function (t) {
    var c = client('app', [`localhost:${port}/`])

    c.subscribe('hello').on('data', function (message) {
      t.same(message, { hello: 'world' })
      t.end()
      c.close()
    }).on('open', function () {
      c.broadcast('hello', { hello: 'world' })
    })
  })

  test('subscribe to many', function (t) {
    var c = client('app', [`localhost:${port}`])
    var msgs = ['stranger', 'friend']

    c.subscribe(['hello', 'goodbye']).on('data', function (message) {
      t.same(message, { msg: msgs.shift() })
      if (msgs.length === 0) {
        c.close(function () {
          t.equal(c.subscribers.length, 0, 'all subscribers closed')
          t.end()
        })
      }
    }).on('open', function () {
      c.broadcast('hello', { msg: 'stranger' }, function () {
        c.broadcast('goodbye', { msg: 'friend' })
      })
    })
  })

  test('close multiple', function (t) {
    var c = client('app', [`localhost:${port}`])

    c.subscribe(['hello', 'goodbye'])
    c.subscribe(['hi', 'bye'])
    c.close(function () {
      t.equal(c.subscribers.length, 0, 'all subscribers closed')
      t.end()
    })
  })

  test('subscribe to channels with slash in the name', function (t) {
    var c = client('app', [`localhost:${port}`])

    c.subscribe('hello/people').on('data', function (message) {
      t.same(message, [1, 2, 3])
      t.end()
      c.close()
    }).on('open', function () {
      c.broadcast('hello/people', [1, 2, 3])
    })
  })

  test('open emitted with multiple hubs', function (t) {
    var c = client('app', [
      `localhost:${port}`,
      `localhost:${port}`
    ])
    c.subscribe('hello').on('open', function () {
      t.ok(true, 'got an open event')
      c.close()
      t.end()
    })
  })

  test('subscribe to channels with slash in the url', function (t) {
    var c = client('app', [`localhost:${port}/foo`])

    c.subscribe('hello/bar').on('data', function (message) {
      t.same(message, [1, 2, 3])
      t.end()
      c.close()
    }).on('open', function () {
      c.broadcast('hello/bar', [1, 2, 3])
    })
  })

  test('end', function (t) {
    server.close()
    t.ok(true)
    t.end()
  })
}
