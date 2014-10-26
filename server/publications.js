Meteor.publish('messages', function (roomId,limit) {
    return Messages.find({roomId:roomId},{limit:limit,sort:{timestamp:-1}});
});
Meteor.publish('currentRooms', function (ids){
    return Rooms.find();// TODO Fix
});
Meteor.publish('availableRooms', function () {
    return Rooms.find({$or: [{isPrivate: false}, {isPrivate: true,invited:this.userId}]});
});
Meteor.publish('users',function(){
   return Meteor.users.find({},{fields:{_id:1,username:1,profile:1}});
});