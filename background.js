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

		window.backgroundStatus = {
			connectionKey: undefined,
			scriptFileURL: undefined,
			handyConnected: false,
			contentScriptCount: 0,
			paused: false,
			scriptFileStatus: "",
			loadFileStatus: "Select load when ready",
			mode: -1, // These are the theoretical things the machine should be doing
			levelEntry: -1,
			level: -1,
			step: -1,
			pattern: -1,
			strokeStart: -1,
			strokeStop: -1,
			velocity: -1,
			errorMessages: [],
			offset: 0,
			patternsUrl: undefined,
		};
		
		window.sha256 = 'f10fb07e14335324f252a83545b48b9f677e5581b261f981e1734bd82a490ddf';
		window.retryAttempts = 2;
		window.KEY_serverTime = 'Get Server Time';
		window.KEY_HSSPSetup = 'Upload Patterns';
		window.KEY_getSync = 'Get Sync';
		window.KEY_HSSPStart = 'Starting Pattern';
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
			if ( message.includes('handyPause' ) ) {
				window.self.pause();
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
		});
		
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
		
		chrome.storage.onChanged.addListener(function(changes, namespace) {
			for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
				if(key === 'masterStroke') {
					window.masterStroke = newValue;
					window.self.handySetSlide(window.masterStroke.start, window.masterStroke.stop);
				}
				if(key === 'connectionKey') {
					window.backgroundStatus.connectionKey = newValue;
					window.self.checkConnected();
				}
				if(key === 'scriptFileURL') {
					window.backgroundStatus.scriptFileURL = newValue;
				}
			}
		});
		
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
		window.self.handyHSSPStart(parseInt(position) + window.syncOffset );
	}
	
	doVideoPause(parameters) {
		window.self.stopHandy();
	}
	
	doVideoSeek(parameters) {
		const vidParams = parameters.split('"');
		const position = parseFloat(vidParams[6].substr(1));
		window.self.handyHSSPState(
			function(state) {
				if ( state == 4 ) {
					window.self.handyHSSPStart(parseInt(position));
				}
			}
		);
		
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
					case window.KEY_HSSPStart:
						switch( response.result ) {
							case 0:
								console.log(requestType + ' Success');
								return true;
							break;
							case -1:
								console.log(requestType + ' Error');
								console.log(xhr);
								return false;
							break;
							default:
								console.log(requestType + ' Error');
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
						window.backgroundStatus.loadFileStatus = 'Error setting handy mode';
						window.self.updatePopup();
						window.self.addErrorMessage('Set Mode failed.');
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
	
	
	
	handyHSSPStart(time, callback, retries) {
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
				if( window.self.handyStatusHandler(xhr, KEY_HSSPStart) ) {
					if (callback && typeof(callback) === "function") {
						callback();
					}
					clearTimeout(window.patternTimeout);
					window.patternTimeout = setTimeout(window.self.handyHSSPStart, window.patternLength * 1000, time);
					// The patterns are only 60 seconds long in the pattern file, so we have to reset to the beginning every so often.
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handyHSSPStart( time, callback, retries+1 );
					} else {
						window.self.addErrorMessage('Start pattern failed.');
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
				if ( window.self.handyStatusHandler(xhr, window.KEY_getHSSPState)   ) {
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
						window.backgroundStatus.loadFileStatus = 'Upload patterns to handy failed.';
						window.self.updatePopup();
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
	
	handyGetConnected(callback) {
		var url = window.APIUrl + "/connected";
		var xhr = new XMLHttpRequest();
	
		xhr.open("GET", url);
		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		
		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				const result = window.self.handyStatusHandler(xhr, window.KEY_getConnected);
				if (callback && typeof(callback) === "function") {
					callback(result);
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
		clearTimeout(window.stepTimeout);
		clearTimeout(window.patternTimeout);
		window.xhrRequests = [];
	}


	syncPrepare(url) {
		window.self.syncServerTime();
		window.backgroundStatus.loadFileStatus = 'Preparing pattern file';
		window.self.updatePopup();
		window.self.uploadPatternFile(window.backgroundStatus.scriptFileURL,
			function() {
				window.backgroundStatus.loadFileStatus = 'Setting handy mode';
				window.self.updatePopup();
				window.self.handySetMode(1,
					function() {
						window.backgroundStatus.loadFileStatus = 'Sending pattern file to handy';
						window.self.updatePopup();
						window.self.handySetSlide(window.masterStroke.start, window.masterStroke.stop);
						window.self.handyHSSPSetup(window.backgroundStatus.patternsUrl, 
							function() {
								window.backgroundStatus.loadFileStatus = 'Handy ready to play';
								window.self.updatePopup();
							}
						);
					}
				);
			}
		);
		window.self.checkConnected();
	}

    uploadPatternFile(url, callback) {
		
		if (!url.includes('.csv') && !url.includes('.funscript') ) {
			window.backgroundStatus.scriptFileStatus = 'Invalid file type, use csv or funscript';
			window.self.updatePopup();
			return;
		}
		
		fetch( url )
		.then(
			function(response) {
			    response.text().then(function(patterns) {
					const csv = new File([patterns], 'script', { type: 'text/plain' });
					const data = new FormData();
					data.append('syncFile', csv);
					fetch('https://www.handyfeeling.com/api/sync/upload', {
						method: 'POST',
						body: data,
					})
						.then(
							function(response) {
								if (response.status !== 200) {
									window.backgroundStatus.scriptFileStatus = 'Error fetching script file';
									window.backgroundStatus.loadFileStatus = 'Press upload when ready';
									window.self.updatePopup();
									return;
								}

							// Examine the text in the response
								response.json().then(function(data) {
									if ( data.success ) {
										window.backgroundStatus.patternsUrl = data.url;
										window.backgroundStatus.scriptFileStatus = 'Success fetching script file';
										window.self.updatePopup();
										if (callback && typeof(callback) === "function") {
											callback();
										}
									} else {
										window.backgroundStatus.scriptFileStatus = 'Error fetching script file';
										window.backgroundStatus.loadFileStatus = 'Press upload when ready';
										window.self.updatePopup();
										console.log('Error uploading patterns: ' + response.status);
									}
								});
							}
						)
						.catch(function(err) {
							window.isSyncPreparing = false;
							window.backgroundStatus.scriptFileStatus = 'Error fetching script file';
							window.backgroundStatus.loadFileStatus = 'Press upload when ready';
							window.self.updatePopup();
							console.log('Fetch Error :-S', err);
						});
							});
						}
					)
		.catch(function(err) {
			window.backgroundStatus.scriptFileStatus = 'Error fetching script file';
			window.backgroundStatus.loadFileStatus = 'Press upload when ready';
			window.self.updatePopup();
			console.log('Fetch Error :-S', err);
		});
    }
	
	stopHandy() {
		window.self.cancelCurrentRequests();
		window.self.handyStopHSSP();
	}
	
	pause() {
		// This is a pause in the extension
		window.backgroundStatus.paused = !window.backgroundStatus.paused;
		window.self.updatePopup();
		if ( window.backgroundStatus.paused ) {
			window.self.stopHandy();
		} else {
			// Something about resuming play, if we keep the pause function

		}
		// window.self.sendMessageToContent( { "updatePopup": window.backgroundStatus } );
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
		window.self.checkConnected();
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
			window.self.updatePopup();
		});
	}
}

new Background();


chrome.runtime.onInstalled.addListener(() => {
	// ver. 0.1の時に使っていたlocalStorageの削除
	// Remove localStorage data that is used by extension ver. 0.1.
	localStorage.clear();

	// 読み込み/更新時に既存のタブで実行する
	// Execute content scripts for existing tabs when extension installed/reloaded.
	chrome.tabs.query({
		url: '*://twoseven.xyz/*',
	}, tabs => {
		tabs.forEach(tab => {
			chrome.tabs.executeScript(tab.id, {
				file: 'content_script.js',
				allFrames: true,
			}, result => {
				if (typeof result === 'undefined') {
					const message = chrome.i18n.getMessage('page_not_loaded');
					console.info(message, tab);
				}
			});
		});
	});
});
