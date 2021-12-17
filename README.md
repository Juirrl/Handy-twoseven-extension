# Handy Chaturbate Extension

Handy Chaturbate Extension is a chrome extension that will control the handy sex toy through chaturbate tips.

## Installation

Download the project to your local drive. Then open manage extensions in chrome. Select load unpacked and choose the location of the package.  
There are no plans to submit this extension for approval in the chrome store.  
  
Your handy must be updated to FW3. At this time that firmware is a beta, so you must manually update. It is expected to be the standard firmware soon.  

## Usage

Close any chaturbate broadcast windows after installation. Open the extensions popup and enter your handy's connection key, then select save.  
Open chaturbate, or the chaturbate test bed, and select broadcast yourself. An overlay should appear in the top left of the window showing the status of the extension.  
  
The first four lines of the overlay, Handy Status, Chatbox, Debug mode, and Sync Status, must be green.  
Handy Status: Make sure your handy is connected, it is in wifi mode, and you have entered the correct connection key.  
Chatbox: If not detected reload your broadcast page. If you have multiple broadcast tabs open close the extra ones.  
Debug Mode: The app listens for debug messages in the chaturbate chat window. If debug mode is off type /debug. The app will attempt to turn on debug mode when a new broadcast tab is opened.  
Sync status: The app uploads a pattern file to the handy server and syncs the server time on startup. If the sync did not work check your connection status, open the popup, and click sync.  
  
Action: Shows what command was last sent to the handy.  
Error Messages: Displays any error messages in communicating with the handy server. A few error messages are normal, the app will attempt to resend the failed command. If frequent error messages occur check your connection.  
  
You will need a chaturbate app or bot to track tips and send commands to the handy.  
Commands must be sent with the cb.log command.  
Valid commands are:  
Handy:Stop  
Handy:Set Level:[0-7]  
Handy:Set Pattern:["Head tease", "Fast down, slow up", "Slow down, fast up", "Alternating top & bottom", "Alternating speed", "Alternating long and short", "Gradually stroke longer and shorter", "Gradually speed up and slow down"]  
  
An example app should be in the chaturbate system, search for handy.

## Known Issues

There is a pause while switching between modes, IE going from stready strokes to a pattern or vice versa. This is a limitation in the current handy firmware. As a result the example app on chaturbate no longer uses patterns.
There is no option to add your own patterns since the SHA256 key for the pattern file is hard coded into the extension.  
There's no off switch. Currently when you run chrome with the extension installed it syncs the server time and uploads the pattern script, then constantly pings the status of your handy whether you intend to use it or not.

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.


## License
[GNU GPLv3](https://choosealicense.com/licenses/gpl-3.0/)