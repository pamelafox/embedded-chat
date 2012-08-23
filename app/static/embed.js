function readCookie(name) {
	var nameEQ = name + "=";
	var ca = document.cookie.split(';');
	for(var i=0;i < ca.length;i++) {
		var c = ca[i];
		while (c.charAt(0)==' ') c = c.substring(1,c.length);
		if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length,c.length);
	}
	return null;
}

//var URL_BASE = 'http://localhost:8060/';
var URL_BASE = 'https://coursera-chat.appspot.com/';

var roomId = window.location.pathname.split('/')[1];
var roomName = $('.course-logo-name nobr').text();
var userName = $('a[rel="dropdown_my"]').text();
var userId = readCookie('session') || (new Date().getTime()); // Would prefer to get this from data attrs in page

var chatParams = {
	'user_id': userId,
	'user_name': userName,
	'room_id': roomId,
	'room_name': roomName
};

var chatUrl = URL_BASE + '?' + $.param(chatParams);

var $chatWrapper = $('<div class="chat-wrapper"></div>');
$chatWrapper.css({
	width: '100%',
	border: '0px',
	height: '115px',
	position: 'fixed',
	bottom: '0px',
	padding: '0px',
	background: 'white',
	margin: '0px',
	zIndex: '1300',
	borderTop: '2px solid #777'
});

var $chatIframe = $('<iframe class="chat-iframe" frameborder="0" scrolling="no" src="' + chatUrl + '"></iframe>');
$chatIframe.css({
	width: '100%',
	height: '100px'
});

var $chatToggler = $('<div class="chat-toggler">hide chat</div>');
$chatToggler.css({
	height: '15px',
	background: '#ccc',
	fontSize: '10px',
	padding: '0px',
	paddingTop: '3px',
	lineHeight: '1em',
	textAlign: 'center',
	color: '#777',
	cursor: 'pointer'
});

$chatToggler.on('click', function() {
	if ($chatWrapper.height() > 30) {
		$chatWrapper.height(15);
		$chatToggler.text('show chat');
	} else {
		$chatWrapper.height(115);
		$chatToggler.text('hide chat');
	}
});

$chatWrapper.append($chatToggler);
$chatWrapper.append($chatIframe);
$(document.body).append($chatWrapper);
$('body > .container-fluid').css('padding-bottom', '200px');

$('.lecture-link').on('click', function() {
	var $link = $(this);
	var message = '/status started watching ' + $link.text().trim();
	$chatIframe[0].contentWindow.postMessage(message, URL_BASE);
	console.log('Sent message: ' + message);
});