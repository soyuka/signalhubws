const events = require('events')
const through2 = require('through2')
const inherits = require('inherits')
const WebSocket = (typeof window !== 'undefined' && window.WebSocket) ? window.WebSocket : null

function SignalhubWs (app, urls, WebSocketClass) {
  this.opened = false
  this.sockets = []
  this.app = app
  const channels = this.channels = new Map()
  this.subscribers = {
    get length () {
      return channels.size
    }
  }

  if (!Array.isArray(urls)) {
    urls = [urls]
  }

  urls = urls.map(function (url) {
    url = url.replace(/\/$/, '')
    return url.indexOf('://') === -1 ? 'ws://' + url : url
  })

  let countOpen = 0

  for (let index = 0; index < urls.length; index++) {
    const socket = new WebSocketClass(`${urls[index]}/${app}`)

    this.sockets.push(socket)

    socket.addEventListener('open', () => {
      if (++countOpen === urls.length) {
        this.opened = true
        this.emit('open')
        for (let channel of this.channels.values()) {
          channel.emit('open')
        }
      }
    })

    socket.addEventListener('message', (message) => {
      this.onMessage(message)
    })
  }
}

inherits(SignalhubWs, events.EventEmitter)

SignalhubWs.prototype.subscribe = function (channel) {
  if (this.closed) {
    throw new Error('Cannot subscribe after close')
  }

  if (this.channels.has(channel)) {
    return this.channels.get(channel)
  }

  // use a stream for channel
  this.channels.set(channel, through2.obj())

  this.channels.get(channel).on('close', () => {
    this.channels.delete(channel)
  })

  if (this.opened) {
    process.nextTick(() => {
      if (this.channels.has(channel)) {
        this.channels.get(channel).emit('open')
      }
    })
  }

  return this.channels.get(channel)
}

SignalhubWs.prototype.broadcast = function (channel, message, cb) {
  if (this.closed) {
    throw new Error('Cannot broadcast after close')
  }

  const data = {
    app: this.app,
    channel: channel,
    message: message
  }

  this.sockets.forEach((socket) => {
    socket.send(JSON.stringify(data))
  })

  cb && cb()
}

SignalhubWs.prototype.onMessage = function (message) {
  message = JSON.parse(message.data)

  for (let key of this.channels.keys()) {
    if (message.channel === key) {
      this.channels.get(key).write(message.message)
      continue
    }

    if (!Array.isArray(key)) {
      continue
    }

    for (let i = 0; i < key.length; i++) {
      if (key[i] === message.channel) {
        this.channels.get(key).write(message.message)
      }
    }
  }
}

SignalhubWs.prototype.close = function (cb) {
  if (this.closed) {
    if (cb) process.nextTick(cb)
    return
  }

  this.once('close:socket', () => {
    this._closeChannels(cb)
  })

  const len = this.sockets.length
  if (len === 0) {
    this.emit('close')
    return
  }

  let closed = 0
  this.sockets.forEach((socket) => {
    socket.addEventListener('close', () => {
      if (++closed === len) {
        this.emit('close:socket')
      }
    })

    process.nextTick(function () {
      socket.close()
    })
  })
}

SignalhubWs.prototype._closeChannels = function (cb) {
  if (this.closed) {
    if (cb) process.nextTick(cb)
    return
  }
  this.closed = true

  if (cb) {
    this.on('close', cb)
  }

  const len = this.channels.size
  if (len === 0) {
    this.emit('close')
    return
  }

  let closed = 0
  for (let channel of this.channels.values()) {
    process.nextTick(() => {
      channel.end(() => {
        if (++closed === len) {
          this.channels.clear()
          this.emit('close')
        }
      })
    })
  }
}

module.exports = function (app, urls, WebSocketClass = WebSocket) {
  if (!WebSocketClass) {
    throw TypeError('No WebSocket class given.')
  }
  return new SignalhubWs(app, urls, WebSocketClass)
}
