const { EventEmitter } = require('events')
const through2 = require('through2')

let WebSocket
if (typeof window !== 'undefined' && window.WebSocket) {
  WebSocket = window.WebSocket
} else {
  WebSocket = global.WebSocket = require('ws')
}

let Sockette = require('sockette')
if (Sockette.default) {
  Sockette = Sockette.default
}

const noop = () => {}

class SignalhubWs extends EventEmitter {
  constructor (app, urls, opts = {}) {
    super()

    this.sockets = []

    this.app = app

    const channels = this.channels = new Map()

    this._ready = false

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

    for (let url of urls) {
      const id = `${url}/${app}`

      const socket = new Sockette(id, Object.assign({},
        opts.sockette || {},
        {
          onopen: e => {
            this._onOpen(e, socket)
          },
          onmessage: e => {
            this._onMessage(e, socket)
          },
          onclose: e => {
            this._onClose(e, socket)
          },
          onerror: e => {
            this._onError(e, socket)
          },
          onreconnect: () => {
            console.log(`Reconnecting to: ${id}`)
          }
        }
      ))

      socket.id = id

      this.sockets.push(socket)
    }

    let ready = this.sockets.length
    this.on('socket:ready', socket => {
      ready--
      if (ready === 0) {
        this._ready = true
        this.emit('ready')
      }
    })
  }

  get opened () {
    if (!this._ready) {
      return false
    }

    return !!this.sockets.find(socket => socket.ws.readyState === WebSocket.OPEN)
  }

  get closed () {
    if (!this._ready) {
      return false
    }

    return this.sockets.filter(socket => socket.ws.readyState === WebSocket.CLOSED).length === this.sockets.length
  }

  ready (cb) {
    if (this._ready) {
      return process.nextTick(cb)
    }

    this.once('ready', cb)
  }

  subscribe (channel) {
    if (this.channels.has(channel)) {
      return this.channels.get(channel)
    }

    // use a stream for channel
    const stream = through2.obj(
      (chunk, enc, cb) => cb(null, chunk),
      (cb) => {
        this.channels.delete(channel)
        this.emit('channel:close', channel)
        cb()
      }
    )

    this.channels.set(channel, stream)

    if (this.opened) {
      process.nextTick(() => {
        if (this.channels.has(channel)) {
          this._openChannel(this.channels.get(channel))
        }
      })
    }

    return this.channels.get(channel)
  }

  broadcast (channel, message, cb) {
    this.ready(() => {
      const data = {
        app: this.app,
        channel: channel,
        message: message
      }

      this.sockets.forEach(socket => {
        this._send(socket, JSON.stringify(data))
      })

      cb && cb()
    })
  }

  close (cb = noop) {
    const _close = () => {
      this.emit('close')
      cb()
    }

    this.ready(() => {
      if (this.closed) {
        this._closeChannels(_close)
        return
      }

      const onSocketClose = () => {
        if (this.closed) {
          this.removeListener('socket:close', onSocketClose)
          this._closeChannels(_close)
        }
      }
      this.on('socket:close', onSocketClose)

      this.sockets.forEach(socket => {
        process.nextTick(() => socket.close())
      })
    })
  }

  _onOpen (event, socket) {
    this._checkInitializeWs(event, socket)
    this.emit('socket:open', socket)
    for (let channel of this.channels.values()) {
      this._openChannel(channel)
    }
  }

  _onClose (event, socket) {
    this._checkInitializeWs(event, socket)
    this.emit('socket:close', socket)
  }

  _onError (event, socket) {
    this._checkInitializeWs(event, socket)
    this.emit('socket:error', socket)
  }

  _onMessage (message) {
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

  _checkInitializeWs (event, socket) {
    if (!socket.ws) {
      socket.ws = event.target
      this.emit('socket:ready', socket)
    }
  }

  _openChannel (channel) {
    if (!channel.opened) {
      channel.opened = true
      channel.emit('open')
    }
  }

  _send (socket, message) {
    if (!socket.ws || socket.ws.readyState !== WebSocket.OPEN) {
      return
    }

    socket.send(message)
  }

  _closeChannels (cb) {
    const onChannelClose = () => {
      if (this.channels.size === 0) {
        this.removeListener('channel:close', onChannelClose)
        cb()
      }
    }

    this.on('channel:close', onChannelClose)

    for (let channel of this.channels.values()) {
      process.nextTick(() => channel.end())
    }
  }
}

module.exports = (...args) => new SignalhubWs(...args)
