import webapp2
import jinja2
import os
import json
import datetime
import random
import logging
from google.appengine.api import channel
from google.appengine.api import memcache
from google.appengine.ext import db
from webapp2_extras import sessions

jinja_environment = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__)))


MEMCACHE_MESSAGES = 'messages'
ROOM_DEFAULT = 'lobby'


def remove_values_from_list(the_list, val):
    return [value for value in the_list if value != val]


class User(db.Model):
    name = db.StringProperty(default="")
    clients = db.StringListProperty()

    def get_id(self):
        return self.key().name()

    def to_dict(self):
        return {'id': self.get_id(),
                'name': self.name}


class Room(db.Model):
    name = db.StringProperty(default='')
    owner = db.ReferenceProperty(User)
    clients = db.StringListProperty()

    def get_id(self):
        return self.key().name()

    def to_dict(self):
        return {'id': self.get_id(),
                'name': self.name}

    def send_messages(self, messages=[]):
        channel_msg = json.dumps({
            'success': True,
            'messages': messages,
            'clients': self.clients})
        # Send the message to all the connected users
        for client_id in self.clients:
            channel.send_message(client_id, channel_msg)


class Message(db.Model):
    text = db.StringProperty(default="")
    user = db.ReferenceProperty(User)
    date = db.DateTimeProperty(auto_now_add=True)
    room = db.ReferenceProperty(Room)

    def get_id(self):
        return self.key().id()

    def to_dict(self):
        return {'id': self.get_id(),
                'text': self.text,
                'user': self.user.to_dict(),
                'date': self.date.isoformat() + 'Z',
                'room': self.room.to_dict(),
                }

    @classmethod
    def save_message(cls, user, text, room):
        # Save the message sent by the user
        message = Message(user=user, text=text, room=room)
        message.put()
        memcache.delete(MEMCACHE_MESSAGES + room.get_id())
        return message

    @classmethod
    def get_messages(cls, room, limit=200):
        cache_key = MEMCACHE_MESSAGES + room.get_id()
        messages_ser = memcache.get(cache_key)
        if not messages_ser:
            messages = cls.all().filter('room = ', room).order('date').fetch(limit)
            messages_ser = [message.to_dict() for message in messages]
            memcache.set(cache_key, messages_ser)
        return messages_ser


class BaseHandler(webapp2.RequestHandler):
    def dispatch(self):
        self.session_store = sessions.get_store(request=self.request)
        try:
            webapp2.RequestHandler.dispatch(self)
        finally:
            self.session_store.save_sessions(self.response)

    @webapp2.cached_property
    def session(self):
        return self.session_store.get_session()

    def get_room(self):
        room_id = self.request.get('room_id', ROOM_DEFAULT)
        room = Room.get_by_key_name(room_id)
        if not room:
            room_name = self.request.get('room_name', '')
            room = Room(name=room_name, key_name=room_id, owner=self.get_user())
            room.put()
        return room

    def get_user(self):
        user = None
        # First check in URL
        user_id = self.request.get('user_id')
        if user_id:
            user = User.get_by_key_name(user_id)
            if not user:
                user_name = self.request.get('user_name', str(user_id))
                user = User(name=user_name, key_name=user_id)
                user.put()
        # Now check in cookies
        if not user:
            user_id = self.session.get('user_id')
            if user_id:
                user = User.get_by_key_name(user_id)
                if not user:
                    user = User(name='Anon' + str(random.randint(1, 1000)), key_name=user_id)
                    user.put()
        # Finally, give up and just use random uuid
        if not user:
            user_id = str(random.randint(1, 10000)) + str(datetime.datetime.now())
            user = User(name='Anon' + str(random.randint(1, 1000)), key_name=user_id)
            user.put()
        # Store in cookies
        self.session['user_id'] = user.get_id()
        return user

    def json_response(self, response_dict):
        self.response.out.write(json.dumps(response_dict))


class ChatHandler(BaseHandler):

    def get(self):
        # Create or retrieve user and room based on query params
        user = self.get_user()
        room = self.get_room()
        # generate a unique id for the channel api
        client_id = str(random.randint(1, 10000)) + str(datetime.datetime.now())
        client_token = channel.create_channel(client_id)
        user.clients.append(client_id)
        user.put()
        room.clients.append(client_id)
        room.put()
        # generate the template and answer back to the user
        if os.environ['SERVER_SOFTWARE'].startswith('Dev'):
            version = 'devserver'
        else:
            version = os.environ.get('CURRENT_VERSION_ID')
        template_vars = {
            'version': version,
            'user': user,
            'client_id': client_id,
            'client_token': client_token,
            'room_id': room.get_id(),
            }
        template = jinja_environment.get_template('templates/chat.html')
        self.response.out.write(template.render(template_vars))


class MessagesHandler(BaseHandler):

    def get(self):
        room = self.get_room()
        messages = Message.get_messages(room=room)
        self.json_response({
            'success': True,
            'messages': messages,
            'clients': room.clients})

    def post(self):
        # Get the parameters
        user = self.get_user()
        text = self.request.get('text')
        room = self.get_room()
        # Save the message sent by the user
        message = Message.save_message(user, text, room)
        # Generate the template with the message
        messages = [message.to_dict()]
        room.send_messages(messages=messages)
        # Reply to the user request
        self.json_response({'success': True})


class DisconnectHandler(BaseHandler):

    def post(self):
        room = self.get_room()
        client_id = self.request.get('client_id')
        try:
            room.clients = remove_values_from_list(room.clients, client_id)
            room.put()
            room.send_messages()
            logging.info('Removed client ID from room for room')
        except:
            logging.info('Client ID not found')
        user = User.all().filter('clients = ', client_id).get()
        if user:
            try:
                user.clients = remove_values_from_list(user.clients, client_id)
                user.put()
                logging.info('Removed client ID from user')
            except:
                logging.info('Client ID not found for user')
        else:
            logging.info('User not found')
        self.json_response({'success': True})


config = {}
config['webapp2_extras.sessions'] = {
    'secret_key': 'my-super-secret-key',
}

app = webapp2.WSGIApplication([
    ('/messages/', MessagesHandler),
    ('/disconnect/', DisconnectHandler),
    ('/', ChatHandler)
    ], debug=True, config=config)
