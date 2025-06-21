const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 8080;

let db;

// Connect to DB
async function connectDB() {
  db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'DogWalkService'
  });
  console.log("Connected to MySQL");
}

// Seed test data
async function seedData() {
  try {
    // Clean tables
    await db.execute(`DELETE FROM WalkApplications`);
    await db.execute(`DELETE FROM WalkRatings`);
    await db.execute(`DELETE FROM WalkRequests`);
    await db.execute(`DELETE FROM Dogs`);
    await db.execute(`DELETE FROM Users`);

    // Users
    await db.execute(`
      INSERT INTO Users (username, email, password_hash, role) VALUES
      ('alice123', 'alice@example.com', 'hashed123', 'owner'),
      ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
      ('carol123', 'carol@example.com', 'hashed789', 'owner'),
      ('sam36', 'sam@example.com', 'hashed000', 'walker'),
      ('emily99', 'emily@example.com', 'hashed321', 'owner')
    `);

    // Dogs
    await db.execute(`
      INSERT INTO Dogs (owner_id, name, size) VALUES
      ((SELECT user_id FROM Users WHERE username = 'alice123'), 'Max', 'medium'),
      ((SELECT user_id FROM Users WHERE username = 'carol123'), 'Bella', 'small'),
      ((SELECT user_id FROM Users WHERE username = 'alice123'), 'Ben', 'large'),
      ((SELECT user_id FROM Users WHERE username = 'carol123'), 'Luna', 'medium'),
      ((SELECT user_id FROM Users WHERE username = 'emily99'), 'Cooper', 'small')
    `);

    // WalkRequests
    await db.execute(`
      INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status) VALUES
      ((SELECT dog_id FROM Dogs WHERE name = 'Max'), '2025-06-10 08:00:00', 30, 'Parklands', 'open'),
      ((SELECT dog_id FROM Dogs WHERE name = 'Bella'), '2025-06-10 09:30:00', 45, 'Beachside Ave', 'accepted'),
      ((SELECT dog_id FROM Dogs WHERE name = 'Ben'), '2025-06-11 11:00:00', 60, 'City Garden', 'open'),
      ((SELECT dog_id FROM Dogs WHERE name = 'Luna'), '2025-06-12 07:30:00', 30, 'Riverside Trail', 'completed'),
      ((SELECT dog_id FROM Dogs WHERE name = 'Cooper'), '2025-06-13 15:00:00', 25, 'Prospect Park', 'completed')
    `);

    // WalkApplications
    await db.execute(`
      INSERT INTO WalkApplications (walker_id, request_id, status) VALUES
      ((SELECT user_id FROM Users WHERE username = 'bobwalker'),
       (SELECT request_id FROM WalkRequests WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name = 'Max')), 'accepted'),
      ((SELECT user_id FROM Users WHERE username = 'sam36'),
       (SELECT request_id FROM WalkRequests WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name = 'Luna')), 'completed'),
      ((SELECT user_id FROM Users WHERE username = 'bobwalker'),
       (SELECT request_id FROM WalkRequests WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name = 'Cooper')), 'completed')
    `);

    // WalkRatings
    await db.execute(`
      INSERT INTO WalkRatings (request_id, rating) VALUES
      ((SELECT request_id FROM WalkRequests WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name = 'Luna')), 5),
      ((SELECT request_id FROM WalkRequests WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name = 'Cooper')), 4)
    `);

    console.log("Seed data inserted");
  } catch (err) {
    console.error("Seeding error:", err);
  }
}

// /api/dogs
app.get('/api/dogs', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT d.name AS dog_name, d.size, u.username AS owner_username
      FROM Dogs d
      JOIN Users u ON d.owner_id = u.user_id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve dogs' });
  }
});

// /api/walkrequests/open
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
    res.status(500).json({ error: 'Failed to retrieve open walk requests' });
  }
});

// /api/walkers/summary
app.get('/api/walkers/summary', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT u.username AS walker_username,
             COUNT(DISTINCT wr2.rating_id) AS total_ratings,
             ROUND(AVG(wr2.rating),1) AS average_rating,
             COUNT(DISTINCT wr.request_id) AS completed_walks
      FROM Users u
      LEFT JOIN WalkApplications wa ON u.user_id = wa.walker_id
      LEFT JOIN WalkRequests wr ON wa.request_id = wr.request_id AND wr.status = 'completed'
      LEFT JOIN WalkRatings wr2 ON wr.request_id = wr2.request_id
      WHERE u.role = 'walker'
      GROUP BY u.username
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve walker summary' });
  }
});

// Start server
async function startServer() {
  try {
    await connectDB();
    await seedData();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
  }
}

startServer();
