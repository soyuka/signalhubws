# Run with:
# uwsgi --http-socket :3300 --http-websocket --wsgi-file signalhubws.py --gevent 100

import os
from contextlib import contextmanager
from collections import defaultdict
import uwsgi
import gevent.select


class Pipe:
    def __init__(self):
        self.fd_rd, self.fd_wr = os.pipe()

    def write(self, byte_data):
        os.write(self.fd_wr, byte_data)

    def read(self, nbytes):
        return os.read(self.fd_rd, nbytes)


class Wire:
    def __init__(self):
        self.pipe = Pipe()
        self.queue = []

    @property
    def ready_fd(self):
        return self.pipe.fd_rd

    def enqueue(self, msg):
        self.queue.append(msg)
        self.pipe.write(b'.')

    def dequeue(self):
        self.pipe.read(1)
        m, self.queue = self.queue[0], self.queue[1:]
        return m


class Channel:
    def __init__(self):
        self.connections = {}

    def register(self, key):
        wire = Wire()
        self.connections[key] = wire
        return wire

    def unregister(self, key):
        del self.connections[key]

    def broadcast(self, msg):
        for wire in self.connections.values():
            wire.enqueue(msg)

    @contextmanager
    def managed_register(self, key):
        wire = self.register(key)
        try:
            yield wire
        finally:
            self.unregister(key)


class Server:
    def __init__(self):
        self.channels = defaultdict(Channel)

    def channel_for(self, url):
        return self.channels[url]


server = Server()


def application(env, start_response):
    ws_scheme = 'ws'
    if 'HTTPS' in env or env['wsgi.url_scheme'] == 'https':
        ws_scheme = 'wss'

    if 'HTTP_SEC_WEBSOCKET_KEY' in env:
        uwsgi.websocket_handshake(env['HTTP_SEC_WEBSOCKET_KEY'], env.get('HTTP_ORIGIN', ''))

        websocket_fd = uwsgi.connection_fd()
        channel = server.channel_for(env['PATH_INFO'])

        with channel.managed_register(websocket_fd) as wire:

            while True:
                ready = gevent.select.select([websocket_fd, wire.ready_fd], [], [], 4.0)
                if not ready[0]:
                    uwsgi.websocket_recv_nb()
                for fd in ready[0]:
                    if fd == websocket_fd:
                        msg = uwsgi.websocket_recv_nb()
                        if msg:
                            channel.broadcast(msg)
                    elif fd == wire.ready_fd:
                        uwsgi.websocket_send(wire.dequeue())

