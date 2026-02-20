const mongoose = require("mongoose");

const voteSchema = new mongoose.Schema({
  username: String,
  position: String,
  candidate: String
});

module.exports = mongoose.model("Vote", voteSchema);