const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 8080;

let db;

async function connectDB() {
  db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'DogWalkService'
  });
}

// Insert sample records on startup (if needed)
async function insertTestData() {
  try {
    await db.execute(`INSERT IGNORE INTO Users (user_id, username, email, password_hash, role) VALUES
      (1, 'alice123', 'alice@example.com', 'hashed123', 'owner'),
      (2, 'bobwalker', 'bob@example.com', 'hashed456', 'walker')`);
    await db.execute(`INSERT IGNORE INTO Dogs (dog_id, owner_id, name, size) VALUES
      (1, 1, 'Max', 'medium')`);
    await db.execute(`INSERT IGNORE INTO WalkRequests (request_id, dog_id, requested_time, duration_minutes, location, status) VALUES
      (1, 1, '2025-06-10 08:00:00', 30, 'Parklands', 'open')`);
  } catch (err) {
    console.error("Test data insert error:", err);
  }
}

// Route: /api/dogs
app.get('/api/dogs', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT d.name AS dog_name, d.size, u.username AS owner_username
      FROM Dogs d
      JOIN Users u ON d.owner_id = u.user_id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve dogs." });
  }
});

// Route: /api/walkrequests/open
app.get('/api/walkrequests/open', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT wr.request_id, d.name AS dog_name, wr.requested_time, wr.duration_minutes, wr.location, u.username AS owner_username
      FROM WalkRequests wr
      JOIN Dogs d ON wr.dog_id = d.dog_id
      JOIN Users u ON d.owner_id = u.user_id
      WHERE wr.status = 'open'
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve open walk requests." });
  }
});

// Route: /api/walkers/summary
app.get('/api/walkers/summary', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT u.username AS walker_username,
        COUNT(wr.request_id) AS completed_walks,
        COUNT(wr2.rating_id) AS total_ratings,
        ROUND(AVG(wr2.rating), 1) AS average_rating
      FROM Users u
      LEFT JOIN WalkApplications wa ON u.user_id = wa.walker_id
      LEFT JOIN WalkRequests wr ON wa.request_id = wr.request_id AND wr.status = 'completed'
      LEFT JOIN WalkRatings wr2 ON wa.request_id = wr2.request_id
      WHERE u.role = 'walker'
      GROUP BY u.username
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve walker summary." });
  }
});

async function startServer() {
  try {
    await connectDB();
    await insertTestData();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error("Startup error:", err);
  }
}

startServer();
