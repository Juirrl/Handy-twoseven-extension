class Popup {

    constructor() {
		
		var self = this;
		window.self = this;
		
		this.backgroundScript = chrome.extension.getBackgroundPage();
		
		var strokeSliderStyle = {
			skin: "sharp",
			force_edges: true,
			postfix: "%",
			type: "double",
			min: 0,
			max: 100,
			step: 1,
			min_interval: 10,
			decorate_both: false,
			grid: false,
			onFinish: function (data) {
				self.updateStroke(data);
			},
		};
		
		var syncSliderStyle = {
			skin: "sharp",
			force_edges: true,
			postfix: "ms",
			type: "single",
			min: -500,
			max: 500,
			step: 1,
			min_interval: 10,
			decorate_both: false,
			grid: false,
			onFinish: function (data) {
				self.updateSync(data);
			},
		};
		
		$("#masterStrokeSlider").ionRangeSlider(strokeSliderStyle);
		$("#syncOffsetSlider").ionRangeSlider(syncSliderStyle);
	
		chrome.storage.sync.get(['connectionKey'], function(result) {
			if ( !chrome.runtime.error && result != null && result.connectionKey != undefined) this.connectionKeyTextField.value = result.connectionKey;
		});
		
		chrome.storage.sync.get(['scriptFileURL'], function(result) {
			if ( !chrome.runtime.error && result != null && result.scriptFileURL != undefined) this.scriptFileURLTextField.value = result.scriptFileURL;
		});


        $("#connectionKeyTextField").on("change", () => {
            this.setConnectionKey($("#connectionKeyTextField").val() );
        });
		
		$("#scriptFileURLTextField").on("change", () => {
            this.setScriptFileURL($("#scriptFileURLTextField").val() );
        });
		
		
		/* This button doesn't exist atm
		$("#handyPauseButton").bind("click", () => {
            chrome.runtime.sendMessage( [ "handyPause" ] );
        });
		*/
		
		$("#handyUploadScriptButton").bind("click", () => {
            chrome.runtime.sendMessage( [ "handyUploadScript" ] );
        });
		
		chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
			if ( message.includes('update_popup') ) {
				this.updatePopup(message[1]);
			}
		});
		
		this.getSliderValues();

        chrome.runtime.sendMessage( [ "updatePopupRequest" ] );
    }
	
	/*
	updatePauseButton() {
		if ( this.backgroundScript.backgroundStatus.paused ) {
			$("#handyPauseButton").html('Unpause');
		} else {
			$("#handyPauseButton").html('Pause');
		}
    }
	*/

    updatePopup(data) {
		var connectionNode = $('#connectionStatusText');
		if ( connectionNode != null ) {
			if ( data.handyConnected ) {
				connectionNode.text('Connected');
				connectionNode.css("color", "green");
			} else {
				connectionNode.text('Not Connected');
				connectionNode.css("color", "red");

			}
		}
		connectionNode = null;
		connectionNode = $('#scriptFileStatusText');
		if ( connectionNode != null ) {
			connectionNode.text(data.scriptFileStatus);
		}
		connectionNode = null;
		connectionNode = $('#loadFileStatusText');
		if ( connectionNode != null ) {
			connectionNode.text(data.loadFileStatus);
		}
    }
	
	 setConnectionKey(connectionKey) {
		chrome.storage.sync.set( { 'connectionKey': connectionKey } );
    }

    setScriptFileURL(url) {
		chrome.storage.sync.set( { 'scriptFileURL': url } );
    }
	
	getSliderValues() {
		chrome.storage.sync.get(['masterStroke'], function(result) {
			if ( !chrome.runtime.error && result != null && result.masterStroke != undefined) {
				var masterStroke = result.masterStroke;
				$("#masterStrokeSlider").data("ionRangeSlider").update({ from: masterStroke.start , to: masterStroke.stop});
			} else {
				chrome.extension.getBackgroundPage().console.log('Error, master stroke not found');
			}
			
		});
		chrome.storage.sync.get(['syncOffset'], function(result) {
			if ( !chrome.runtime.error && result != null && result.syncOffset != undefined) {
				$("#syncOffsetSlider").data("ionRangeSlider").update({ from: result.syncOffset });
			} else {
				chrome.extension.getBackgroundPage().console.log('Error, Sync offset not found');
			}
		});
	}
	
	updateStroke(data) {
		chrome.storage.sync.set( { 'masterStroke': { start: data.from, stop: data.to } } );
	}
	
	updateSync(data) {
		chrome.storage.sync.set( { 'syncOffset': data.from } );
	}
	
}

new Popup();