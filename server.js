const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const User = require("./models/User");
const Vote = require("./models/Vote");
const Candidate = require("./models/Candidate");

const app = express();
app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

/* ===========================
   LOGIN
=========================== */
app.post("/login", async (req, res) => {
  const { username } = req.body;

  const user = await User.findOne({ username });

  if (!user) return res.status(400).json({ message: "User not found" });

  res.json(user);
});

/* ===========================
   GET CANDIDATES
=========================== */
app.get("/candidates", async (req, res) => {
  const candidates = await Candidate.find();
  res.json(candidates);
});

/* ===========================
   CAST VOTE
=========================== */
app.post("/vote", async (req, res) => {
  const { username, position, candidate } = req.body;

  const existingVote = await Vote.findOne({ username, position });

  if (existingVote)
    return res.status(400).json({ message: "Already voted for this position" });

  const vote = new Vote({ username, position, candidate });
  await vote.save();

  res.json({ message: "Vote casted successfully" });
});

/* ===========================
   GET RESULTS
=========================== */
app.get("/results", async (req, res) => {
  const votes = await Vote.find();

  const results = {};

  votes.forEach((vote) => {
    if (!results[vote.position]) results[vote.position] = {};
    if (!results[vote.position][vote.candidate])
      results[vote.position][vote.candidate] = 0;

    results[vote.position][vote.candidate]++;
  });

  res.json(results);
});

/* ===========================
   ADMIN - REMOVE VOTE
=========================== */
app.delete("/vote/:id", async (req, res) => {
  await Vote.findByIdAndDelete(req.params.id);
  res.json({ message: "Vote removed" });
});

/* ===========================
   ADMIN - USER MANAGEMENT
=========================== */

// Get users
app.get("/users", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// Add user
app.post("/users", async (req, res) => {
  const user = new User(req.body);
  await user.save();
  res.json(user);
});

// Edit user
app.put("/users/:id", async (req, res) => {
  const updated = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  res.json(updated);
});

// Delete user
app.delete("/users/:id", async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ message: "User deleted" });
});

app.listen(5000, () => console.log("Server running on port 5000"));
