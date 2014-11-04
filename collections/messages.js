Messages = new Meteor.Collection('messages');

Meteor.methods({
    'message': function (messageStub) {
        user = Meteor.user();
        room = Rooms.findOne(messageStub.roomId);

        if (!user)
            throw new Meteor.Error(401, "You need to login to send messages");
        if (!messageStub.message) //TODO: Empty Stringss
            throw new Meteor.Error(401, "You must specify a message");
        if (!room)
            throw new Meteor.Error(401, "You must specify a valid room");
        if (room.isPrivate === true && !_.contains(room.invited, user._id))
            throw new Meteor.Error(401, "You must be invited to send a message to this room.");

        // Process commands
        if (messageStub.message[0] == '/') {
            return processCommand({message: messageStub.message, room: room});
        }

        // Create regular message
        var timestamp = new Date().getTime();
        message = {
            authorId: user._id,
            roomId: room._id,
            timestamp: timestamp,
            type: "plain",
            message: messageStub.message
        };
        var messageId = Messages.insert(message);

        // Create content message
        contentMessage = runContentProcessors(messageStub);
        if (contentMessage) {
            var richMessage = {
                authorId: user._id,
                roomId: room._id,
                timestamp: timestamp + 1,
                type: "rich",
                layout: contentMessage.layout,
                data: contentMessage.data
            };
            Messages.insert(richMessage);
        }

        if(Meteor.isServer) {
            // Check for mentions
            var roomUsers = Meteor.users.find({_id: {$in: room.users}}); // TODO: Remove the need to query this
            roomUsers.forEach(function (user) {
                //TODO: self-check: if(user._id == message.authorId) return;
                if (message.message.indexOf(user.username) > -1) { // TODO: should be tokenized name either " name " or "@user"
                    var notification = {
                        authorId: message.authorId,
                        roomId: room._id,
                        messageId: messageId,
                        userId: user._id,
                        seen: false,
                        // Properties needed for sending a summary
                        timestamp: message.timestamp,
                        message: message.message,
                        roomName: room.name,
                        userName: user.username
                    };
                    Notifications.insert(notification);

                    if (user.profile && user.profile.number) {
                        smsBody = notification.userName + ': ' + notification.message + ' #' + notification.roomName;

                        try {
                            var twilio = Meteor.npmRequire('twilio')('AC370ea0996237c09f9dfdfc36d4c08e63', 'd1c6df072dbe1fe7279cd6a951fcab5a');
                            twilio.sendMessage({
                                to: user.profile.number, // Any number Twilio can deliver to
                                from: '+14259678789', // A number you bought from Twilio and can use for outbound communication
                                body: smsBody// body of the SMS message
                            }, function (err, responseData) { //this function is executed when a response is received from Twilio
                                if (!err) { // "err" is an error received during the request, if any
                                    // "responseData" is a JavaScript object containing data received from Twilio.
                                    // A sample response from sending an SMS message is here (click "JSON" to see how the data appears in JavaScript):
                                    // http://www.twilio.com/docs/api/rest/sending-sms#example-1
                                    console.log(responseData.from); // outputs "+14506667788"
                                    console.log(responseData.body); // outputs "word to your mother."
                                }
                            });
                        }
                        catch (e) {
                            console.log(e);
                        }
                    }
                }
            });
        }
        return messageId; // Why, not used...
    }
});
function runContentProcessors(messageStub) {
    for (var i = 0; i < contentProcessors.length; i++) {
        processor = contentProcessors[i];
        match = processor.regex.exec(messageStub.message);
        if (match) {
            var returnval = processor.execute(match);
            return returnval;
        }
    }
}
var contentProcessors = [
    {
        name: "Image Processor",
        regex: /(?:([^:/?#]+):)?(?:\/\/([^/?#]*))?([^?#]*\.(?:jpg|gif|png))(?:\?([^#]*))?(?:#(.*))?/,   //From http://stackoverflow.com/questions/169625/regex-to-check-if-valid-url-that-ends-in-jpg-png-or-gif
        execute: function (regexMatch) {
            return {
                layout: "image",
                data: regexMatch[0]
            };
        }
    }
];

