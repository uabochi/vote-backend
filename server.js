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

const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 5000;

// ================= VOTING SESSION CONTROL =================
let votingActive = false;
let countdown = 0;
let timerInterval = null;

// GENERATE PASSWORD
function generatePassword(length = 14) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+";

  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return password;
}

/* ===========================
   LOGIN
=========================== */
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    const user = await User.findOne({
      username: username.toUpperCase(),
    });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (password !== user.password) {
      return res.status(400).json({ message: "Invalid password" });
    }

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

/* ===========================
   GET CANDIDATES
=========================== */
app.get("/candidates", async (req, res) => {
  const candidates = await Candidate.find();
  res.json(candidates);
});

/* ==============================
   CHECK IF ALREADY VOTED FOR POSITION
================================= */
app.get("/vote-check", async (req, res) => {
  const { username, position } = req.query;

  try {
    const vote = await Vote.findOne({ username, position });
    res.json({ voted: !!vote }); // true if vote exists, false otherwise
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ===========================
   CAST VOTE
=========================== */
app.post("/vote", async (req, res) => {
  if (!votingActive) {
    return res.status(400).json({ message: "Voting is not active" });
  }

  const { username, position, candidate } = req.body;

  const existingVote = await Vote.findOne({ username, position });

  if (existingVote)
    return res.status(400).json({ message: "Already voted for this position" });

  const vote = new Vote({ username, position, candidate });
  await vote.save();

  // Emit real-time update
  const votes = await Vote.find();
  io.emit("voteUpdated", votes);

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

  // Emit real-time update
  const votes = await Vote.find();
  io.emit("voteUpdated", votes);

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

// Create user
app.post("/users", async (req, res) => {
  try {
    const { username, role } = req.body;

    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      username: username.toUpperCase(),
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Generate password
    const plainPassword = generatePassword();

    // Create user
    const newUser = new User({
      username: username.toUpperCase(),
      password: plainPassword,
      role: role || "voter",
    });

    await newUser.save();

    res.json({
      message: "User created successfully",
      generatedPassword: plainPassword, // send only once
    });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
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

// Start voting with timer
app.post("/start-voting", (req, res) => {
  const { duration } = req.body; // duration in seconds

  if (votingActive) {
    return res.status(400).json({ message: "Voting already active" });
  }

  votingActive = true;
  countdown = duration;

  io.emit("voting-status", { votingActive, countdown });

  timerInterval = setInterval(() => {
    countdown--;

    io.emit("timer-update", { countdown });

    if (countdown <= 0) {
      clearInterval(timerInterval);
      votingActive = false;
      io.emit("voting-ended");
    }
  }, 1000);

  res.json({ message: "Voting started" });
});

// Stop voting
app.post("/stop-voting", (req, res) => {

  if (!votingActive) {
    return res.status(400).json({ message: "Voting is not active" });
  }

  // Stop the timer
  clearInterval(timerInterval);

  // Reset values
  votingActive = false;
  countdown = 0;

  // Notify all connected clients
  io.emit("voting-status", { votingActive, countdown });
  io.emit("voting-ended");

  res.json({ message: "Voting stopped successfully" });
});

// Get current voting state
app.get("/voting-status", (req, res) => {
  res.json({
    votingActive,
    countdown,
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
