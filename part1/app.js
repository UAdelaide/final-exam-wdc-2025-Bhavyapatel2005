const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 8080;

// Create MySQL pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // or your root password
  database: 'dogwalking',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Seed database with sample data
async function seedDatabase() {
  try {
    const conn = await pool.getConnection();

    await conn.query(`DELETE FROM WalkRatings`);
    await conn.query(`DELETE FROM WalkRequests`);
    await conn.query(`DELETE FROM Dogs`);
    await conn.query(`DELETE FROM Users`);

    await conn.query(`
      INSERT INTO Users (user_id, username, role)
      VALUES
        (1, 'alice123', 'owner'),
        (2, 'carol123', 'owner'),
        (3, 'bobwalker', 'walker'),
        (4, 'newwalker', 'walker');
    `);

    await conn.query(`
      INSERT INTO Dogs (dog_id, dog_name, size, owner_id)
      VALUES
        (1, 'Max', 'medium', 1),
        (2, 'Bella', 'small', 2);
    `);

    await conn.query(`
      INSERT INTO WalkRequests (request_id, dog_id, requested_time, duration_minutes, location, status)
      VALUES
        (1, 1, '2025-06-10 08:00:00', 30, 'Parklands', 'open'),
        (2, 2, '2025-06-10 09:00:00', 45, 'Beachside Ave', 'accepted');
    `);

    await conn.query(`
      INSERT INTO WalkRatings (rating_id, walk_application_id, rating, comment)
      VALUES
        (1, 1, 5, 'Great walk'),
        (2, 1, 4, 'Nice and friendly');
    `);

    conn.release();
    console.log('Database seeded.');
  } catch (error) {
    console.error('Error seeding database:', error.message);
  }
}

// Route: /api/dogs
app.get('/api/dogs', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT d.dog_name, d.size, u.username AS owner_username
      FROM Dogs d
      JOIN Users u ON d.owner_id = u.user_id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route: /api/walkrequests/open
app.get('/api/walkrequests/open', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT wr.request_id, d.dog_name, wr.requested_time, wr.duration_minutes, wr.location, u.username AS owner_username
      FROM WalkRequests wr
      JOIN Dogs d ON wr.dog_id = d.dog_id
      JOIN Users u ON d.owner_id = u.user_id
      WHERE wr.status = 'open'
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route: /api/walkers/summary
app.get('/api/walkers/summary', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        u.username AS walker_username,
        COUNT(r.rating_id) AS total_ratings,
        ROUND(AVG(r.rating), 1) AS average_rating,
        COUNT(DISTINCT wa.application_id) AS completed_walks
      FROM Users u
      LEFT JOIN WalkApplications wa ON u.user_id = wa.walker_id AND wa.status = 'completed'
      LEFT JOIN WalkRatings r ON wa.application_id = r.walk_application_id
      WHERE u.role = 'walker'
      GROUP BY u.user_id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server and seed DB
app.listen(PORT, async () => {
  await seedDatabase();
  console.log(`Server running at http://localhost:${PORT}`);
});
