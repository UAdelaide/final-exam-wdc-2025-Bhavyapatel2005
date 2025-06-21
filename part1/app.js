const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 8080;
let db;

// DB Connect
async function connectDB() {
  db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'DogWalkService'
  });
  console.log("Connected to MySQL");
}

// SEED Data (optional to comment out later)
async function seedData() {
  try {
    // your seedData block (same as before) ...
    console.log("Seed data inserted");
  } catch (err) {
    console.error("Seeding error:", err);
  }
}

// ✅ Register Routes HERE – not inside startServer
app.get('/', (req, res) => {
  res.send('Root OK');
});

app.get('/api/dogs', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT d.name AS dog_name, d.size, u.username AS owner_username
      FROM Dogs d JOIN Users u ON d.owner_id = u.user_id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve dogs' });
  }
});

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

app.get('/api/walkers/summary', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT u.username AS walker_username,
             COUNT(DISTINCT wrt.rating_id) AS total_ratings,
             ROUND(AVG(wrt.rating),1) AS average_rating,
             COUNT(DISTINCT wrq.request_id) AS completed_walks
      FROM Users u
      LEFT JOIN WalkApplications wa ON u.user_id = wa.walker_id
      LEFT JOIN WalkRequests wrq ON wa.request_id = wrq.request_id AND wrq.status = 'completed'
      LEFT JOIN WalkRatings wrt ON wrq.request_id = wrt.request_id
      WHERE u.role = 'walker'
      GROUP BY u.username
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve walker summary' });
  }
});

// ✅ Start server only after DB connect and seed
async function startServer() {
  try {
    await connectDB();
    await seedData();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Startup error:", err);
  }
}

startServer();
