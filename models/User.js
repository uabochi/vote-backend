const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  role: { type: String, default: "voter" } // admin or voter
});

module.exports = mongoose.model("User", userSchema);