const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const User = require("./models/User");
const Vote = require("./models/Vote");
const Candidate = require("./models/Candidate");
const VotingState = require("./models/VoteState");

const app = express();
app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("MongoDB Error:", err));

const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 5000;

// PASSWORD GENERATOR
function generatePassword(length = 14) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// LOGIN
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({
      username: username.toUpperCase(),
    });

    if (!user) return res.status(400).json({ message: "User not found" });

    if (password !== user.password)
      return res.status(400).json({ message: "Invalid password" });

    res.json({
      _id: user._id,
      username: user.username,
      role: user.role,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// CANDIDATES
app.get("/candidates", async (req, res) => {
  const candidates = await Candidate.find();
  res.json(candidates);
});

// VOTING STATUS

app.get("/voting-status", async (req, res) => {
  const state = await VotingState.findOne();

  if (!state || !state.votingActive) {
    return res.json({
      votingActive: false,
      endTime: null
    });
  }

  const remaining = state.endTime - Date.now();

  if (remaining <= 0) {
    state.votingActive = false;
    state.endTime = null;
    await state.save();

    return res.json({
      votingActive: false,
      endTime: null
    });
  }

  res.json({
    votingActive: true,
    endTime: state.endTime // ✅ send timestamp
  });
});

// START VOTING
app.post("/start-voting", async (req, res) => {
  const { duration } = req.body;

  const endTime = Date.now() + duration * 1000;

  let state = await VotingState.findOne();
  if (!state) state = new VotingState();

  state.votingActive = true;
  state.endTime = endTime;

  await state.save();

  // 🔥 Emit to all clients
  io.emit("voting-status", {
    votingActive: true,
    endTime: endTime
  });

  res.json({ message: "Voting started successfully" });
});

// STOP VOTING
app.post("/stop-voting", async (req, res) => {
  const state = await VotingState.findOne();

  if (!state || !state.votingActive)
    return res.status(400).json({ message: "Voting is not active" });

  state.votingActive = false;
  state.endTime = null;
  await state.save();

  // 🔥 Emit to all clients
  io.emit("voting-ended");

  res.json({ message: "Voting stopped successfully" });
});

// CAST VOTE
app.post("/vote", async (req, res) => {
  const { username, position, candidate } = req.body;

  const state = await VotingState.findOne();

  if (!state || !state.votingActive || state.endTime < Date.now()) {
    return res.status(400).json({ message: "Voting is not active" });
  }

  const existingVote = await Vote.findOne({ username, position });
  if (existingVote)
    return res.status(400).json({ message: "Already voted for this position" });

  const vote = new Vote({ username, position, candidate });
  await vote.save();

  res.json({ message: "Vote casted successfully" });
});

// GET RESULTS
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

// USER MANAGEMENT
app.get("/users", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// CREATE USER
app.post("/users", async (req, res) => {
  const { username, role } = req.body;

  const existingUser = await User.findOne({
    username: username.toUpperCase(),
  });

  if (existingUser)
    return res.status(400).json({ message: "User already exists" });

  const plainPassword = generatePassword();

  const newUser = new User({
    username: username.toUpperCase(),
    password: plainPassword,
    role: role || "voter",
  });

  await newUser.save();

  res.json({
    message: "User created successfully",
    generatedPassword: plainPassword,
  });
});

// DELETE USER
app.delete("/users/:id", async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ message: "User deleted" });
});

// START SERVER
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
