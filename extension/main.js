//var URL_BASE = 'http://localhost:8060/';
var URL_BASE = 'https://coursera-chat.appspot.com/';
var scriptURL = URL_BASE + 'static/embed.js';

var script = document.createElement('script');
script.src = scriptURL;
document.body.appendChild(script);