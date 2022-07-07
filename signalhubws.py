# Run with:
# uwsgi --http-socket :3300 --http-websocket --wsgi-file signalhubws.py --gevent 100

import os
import json
import re
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

    def close(self):
        os.close(self.fd_rd)
        os.close(self.fd_wr)


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

    def close(self):
        self.pipe.close()


class Channel:
    def __init__(self):
        self.connections = {}

    def register(self, key):
        wire = Wire()
        self.connections[key] = wire
        return wire

    def unregister(self, key):
        self.connections[key].close()
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
        self.motd = None

    def handle_http(self, env, start_response):
        start_response('200 OK', [('Content-Type', 'text/plain; charset=utf-8')])

        if env['PATH_INFO'] == '/turn-phone-home':
            print(f"[{env['REMOTE_ADDR']}] Received TURN call-home request")
            self.set_as_turn(env['REMOTE_ADDR'])

        ident = f"Signalhubws Server ({env['SERVER_NAME']}) → {env['REMOTE_ADDR']}"
        summary = self.summary()
        summary = f"{summary['clients']} connected in {summary['channels']} channels"
        motd = json.dumps(self.motd) if self.motd else ''

        return f"{ident}\n\n {summary}\n\n{motd}".encode('utf-8')

    def channel_for(self, url):
        return self.channels[self.channel_name_for(url)]

    def channel_name_for(self, url):
        return re.sub('^/', '', url)

    def wrap_message(self, message, channel):
        # there seems to be a slight mixup between `app` and `channel` in Signalhub
        return {'app': channel, 'channel': '*', 'message': message}

    def format_motd(self, channel):
        return self.encode_json(self.wrap_message({'motd': self.motd}, channel))

    def encode_json(self, data):
        return json.dumps(data).encode('utf-8')

    def summary(self):
        total_connections = sum(len(c.connections) for c in self.channels)
        return {'channels': len(self.channels), 'clients': total_connections}

    def set_as_turn(self, client_addr):
        """
        Used to configure `motd` with details of a STUN/TURN server.
        """
        if self.motd is None: self.motd = {}
        # these are hard-coded for now
        self.motd['ice'] = {
            'urls': [f'turn:{client_addr}:3478'],
            'username': 'power',
            'credential': 'to-the-people'
        }


server = Server()


def application(env, start_response):
    ws_scheme = 'ws'
    if 'HTTPS' in env or env['wsgi.url_scheme'] == 'https':
        ws_scheme = 'wss'

    if 'HTTP_SEC_WEBSOCKET_KEY' in env:
        uwsgi.websocket_handshake(env['HTTP_SEC_WEBSOCKET_KEY'], env.get('HTTP_ORIGIN', ''))

        channel_name = server.channel_name_for(env['PATH_INFO'])

        if server.motd: uwsgi.websocket_send(server.format_motd(channel_name))

        websocket_fd = uwsgi.connection_fd()
        channel = server.channels[channel_name]
        quit = False

        print(f"[info] client connected (fd={websocket_fd}, channel={channel_name})")

        with channel.managed_register(websocket_fd) as wire:

            while not quit:
                ready = gevent.select.select([websocket_fd, wire.ready_fd], [], [], 4.0)
                if not ready[0]:
                    uwsgi.websocket_recv_nb()
                for fd in ready[0]:
                    if fd == websocket_fd:
                        try:
                            msg = uwsgi.websocket_recv_nb()
                        except:
                            quit = True; break
                        if msg:
                            channel.broadcast(msg)
                    elif fd == wire.ready_fd:
                        uwsgi.websocket_send(wire.dequeue())

        print(f"[info] client disconnected (fd={websocket_fd}, channel={channel_name})")
        return ""

    else:
        return server.handle_http(env, start_response)
