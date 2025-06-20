const express = require('express');
const mysql = require('mysql2/promise');
const app = express();
const PORT = 8080;

let connection;

// Connect to MySQL
async function initDB() {
  connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', // adjust if needed
    database: 'DogWalkService'
  });
  console.log('Connected to MySQL');
}

// Seed test data
async function seedData() {
  try {
    // Clear and reset the data
    await connection.query('DELETE FROM WalkRatings');
    await connection.query('DELETE FROM WalkApplications');
    await connection.query('DELETE FROM WalkRequests');
    await connection.query('DELETE FROM Dogs');
    await connection.query('DELETE FROM Users');

    // Insert Users
    await connection.query(`
      INSERT INTO Users (username, email, password_hash, role) VALUES
      ('alice123', 'alice@example.com', 'pass', 'owner'),
      ('carol123', 'carol@example.com', 'pass', 'owner'),
      ('bobwalker', 'bob@example.com', 'pass', 'walker'),
      ('newwalker', 'new@example.com', 'pass', 'walker')
    `);

    // Insert Dogs
    await connection.query(`
      INSERT INTO Dogs (owner_id, name, size) VALUES
      ((SELECT user_id FROM Users WHERE username='alice123'), 'Max', 'medium'),
      ((SELECT user_id FROM Users WHERE username='carol123'), 'Bella', 'small')
    `);

    // Insert WalkRequests
    await connection.query(`
      INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status) VALUES
      ((SELECT dog_id FROM Dogs WHERE name='Max'), '2025-06-10 08:00:00', 30, 'Parklands', 'open')
    `);

    // Insert WalkApplications
    await connection.query(`
      INSERT INTO WalkApplications (request_id, walker_id, status) VALUES
      (1, (SELECT user_id FROM Users WHERE username='bobwalker'), 'accepted')
    `);

    // Insert WalkRatings
    await connection.query(`
      INSERT INTO WalkRatings (request_id, walker_id, owner_id, rating, comments) VALUES
      (1,
       (SELECT user_id FROM Users WHERE username='bobwalker'),
       (SELECT user_id FROM Users WHERE username='alice123'),
       5,
       'Great walk!')
    `);
  } catch (err) {
    console.error('Error seeding data:', err);
    throw err;
  }
}

// API Routes

// 1. /api/dogs
app.get('/api/dogs', async (req, res) => {
  try {
    const [rows] = await connection.query(`
      SELECT d.name AS dog_name, d.size, u.username AS owner_username
      FROM Dogs d
      JOIN Users u ON d.owner_id = u.user_id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dogs' });
  }
});

// 2. /api/walkrequests/open
app.get('/api/walkrequests/open', async (req, res) => {
  try {
    const [rows] = await connection.query(`
      SELECT
        wr.request_id,
        d.name AS dog_name,
        wr.requested_time,
        wr.duration_minutes,
        wr.location,
        u.username AS owner_username
      FROM WalkRequests wr
      JOIN Dogs d ON wr.dog_id = d.dog_id
      JOIN Users u ON d.owner_id = u.user_id
      WHERE wr.status = 'open'
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch open walk requests' });
  }
});

// 3. /api/walkers/summary
app.get('/api/walkers/summary', async (req, res) => {
  try {
    const [rows] = await connection.query(`
      SELECT
        u.username AS walker_username,
        COUNT(r.rating_id) AS total_ratings,
        ROUND(AVG(r.rating), 1) AS average_rating,
        COUNT(DISTINCT a.request_id) AS completed_walks
      FROM Users u
      LEFT JOIN WalkApplications a ON a.walker_id = u.user_id AND a.status = 'accepted'
      LEFT JOIN WalkRatings r ON r.walker_id = u.user_id
      WHERE u.role = 'walker'
      GROUP BY u.user_id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch walker summary' });
  }
});

// Start server
async function startServer() {
  try {
    await initDB();
    await seedData();
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err);
  }
}

startServer();
