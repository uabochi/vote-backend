const mongoose = require("mongoose");

const candidateSchema = new mongoose.Schema({
  position: String,
  candidates: [String]
});

module.exports = mongoose.model("Candidate", candidateSchema);