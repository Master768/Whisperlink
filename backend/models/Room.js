const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    secretPhrase: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastActive: {
        type: Date,
        default: Date.now,
        index: { expires: 3600 } // TTL index for 1 hour (3600 seconds)
    }
});

// Update lastActive whenever room is accessed or a message is sent
roomSchema.methods.updateActivity = function () {
    this.lastActive = Date.now();
    return this.save();
};

module.exports = mongoose.model('Room', roomSchema);
