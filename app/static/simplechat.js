Handlebars.registerHelper('linkify', function(text) {
    return new Handlebars.SafeString(linkify(text));
});

$(document).ready(function(){

	var chatMessageTemplate = Handlebars.compile(document.getElementById('chat-message-template').innerHTML);
	var $chatMessages = $('#chat-messages');
	var $chatInput = $('#chat-input');

	function track(obj) {
		if (!window._204) window._204 = [];
		_204.push(obj);
	}

	function resizeChat() {
		$chatMessages.height($(window).height() - $('#chat-bottom').height() - 10);
		$chatInput.width($(window).width() - $('#chat-name').width() - 30);
	}

	function scrollToBottom() {
		resizeChat();
		$chatMessages.animate({scrollTop: $chatMessages.prop("scrollHeight")}, 500);
	}

	function renderMessages(data) {
		if (typeof data == 'string') {
			data = $.parseJSON(data);
		}
		console.log(data);
		$.each(data.messages, function(ind, message) {
			message.user.name = $.trim(message.user.name);
			if (message.text.indexOf('/status') === 0) {
				message.text = message.text.substr(7);
				message.isStatus = true;
			}
		});
		$chatMessages.append(chatMessageTemplate(data));
		$('time.timeago').timeago();

		console.log(data.clients.length);
		if (data.clients.length > 1) {
			$('#chat-people').text(data.clients.length + ' people chatting');
		} else {
			$('#chat-people').text('1 person chatting (you)');
		}
		scrollToBottom();
	}

	function sendMessage(text) {

		$.ajax({
			url: '/messages/',
			type: 'POST',
			data:{
				text: text,
				client_id: clientId,
				room_id: roomId
			},
			success: function(data){
				
			}
		});
	}

	$('form').submit(function(e){
		e.preventDefault();

		var text = $chatInput.val();
		$chatInput.val('');
		track({key:'coursera.chrome.chat.send', value: text});
		sendMessage(text);
	});
	
	
	var channel = new goog.appengine.Channel(clientToken);
	var socket = channel.open();
	socket.onopen = function(){
		$.ajax({url: '/messages/',
				type: 'GET',
				data: {client_id: clientId, room_id: roomId},
				success: function(data) {
					renderMessages(data);
				}});
		sendMessage('/status entered the room.');
	};

	socket.onmessage = function(message){
		renderMessages(message.data);
	};

    socket.onerror =  function(err) {
		console.log('Socket err:' + err);
	};
    socket.onclose =  function() {
		console.log('Socket closed');
	};
	
	$(window).on('beforeunload', function () {
        $.ajax({url: '/disconnect/', async: false, type: 'POST', data: {room_id: roomId, client_id: clientId}});
	});

	$(window).on('resize', resizeChat);
	
	$(window).on('message', function(event) {
		console.log(event);
		if (event.originalEvent.origin == 'http://class.coursera.org' || event.originalEvent.origin == 'https://class.coursera.org') {
			var message = (event.originalEvent.data);
			console.log(message);
			if (message.indexOf('/status') === 0) {
				sendMessage(message);
				track({key:'coursera.chrome.chat.status', value: message});
			}
		}
	});

	scrollToBottom();
	track({user: userId});
	track({client: 'coursera-chrome-chat'});
	track({key:'coursera.chrome.chat.load', value: roomId});
});

(function() {
	if (window.location.hostname != 'localhost') {
		var a = document.createElement('script'); a.type = 'text/javascript'; a.async = true;
		a.src = 'https://eventing.coursera.org/204.min.js';
		var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(a, s);
	}
})();


