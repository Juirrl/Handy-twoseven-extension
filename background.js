class Background {
	
    constructor() {
		
		window.tipList = undefined;
		window.xhrRequests = [];
		var self = this;
		window.self = this;
		
		window.masterStroke = {
			start: 0,
			stop: 100
		};
		
		window.syncOffset = 0;
		
		window.scriptFileData = undefined;

		window.backgroundStatus = {
			scriptLoaded: false,
			connectionKey: undefined,
			scriptFileName: undefined,
			handyConnected: false,
			contentScriptCount: 0,
			paused: false,
			loading: false,
			scriptFileStatus: "None",
			loadFileStatus: "None",
			connectionStatus: "None",
			scriptFileColor: "red",
			loadFileColor: "red",
			connectionColor: "red",
			loadStatus : 0, // 0 - Not loading, 1 - Uploading to server, 2 - setting mode, 3 - uploading to handy, 4 - success, 5 - fail, 6 - failed set mode, 7 - failed to play, 8 - failed upload, 9 - failed download, 10 - firmware out of date
			errorMessages: [],
			playtime: 0,
			offset: 0,
			patternsUrl: undefined,
		};
		
		window.sha256 = 'f10fb07e14335324f252a83545b48b9f677e5581b261f981e1734bd82a490ddf';
		window.retryAttempts = 2;
		window.KEY_getInfo = 'Get Handy info';
		window.KEY_serverTime = 'Get Server Time';
		window.KEY_HSSPState= 'HSSP State';
		window.KEY_HSSPSetup = 'Upload Patterns';
		window.KEY_getSync = 'Get Sync';
		window.KEY_HSSPPlay = 'Play HSSP';
		window.KEY_setSlide = 'Set Slide'; // this is the stroke length
		window.KEY_startSlide = 'Start Slide'; 
		window.KEY_stopSlide = 'Stop Slide'; 
		window.KEY_setVelocity = 'Set Velocity'; 
		window.KEY_setMode = 'Set Mode'; 
		window.KEY_getMode = 'Get Mode'; 
		window.KEY_stopHAMP = 'Stop HAMP'; 
		window.KEY_stopHSSP = 'Stop HSSP'; 
		window.KEY_setXPVP = 'Set XPVP';
		window.KEY_getConnected = 'Get Connected';
		
		window.patternLength = 59;

		chrome.storage.sync.get(['connectionKey'], function(result) {
			if ( !chrome.runtime.error && result != null ) window.backgroundStatus.connectionKey = result.connectionKey;
		});
			
		window.APIUrl = "https://www.handyfeeling.com/api/handy/v2";

		window.levelMatrix;
		
		// console.log('[videoshare.js]: Server says seek: ' + JSON.stringify(json))
		// Example [videoshare.js]: Server says seek: {"videoSelector":"web","position":1163435.4706,"extras":{}}
		chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
			if ( message.includes('setStop' ) ) {
				window.self.stop();
			}
			if ( message.includes('pauseButton' ) ) {
				window.self.pauseButton();
			}
			if ( message.includes('handyUploadScript' ) ) {
				window.self.syncPrepare();
			}
			if ( message.includes('contentScriptInitialized' ) ) {
				window.self.updateContentScriptCount(1);
			}  
			if ( message.includes('contentScriptUnloaded' ) ) {
				window.self.updateContentScriptCount(-1);
			}  
			if ( message.includes('updatePopupRequest' ) ) {
				window.self.updatePopup();
			}  
			if ( message.includes('checkConnectedRequest') ) {
				window.self.checkConnected();
			}
			if ( message.includes('setScriptFile') ) {
				window.self.setScriptFile(message[1], message[2]);
			}
		});
		
		chrome.runtime.onInstalled.addListener(window.self.installScript);
		
		chrome.runtime.onMessageExternal.addListener(
			function(request, sender, sendResponse) {
				if ( typeof request[0] === 'string' ) {
					const messsage = request[0].split(" ");
					if ( messsage[0] === '[videoshare.js]:' ) window.self.videoShareMessage(messsage);
				}
			}
		);
		
		chrome.storage.sync.get(['masterStroke'], function(result) {
			if ( !chrome.runtime.error && result != null && result.masterStroke != undefined ) {
				window.masterStroke = result.masterStroke;	
			} else {
				chrome.storage.sync.set( { 'masterStroke': { start: window.masterStroke.start, stop: window.masterStroke.stop } } );
			}
		});	
		
		chrome.storage.sync.get(['syncOffset'], function(result) {
			if ( !chrome.runtime.error && result != null && result.syncOffset != undefined ) {
				window.syncOffset = result.syncOffset;	
			} else {
				chrome.storage.sync.set( { 'syncOffset': window.syncOffset } );
			}
		});	
		
		chrome.storage.sync.get(['scriptFileURL'], function(result) {
			if ( !chrome.runtime.error && result != null && result.scriptFileURL != undefined ) {
				window.backgroundStatus.scriptFileURL = result.scriptFileURL;	
			}
		});	
		
		chrome.storage.onChanged.addListener(function(changes, namespace) {
			for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
				if(key === 'masterStroke') {
					window.masterStroke = newValue;
					window.self.handySetSlide(window.masterStroke.start, window.masterStroke.stop);
				}
				if(key === 'connectionKey') {
					window.backgroundStatus.connectionKey = newValue;
					window.self.adjustSync();
				}
				if(key === 'syncOffset') {
					window.syncOffset = newValue;
					window.self.adjustSync();
				}
			}
		});
		
		window.self.updateStatusMessages();
		
    }
	
	videoShareMessage(message) {
		if ( message == undefined || message.length < 5) return;
		if ( message[3] === 'play:') window.self.doVideoPlay(message[4]);
		if ( message[3] === 'pause:') window.self.doVideoPause(message[4]);
		if ( message[3] === 'seek:') window.self.doVideoSeek(message[4]);
	}
	
	doVideoPlay(parameters) {
		const vidParams = parameters.split('"');
		const position = parseFloat(vidParams[6].substr(1));
		window.backgroundStatus.playtime = parseInt(position) - new Date().getTime();
		if ( window.backgroundStatus.handyConnected && window.backgroundStatus.loadStatus == 4 && !window.backgroundStatus.paused) 
			window.self.handyHSSPPlay(parseInt(position) + window.syncOffset );
	}
	
	doVideoPause(parameters) {
		window.backgroundStatus.playtime = 0;
		if ( window.backgroundStatus.handyConnected && window.backgroundStatus.loadStatus == 4 && !window.backgroundStatus.paused) window.self.stopHandy();
	}
	
	doVideoSeek(parameters) {
		// Checking local variable to see if the handy should be playing already, handyHSSPState takes too long and throws off the sync
		if ( window.backgroundStatus.playtime == 0 ) return;
		if ( window.backgroundStatus.handyConnected && window.backgroundStatus.loadStatus == 4 && !window.backgroundStatus.paused)
			window.self.doVideoPlay(parameters);
	}
	
	adjustSync() {
		if ( window.backgroundStatus.playtime == 0 ) return;
		const position = window.backgroundStatus.playtime + new Date().getTime();
		if ( window.backgroundStatus.scriptLoaded && !window.backgroundStatus.paused ) 
			window.self.handyHSSPPlay(parseInt(position) + window.syncOffset );
	}
	
	getDefaultMasterStroke() {
		return { strokeStart: 0, strokeStop: 100 };
	}
	
	validateResponse(response) {
		if (!response.ok) {
			throw Error(response.statusText);
		}
		return response;
	}
	
	handyStatusHandler(xhr, requestType) {
			if (xhr.status === 200) {
				var response = JSON.parse(xhr.response);
				switch( requestType ) {
					case window.KEY_HSSPSetup:
						switch( response.result ) {
							case 0:
								console.log(requestType + ' Success, patterns already downloaded');
								return true;
							break;
							case 1:
								console.log(requestType + ' Success, patterns downloaded');
								return true;
							break;							
							case -1:
								console.log(requestType + ' Error, unable to download script');
								return false;
							break;							
							case -2:
								console.log(requestType + ' Error, unknown error');
								return false;
							break;							
							case -20:
								console.log(requestType + ' Error, sync required');
								return false;
							break;
							default:
								console.log(requestType + ' Error');
								return false;
							break;							
						}
					break;
					case window.KEY_getSync:
						switch( response.result ) {
							case 0:
								console.log(requestType + ' Success');
								return true;
							break;
							case -1:
								console.log(requestType + ' Error');
								return false;
							break;
							default:
								console.log(requestType + ' Error');
								return false;
							break;
						}
					break;		
					case window.KEY_HSSPState:
						switch( response.result ) {
							case 0:
								console.log(requestType + ' Success');
								return true;
							break;						
							case -1:
								console.log(requestType + ' Error');
								return false;
							break;														
						}
					break;
					case window.KEY_HSSPPlay:
						switch( response.result ) {
							case 0:
								console.log(requestType + ' Success');
								return true;
							break;
							case -1:
								console.log(requestType + ' Error');
								console.log(response.error.message);
								return false;
							break;
							default:
								console.log(requestType + ' Error');
								console.log(response.error.message);
								return false;
							break;
						}
					break;						
					case window.KEY_setSlide:
						switch( response.result ) {
							case 0:
								console.log(requestType + ' Success');
								return true;
							break;
							case 1:
								console.log(requestType + ' Success');
								return true;
							break;
							default:
							// The API doesn't actually list the result codes for set slide
								console.log(requestType + ' Error');
								return false;
							break;
						}
					break;	
					case window.KEY_startSlide:
						switch( response.result ) {
							case -1:
								console.log(requestType + ' Error');
								return false;
							break;
							case 0:
								console.log(requestType + ' Success');
								return true;
							break;
							case 1:
								console.log(requestType + ' Success');
								return true;
							break;
							default:
								console.log(requestType + ' Error');
								return false;
							break;
						}
					break;	
					case window.KEY_stopSlide:
						switch( response.result ) {
							case -1:
								console.log(requestType + ' Error');
								return false;
							break;
							case 0:
								console.log(requestType + ' Success');
								return true;
							break;
							case 1:
								console.log(requestType + ' Success');
								return true;
							break;
							default:
								console.log(requestType + ' Error');
								return false;
							break;
						}
					break;	
					case window.KEY_setMode:
						switch( response.result ) {
							case -1:
								console.log(requestType + ' Error');
								return false;
							break;
							case 0:
								console.log(requestType + ' Success');
								return true;
							break;
							case 1:
								console.log(requestType + ' Success');
								return true;
							break;
							default:
								console.log(requestType + ' Error');
								return false;
							break;
						}
					break;
					case window.KEY_getMode:
						switch( response.result ) {
							case -1:
								console.log(requestType + ' Error');
								return false;
							break;
							case 0:
								console.log(requestType + ' Success');
								return true;
							break;
							default:
								console.log(requestType + ' Error');
								return false;
							break;
						}
					break;
					case window.KEY_setVelocity:
						switch( response.result ) {
							case -1:
								console.log(requestType + ' Error');
								return false;
							break;
							case 0:
								console.log(requestType + ' Success');
								return true;
							break;
							default:
								console.log(requestType + ' Error');
								return false;
							break;
						}
					break;
					case window.KEY_stopHAMP:
						switch( response.result ) {
							case -1:
								console.log(requestType + ' Error');
								return false;
							break;
							case 0:
								console.log(requestType + ' Success');
								return true;
							break;
							case 1:
								console.log(requestType + ' Success');
								return true;
							break;
							default:
								console.log(requestType + ' Error');
								return false;
							break;
						}
					break;
					
					case window.KEY_getConnected:
						window.backgroundStatus.handyConnected = response.connected;
						switch( response.connected ) {
							case true:
								//console.log(requestType + ' True');
								return true;
							break;
							case false:
								//console.log(requestType + ' False');
								return false;
							break;
							default:
								console.log(requestType + ' Error');
								return false;
							break;
						}
					break;
					case window.KEY_stopHAMP:
					// The API doesn't define these, assuming same as HSSP for now
						switch( response.result ) {
							case -1:
								console.log(requestType + ' Error');
								return false;
							break;
							case 0:
								console.log(requestType + ' Success');
								return true;
							break;
							case 1:
								console.log(requestType + ' Success');
								return true;
							break;
							default:
								console.log(requestType + ' Error');
								return false;
							break;
						}
					break;
					case window.KEY_serverTime:
						if ( response != undefined && response.serverTime != undefined ) {
							console.log(requestType + ' Success');
							return true;
						} else {
							console.log(requestType + ' Error');
							return false;
						}
					break;
					case window.KEY_setXPVP:
						switch( response.result ) {
							case -3:
								console.log(requestType + ' Error. Device failed processing the command');
								return false;
							break;
							case 0:
								console.log(requestType + ' Success. Position reached.');
								return true;
							break;
							case 1:
								console.log(requestType + ' Success. Position not reached');
								return true;
							break;
							case 2:
								console.log(requestType + ' Success. Already at position.');
								return true;
							break;
							case 3:
								console.log(requestType + ' Success. Interupted.');
								return true;
							break;
							default:
								console.log(requestType + ' Error');
								return false;
							break;
						}
					break;
				}
			}
			if (xhr.status === 400) {
				console.log(requestType + ' Error: Bad Request');
				return false;
			}
			if (xhr.status === 502) {
				console.log(requestType + ' Error: Machine not connected');
				return false;
			}
			if (xhr.status === 504) {
				console.log(requestType + ' Error: Machine timeout');
				return false;
			}
	}
			
	handyGetMode(callback, retries) {
		var url = window.APIUrl + "/mode";
		var xhr = new XMLHttpRequest();
		if ( retries == undefined || retries <= 0 ) retries = 0;
		window.xhrRequests.push(xhr);
		xhr.open("GET", url);
		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		
		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				if ( window.self.handyStatusHandler(xhr, window.KEY_getMode)   ) {
					var mode = JSON.parse(xhr.response).mode;
					if (callback && typeof(callback) === "function") {
						callback(mode);
					}
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handyGetMode( callback, retries+1 );
					} else {
						window.self.addErrorMessage('Get mode failed.');
					}
				}
			}
		};
		
		xhr.send( );
	}
	
	handySetMode(mode, callback, retries) {
		var url = window.APIUrl + "/mode";
		var xhr = new XMLHttpRequest();
		if ( retries == undefined || retries <= 0 ) retries = 0;
		window.xhrRequests.push(xhr);
		xhr.open("PUT", url);

		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		xhr.setRequestHeader("Content-Type", "application/json");

		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				if( window.self.handyStatusHandler(xhr, KEY_setMode) ) {
					if (callback && typeof(callback) === "function") {
						callback();
					}
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handySetMode( mode, callback, retries+1 );
					} else {
						window.backgroundStatus.loadStatus = 6;
						window.self.updateStatusMessages();
					}
				}
			}
		};
		var data =  {
			'mode': mode
		};
		xhr.send( JSON.stringify(data) );
	}
	
	handyStopSlide(callback, retries) {
		var url = window.APIUrl + "/hamp/stop";

		var xhr = new XMLHttpRequest();
		if ( retries == undefined || retries <= 0 ) retries = 0;
		window.xhrRequests.push(xhr);
		xhr.open("PUT", url);

		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		xhr.setRequestHeader("Content-Length", "0");

		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				if( window.self.handyStatusHandler(xhr, KEY_stopSlide) ) {
					if (callback && typeof(callback) === "function") {
						callback();
					}
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handyStopSlide( callback, retries+1 );
					} else {
						window.self.addErrorMessage('Stop Slide failed.');
					}
				}
			}
		};
		xhr.send();
	}
	
	handyStartSlide(callback, retries) {
		var url = window.APIUrl + "/hamp/start";

		var xhr = new XMLHttpRequest();
		if ( retries == undefined || retries <= 0 ) retries = 0;
		window.xhrRequests.push(xhr);
		xhr.open("PUT", url);

		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);

		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE  ) {
				if( window.self.handyStatusHandler(xhr, KEY_startSlide) ) {
					if (callback && typeof(callback) === "function") {
						callback();
					}
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handyStartSlide( callback, retries+1 );
					} else {
						window.self.addErrorMessage('Start Slide failed.');
					}
				}
			}
		};
		xhr.send();
	}
	
	handySetVelocity(vel, callback, retries) {
		var url = window.APIUrl + "/hamp/velocity";

		var xhr = new XMLHttpRequest();
		if ( retries == undefined || retries <= 0 ) retries = 0;
		window.xhrRequests.push(xhr);
		xhr.open("PUT", url);

		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		xhr.setRequestHeader("Content-Type", "application/json");

		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				if( window.self.handyStatusHandler(xhr, KEY_setVelocity) ) {
					if (callback && typeof(callback) === "function") {
						callback();
					}
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handySetVelocity( vel, callback, retries+1 );
					} else {
						window.self.addErrorMessage('Set Velocity failed.');
					}
				}
			}
		};
		
		var data =  {
			'velocity': vel
		};
		xhr.send( JSON.stringify(data) );
	}
	

	
	handySetSlide(min, max, callback, retries) {
		function scaleSlideNumber(x) {
			// NewValue = (((OldValue - OldMin) * (NewMax - NewMin)) / (OldMax - OldMin)) + NewMin
			return ((( x - 0 ) * (window.masterStroke.strokeStop - window.masterStroke.strokeStart)) / (100 - 0)) + window.masterStroke.strokeStart;
		}
		var url = window.APIUrl + "/slide";

		var xhr = new XMLHttpRequest();
		if ( retries == undefined || retries <= 0 ) retries = 0;
		window.xhrRequests.push(xhr);
		xhr.open("PUT", url);

		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		xhr.setRequestHeader("Content-Type", "application/json");

		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
					if( window.self.handyStatusHandler(xhr, KEY_setSlide) ) {
					if (callback && typeof(callback) === "function") {
						callback();
					}
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handySetSlide( min, max, callback, retries+1 );
					} else {
						window.self.addErrorMessage('Set Slide failed.');
					}
				}
			}
		};
		
		var data =  {
			'min': min,
			'max': max,
		};
		xhr.send( JSON.stringify(data) );
	}
	
	
	
	handyHSSPPlay(time, callback, retries) {
		var url = 'https://www.handyfeeling.com/api/handy/v2/hssp/play';

		var xhr = new XMLHttpRequest();
		if ( retries == undefined || retries <= 0 ) retries = 0;
		window.xhrRequests.push(xhr);
		xhr.open("PUT", url);

		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		xhr.setRequestHeader("Content-Type", "application/json");

		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				if( window.self.handyStatusHandler(xhr, KEY_HSSPPlay) ) {
					if (callback && typeof(callback) === "function") {
						callback();
					}
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handyHSSPPlay( time, callback, retries+1 );
					} else {
						window.backgroundStatus.loadStatus = 7;
						window.self.updateStatusMessages();
						window.self.addErrorMessage('Start hssp failed.');
					}
				}
			}
		};
		var data =  {
			'estimatedServerTime': Math.trunc( new Date().getTime() + window.backgroundStatus.offset ), 
			'startTime': time
		};
		xhr.send( JSON.stringify(data) );
	}
	
	handyHSSPState(callback, retries) {
		var url = window.APIUrl + "/hssp/state";
		var xhr = new XMLHttpRequest();
		if ( retries == undefined || retries <= 0 ) retries = 0;
		window.xhrRequests.push(xhr);
		xhr.open("GET", url);
		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		
		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				if ( window.self.handyStatusHandler(xhr, window.KEY_HSSPState)   ) {
					var mode = JSON.parse(xhr.response).state;
					if (callback && typeof(callback) === "function") {
						callback(mode);
					}
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handyHSSPState( callback, retries+1 );
					} else {
						window.self.addErrorMessage('Get HSSP State failed.');
					}
				}
			}
		};
		
		xhr.send( );
	}
	
	handyGetSync(callback, retries) {
		var count = 2;
		var url = window.APIUrl + "/hssp/sync?syncCount="+count;
		var xhr = new XMLHttpRequest();
		if ( retries == undefined || retries <= 0 ) retries = 0;
		window.xhrRequests.push(xhr);
		xhr.open("GET", url);
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		xhr.setRequestHeader("accept", "application/json");
		
		xhr.onreadystatechange = function () {
			// Can't figure out what the return value means so not using it.
			// Here's how to get the return value in case we need it: JSON.parse(xhr.response).dtserver;
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				if( window.self.handyStatusHandler(xhr, KEY_getSync) ) {
					if (callback && typeof(callback) === "function") {
						callback();
					}
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handyGetSync( callback, retries+1 );
					} else {
						window.self.addErrorMessage('Get Sync Time failed.');
					}
				}
			}
		};
		
		xhr.send();
	}
	
	handyHSSPSetup(patternsUrl, callback, retries) {
		var url = window.APIUrl + "/hssp/setup";
		var xhr = new XMLHttpRequest();
		window.xhrRequests.push(xhr);
		if ( retries == undefined || retries <= 0 ) retries = 0;
		xhr.open("PUT", url);

		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		xhr.setRequestHeader("Content-Type", "application/json");
		
		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				if( window.self.handyStatusHandler(xhr, window.KEY_HSSPSetup) ) {
					if (callback && typeof(callback) === "function") {
						callback();
					}
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handyHSSPSetup( window.backgroundStatus.patternsUrl, callback, retries+1 );
					} else {
						window.backgroundStatus.loadStatus = 9;
						window.self.updateStatusMessages();
					}
				}
			}
		};
		var data = 
		{
			'url': window.backgroundStatus.patternsUrl
		};
		xhr.send( JSON.stringify(data) );
	}
	
	handyStopHAMP(callback, retries) {
		var url = window.APIUrl + "/hamp/stop";

		var xhr = new XMLHttpRequest();
		xhr.open("PUT", url);

		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		xhr.setRequestHeader("Content-Type", "application/json");
		
		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				if( window.self.handyStatusHandler(xhr, window.KEY_stopHAMP ) ) {
					if (callback && typeof(callback) === "function") {
						callback();
					}
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handyStopHAMP( callback, retries+1 );
					} else {
						window.self.addErrorMessage('Stop Alternating Mode failed.');
					}
				}
			}
		};

		xhr.send();
	}
	
	handyStopHSSP(callback, retries) {
		var url = window.APIUrl + "/hssp/stop";

		var xhr = new XMLHttpRequest();
		xhr.open("PUT", url);

		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		xhr.setRequestHeader("Content-Type", "application/json");
		
		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				if( window.self.handyStatusHandler(xhr, window.KEY_stopHSSP ) ) {
					if (callback && typeof(callback) === "function") {
						callback();
					}
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handyStopHSSP( callback, retries+1 );
					} else {
						window.self.addErrorMessage('Stop Pattern failed.');
					}
				}
			}
		};

		xhr.send();
	}
	
	handyGetInfo(callback) {
		var url = window.APIUrl + "/info";
		var xhr = new XMLHttpRequest();
		
		xhr.open("GET", url);
		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		
		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				const result = window.self.handyStatusHandler(xhr, window.KEY_getInfo);
				if (result != -1 && callback && typeof(callback) === "function") {
					callback(result);
				} else {
					window.self.cancelCurrentRequests();
						window.backgroundStatus.loadStatus = 10;
						window.self.updateStatusMessages();
				}
			}
		};
		xhr.send();
		
	}
	
	handyGetConnected(callback) {
		
		function notConnected() {
			window.self.cancelCurrentRequests();
			window.backgroundStatus.handyConnected = false;
			window.backgroundStatus.loadStatus = 0;
			window.self.updateStatusMessages();
		}
		
		if ( window.backgroundStatus.connectionKey == undefined || window.backgroundStatus.connectionKey == "" ) {
			notConnected();
			return;
		}
		
		var url = window.APIUrl + "/connected";
		var xhr = new XMLHttpRequest();
	
		xhr.open("GET", url);
		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		
		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				const result = window.self.handyStatusHandler(xhr, window.KEY_getConnected);
				if (result && callback && typeof(callback) === "function") {
					window.backgroundStatus.handyConnected = true;
					callback(result);
				} else {
					// The handy is not connected
					notConnected();
				}
			}
		};
		xhr.send();
	}
	
	handyServerTime(callback, remaining, offsets) {
	
		function calculateOffset(offsets) {
			var offsetAg = 0;
			if ( offsets.length <= 0 ) return;
			for ( var i = 0; i < offsets.length ; i++ )
				offsetAg += offsets[i];
			return offsetAg / offsets.length;
		}
		var url = window.APIUrl + "/servertime";
		var xhr = new XMLHttpRequest();
		var startTime = new Date().getTime();
		if ( remaining <= 0 ) {
			if (callback && typeof(callback) === "function") callback();
			return;
		}
		remaining--;
		if ( offsets == undefined ) offsets = [];
		xhr.open("GET", url);
		xhr.setRequestHeader("accept", "application/json");
		
		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				if( window.self.handyStatusHandler(xhr, window.KEY_serverTime ) ) {
					var Treceive = new Date().getTime();
					var RTD =  Treceive - startTime;
					var Ts_est = JSON.parse(xhr.response).serverTime + RTD/2;
					var offset = Ts_est - Treceive;
					offsets.push(offset);
					window.backgroundStatus.offset = calculateOffset(offsets);
					window.self.handyServerTime(callback, remaining);
				} else {
					window.self.handyServerTime(callback, remaining);
				}
				if (callback && typeof(callback) === "function") callback();
			}
		};
		xhr.send();
	}
	
	syncServerTime() {
		window.self.handyServerTime(  function(){} , 10);
	}
	
	
	cancelCurrentRequests() {
		for ( var i = 0 ; i < window.xhrRequests.length ; i++ ) window.xhrRequests[i].abort();
		window.xhrRequests = [];
	}


	syncPrepare(url) {
		window.backgroundStatus.scriptLoaded = false;
		window.backgroundStatus.loading = true;
		window.self.syncServerTime();
		window.backgroundStatus.loadStatus = 1;
		window.self.updateStatusMessages();
		window.self.cancelCurrentRequests();
		window.self.handyGetInfo( function() {
			window.backgroundStatus.loadStatus = 1;
			window.self.uploadPatternFile( function() {
				window.backgroundStatus.loadStatus = 2;
				window.self.updateStatusMessages();
				window.self.handySetMode(1, function() {
					window.backgroundStatus.loadStatus = 3;
					window.self.updateStatusMessages();
					window.self.handySetSlide(window.masterStroke.start, window.masterStroke.stop);
					window.self.handyHSSPSetup(window.backgroundStatus.patternsUrl, function() {
						window.backgroundStatus.loadStatus = 4;
						window.self.updateStatusMessages();
						window.self.adjustSync();
					});
				});
			});
		});
		window.self.checkConnected();
	}

    uploadPatternFile(callback) {
		
		if ( window.backgroundStatus.scriptFileName == undefined || window.scriptFileData == undefined ) {
			window.backgroundStatus.loadStatus = 0;
			window.self.updateStatusMessages();
			return;			
		}
		
		const csv = new File([window.scriptFileData], 'script', { type: 'text/plain' });
		const data = new FormData();
		data.append('syncFile', csv);
		fetch('https://www.handyfeeling.com/api/sync/upload', {
			method: 'POST',
			body: data,
		})
			.then( function(response) {
				if (response.status !== 200) {
						window.backgroundStatus.loadStatus = 8;
						window.self.updateStatusMessages();
					return;
				}

			// Examine the text in the response
				response.json().then(function(data) {
					if ( data.success ) {
						window.backgroundStatus.patternsUrl = data.url;
						if (callback && typeof(callback) === "function") {
							callback();
						}
					} else {
						window.backgroundStatus.loadStatus = 6;
						window.self.updateStatusMessages();
					}
				});
			})
			.catch(function(err) {
				window.isSyncPreparing = false;
				window.backgroundStatus.loadStatus = 6;
				window.self.updateStatusMessages();
				console.log('Fetch Error :-S', err);
			});

    }
	
	stopHandy() {
		window.self.cancelCurrentRequests();
		window.self.handyStopHSSP();
	}
	
	pauseButton() {
		// This is a pause in the extension
		window.backgroundStatus.paused = !window.backgroundStatus.paused;
		window.self.updateStatusMessages();
		if ( window.backgroundStatus.paused ) {
			window.self.stopHandy();
		} else {
			window.self.adjustSync();
		}
	}
	
	/*
	sendMessageToContent(message, callback) {
		// I wonder if this can be linked back to the manifest list
		// query doesn't seem to accept regex expressions, so have to loop through urls
		const urls = ["*://testbed.cb.dev/b/*", "*://chaturbate.com/b/*"];
		if ( urls == undefined ) return;
		for ( var i=0 ; i < urls.length; i++ ) {
			chrome.tabs.query({url: urls[i]}, function(tabs) { 
				if ( tabs != undefined ) {
					for ( var j=0 ; j < tabs.length; j++ ) {
						chrome.tabs.sendMessage(tabs[j].id, message, callback);
					}
				}
			});
		}
	}
	*/
	
	updateContentScriptCount(count) {
		window.backgroundStatus.contentScriptCount += count;
		if ( window.backgroundStatus.contentScriptCount <= 0 ) {
			window.self.stopHandy();
		}
	}
	
	addErrorMessage(error) {
		var time = new Date();
		window.backgroundStatus.errorMessages.push( time.getHours() + ":" + time.getMinutes() + ":" + time.getSeconds() + ": " + error );
		if ( window.backgroundStatus.length > 3 ) window.backgroundStatus.shift();
		window.self.checkConnected();
	}
	
	updatePopup() {
		chrome.runtime.sendMessage( [ 'update_popup', window.backgroundStatus ] );
	}
	
	checkConnected() {
		window.self.handyGetConnected(function() {
			window.self.updateStatusMessages();
		});
	}
	
	setScriptFile(fileName, fileData) {
		window.backgroundStatus.scriptLoaded = false;
		window.backgroundStatus.loadStatus = 0;
		window.backgroundStatus.scriptFileName = fileName;
		window.scriptFileData = fileData;
		window.self.updateStatusMessages();
	}
	
	installScript(details){
		
		function urlMatch(str, rules) {
			rules.forEach( function(rule) {
				var escapeRegex = (str) => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
				if ( new RegExp("^" + rule.split("*").map(escapeRegex).join(".*") + "$").test(str) ) {
					return true;
				} 
			});
			return false;
		}
		// console.log('Installing content script in all tabs that match content_scripts matches.');
		let params = {
			currentWindow: true
		};
		chrome.tabs.query(params, function gotTabs(tabs){
			let contentjsFile = chrome.runtime.getManifest().content_scripts[0].js[0];
			const rules = chrome.runtime.getManifest().content_scripts[0].matches;
			for (let index = 0; index < tabs.length; index++) {
				const url = tabs[index].url;
				if ( rules != undefined && url != undefined && urlMatch(url, rules) ) {
					console.log(tabs[index].url);
					chrome.tabs.executeScript(tabs[index].id, {
						file: contentjsFile
					},
					result => {
						const lastErr = chrome.runtime.lastError;
						if (lastErr) {
							console.error('tab: ' + tabs[index].id + ' lastError: ' + JSON.stringify(lastErr));
						}
					})
				}
			}
		});    
	}
	
	updateStatusMessages() {
		// 	scriptFileStatus
		// 	scriptFileColor
		//	loadFileStatus
		//	loadFileColor
		//  connectionStatus
		//  connectionColor
		const defaultLoadFileStatus = 'Script not loaded.';
		if (!window.backgroundStatus.handyConnected) {
			window.backgroundStatus.connectionStatus = 'Not connected';
			window.backgroundStatus.connectionColor = 'red';
			window.backgroundStatus.loadFileStatus = 'Handy not connected';
			window.backgroundStatus.loadFileColor = 'red';
		} else {
			window.backgroundStatus.connectionStatus = 'Connected';
			window.backgroundStatus.connectionColor = 'green';		
			switch( window.backgroundStatus.loadStatus ) {
				case 0:
					window.backgroundStatus.loadFileStatus = 'Script not loaded';
					window.backgroundStatus.loadFileColor = 'red';
					break;
				case 1:
					window.backgroundStatus.loadFileStatus = 'Uploading script to server';
					window.backgroundStatus.loadFileColor = 'orange';
					break;					
				case 2:
					window.backgroundStatus.loadFileStatus = 'Setting mode on handy';
					window.backgroundStatus.loadFileColor = 'orange';
					break;				
				case 3:
					window.backgroundStatus.loadFileStatus = 'Downloading script to handy';
					window.backgroundStatus.loadFileColor = 'orange';
					break;	
				case 4:
					window.backgroundStatus.loadFileStatus = 'Handy ready to play';
					window.backgroundStatus.loadFileColor = 'green';
					break;	
				case 5:
				    window.backgroundStatus.loadFileStatus = 'Upload script failed';
					window.backgroundStatus.loadFileColor = 'red';
					break;		
				case 6:
					window.backgroundStatus.loadFileStatus = 'Failed to set mode on handy';
					window.backgroundStatus.loadFileColor = 'red';
					break;					
				case 7:
					window.backgroundStatus.loadFileStatus = 'Failed to play script';
					window.backgroundStatus.loadFileColor = 'red';
					break;				
				case 8:
					window.backgroundStatus.loadFileStatus = 'Failed to upload script to handyfeeling.com';
					window.backgroundStatus.loadFileColor = 'red';
					break;	
				case 9:
					window.backgroundStatus.loadFileStatus = 'Failed to download script to handy';
					window.backgroundStatus.loadFileColor = 'red';
					break;	
				case 10:
					window.backgroundStatus.loadFileStatus = 'Handy firmware out of date, visit www.handyfeeling.com';
					window.backgroundStatus.loadFileColor = 'red';
					break;		
			}
		}
		if ( window.backgroundStatus.paused ) window.backgroundStatus.connectionStatus += ' (paused)';
		if ( window.backgroundStatus.scriptFileName == undefined || window.backgroundStatus.scriptFileName == "" ) {
			window.backgroundStatus.scriptFileStatus = 'Select a script';
			window.backgroundStatus.scriptFileColor = 'orange';	
			} else {
			if ( window.scriptFileData && window.scriptFileData != "" ) {
				window.backgroundStatus.scriptFileStatus = 'Script ready to load';
				window.backgroundStatus.scriptFileColor = 'green';
			} else {
				window.backgroundStatus.scriptFileStatus = 'Failed to load file';
				window.backgroundStatus.scriptFileColor = 'red';		
			}
		}
		window.self.updatePopup();
	}

}

new Background();

