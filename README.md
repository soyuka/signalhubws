# Signalhubws

[![Build Status](https://travis-ci.org/soyuka/signalhubws.svg?branch=master)](https://travis-ci.org/soyuka/signalhubws)

Drop in replacement for signalhub with websockets.

Note: Binary is just launching server (similar to `signalhub listen -p $PORT`)

See https://github.com/mafintosh/signalhub

## Deploy with now

```
now soyuka/signalhubws
```

## Available signalhubs (WSS):

```
wss://soyuka.pw
```

## API

#### `hub = signalhubws(appName, urls, WebSocketClass)`

Create a new hub client. If you have more than one hub running specify them in an array

``` js
// use more than one server for redundancy
var hub = signalhubws('my-app-name', [
  'wss://signalhub1.example.com',
  'wss://signalhub2.example.com',
  'wss://signalhub3.example.com'
])
```

The `appName` is used to namespace the subscriptions/broadcast so you can reuse the
signalhub for more than one app.

The `WebSocketClass` allows you to override the socket class implementation. `signalhubws` ships with the [`cws`](https://github.com/ClusterWS/cWS) package on nodejs and uses the native `Websocket` implementation on browsers.

#### `stream = hub.subscribe(channel)`

Subscribe to a channel on the hub. Returns a readable stream of messages

#### `hub.broadcast(channel, message, [callback])`

Broadcast a new message to a channel on the hub

#### `hub.close([callback])`

Close all subscriptions
