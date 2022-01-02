var config = {attributes: false, childList: true, characterData: false};

var htmlBody = $("body")[0];

var ROOT_DIV_ID = "root_container_cbhandy_overlay";
var CSS_LINK_ID = "root_container_cbhandy_overlay_css";
var logs;

window.addEventListener('load', () => {
    onContentScriptInitialized();
});

window.addEventListener('unload', () => {
    onContentScriptUnloaded();
});

function onContentScriptUnloaded() {
	chrome.runtime.sendMessage( [ "contentScriptUnloaded" ] );
}

function onContentScriptInitialized() {
	chrome.runtime.sendMessage( [ "contentScriptInitialized" ] );
	chrome.runtime.onMessage.addListener(
		function(request, sender, sendResponse) {
		if (request.greeting === "hello")
			sendResponse({farewell: "goodbye"});
		}
	);
	
	function script() {
		console.defaultLog = console.log.bind(console);
		console.log = function(){
			if ( arguments[0].toString().includes('videoshare.js') ) chrome.runtime.sendMessage(elementId, arguments);
			console.defaultLog.apply(console, arguments);
		}
	}

	function inject(fn) {
		const script = document.createElement('script')
		script.text = `(${ fn.toString().replace('elementId', '"'+chrome.runtime.id+'"') })();`
		document.documentElement.appendChild(script)
	}

	inject(script);
	
}







