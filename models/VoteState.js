const mongoose = require("mongoose");

const votingStateSchema = new mongoose.Schema({
  votingActive: { type: Boolean, default: false },
  endTime: { type: Number, default: 0 }, // timestamp
});

module.exports = mongoose.model("VotingState", votingStateSchema);
