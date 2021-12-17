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
		

		for ( var i = 0; i <= this.levels-1 ; i++ ) {
			$("#level"+i+"StrokeSlider").ionRangeSlider(strokeSliderStyle);
			$("#level"+i+"SpeedSlider").ionRangeSlider(speedSliderStyle);
			this.levelTracker[i] = [0];
			if ( $("#level"+i+"right").length ) $("#level"+i+"right").click(i, function(i) {
					self.rightButtonClick(i);
				});
			if ( $("#level"+i+"left").length ) $("#level"+i+"left").click(i, function(i) {
					self.leftButtonClick(i);
				});
				
			if ( $("#level"+i+"NoteTextField").length ) $("#level"+i+"NoteTextField").on('input', function() {
					self.onNoteChange();
				});
			if ($("#level"+i+"DelaySlider").length)	$("#level"+i+"DelaySlider").ionRangeSlider(delaySliderStyle);
		}
		$("#masterStrokeSlider").ionRangeSlider(strokeSliderStyle);
		

	
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
		
		chrome.runtime.onMessage.addListener(function(message, messageSender, sendResponse) {
			if ( message.includes('update_popup' ) ) {
				self.updatePopup();
			}
		});

        this.updatePopup();
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

    updatePopup() {
        // this.updatePauseButton();
    }
	
	 setConnectionKey(connectionKey) {
		chrome.storage.sync.set( { 'connectionKey': connectionKey } );
    }

    setScriptFileURL(url) {
		chrome.storage.sync.set( { 'scriptFileURL': url } );
    }
	
	getMasterStroke() {
		chrome.storage.sync.get(['masterStroke'], function(result) {
			if ( !chrome.runtime.error && result != null && result.masterStroke != undefined) {
				var masterStroke = result.masterStroke;
				$("#masterStrokeSlider").data("ionRangeSlider").update({ from: masterStroke.strokeStart , to: masterStroke.strokeStop});
			} else {
				chrome.extension.getBackgroundPage().console.log('Error, master stroke not found');
			}
			
		});
	}
	
	updateStroke(data) {
		var index = data.input[0].name;
		if ( index == "master" ) {
			var masterStroke =  { strokeStart: data.from, strokeStop: data.to };
			chrome.storage.sync.set( { 'masterStroke': masterStroke } );
			return;
		}
	}
	
}

new Popup();