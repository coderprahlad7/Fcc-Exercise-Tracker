const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static("public"));

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_DB_PROD_URI)
  .then(() => console.log("Database connected!"))
  .catch(err => console.error("Database connection error:", err));

// Serve the homepage
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

// Define Schemas
const exerciseSessionSchema = new mongoose.Schema({
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: String },
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  log: [exerciseSessionSchema],
});

// Define Models
const User = mongoose.model("User", userSchema);
const Session = mongoose.model("Session", exerciseSessionSchema);

// Create a new user
app.post("/api/users", async (req, res) => {
  try {
    const newUser = new User({ username: req.body.username });
    const savedUser = await newUser.save();
    res.json({ username: savedUser.username, _id: savedUser._id });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Unable to create user" });
  }
});

// Get all users
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Unable to fetch users" });
  }
});

// Add an exercise session to a user
app.post("/api/users/:_id/exercises", async (req, res) => {
  try {
    const userId = req.params._id;
    const { description, duration, date } = req.body;

    const newSession = {
      description,
      duration: parseInt(duration),
      date: date ? new Date(date).toDateString() : new Date().toDateString(),
    };

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $push: { log: newSession } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      _id: updatedUser._id,
      username: updatedUser.username,
      description: newSession.description,
      duration: newSession.duration,
      date: newSession.date,
    });
  } catch (error) {
    console.error("Error adding exercise:", error);
    res.status(500).json({ error: "Unable to add exercise" });
  }
});

// Get a user's exercise log
app.get("/api/users/:_id/logs", async (req, res) => {
  try {
    const user = await User.findById(req.params._id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let responseObject = {
      _id: user._id,
      username: user.username,
      log: user.log.map(session => ({
        description: session.description,
        duration: session.duration,
        date: new Date(session.date).toDateString(),
      })),
    };

    if (req.query.from || req.query.to) {
      const fromDate = req.query.from
        ? new Date(req.query.from).getTime()
        : new Date(0).getTime();
      const toDate = req.query.to
        ? new Date(req.query.to).getTime()
        : new Date().getTime();

      responseObject.log = responseObject.log.filter(session => {
        const sessionDate = new Date(session.date).getTime();
        return sessionDate >= fromDate && sessionDate <= toDate;
      });
    }

    if (req.query.limit) {
      responseObject.log = responseObject.log.slice(
        0,
        parseInt(req.query.limit)
      );
    }

    responseObject.count = responseObject.log.length;

    res.json(responseObject);
  } catch (error) {
    console.error("Error retrieving logs:", error);
    res.status(500).json({ error: "Unable to retrieve logs" });
  }
});

// Start the server
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
