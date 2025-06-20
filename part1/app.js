const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 8080;

// Configure MySQL connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',  // <- set your password if needed
  database: 'DogWalkService',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Seed database with sample records (only once)
async function seedDatabase() {
  try {
    // Insert users
    await pool.query(`
      INSERT IGNORE INTO Users (user_id, username, email, password_hash, role)
      VALUES
        (1, 'alice123', 'alice@example.com', 'password1', 'owner'),
        (2, 'bobwalker', 'bob@example.com', 'password2', 'walker'),
        (3, 'carol123', 'carol@example.com', 'password3', 'owner');
    `);

    // Insert dogs
    await pool.query(`
      INSERT IGNORE INTO Dogs (dog_id, owner_id, name, size)
      VALUES
        (1, 1, 'Max', 'medium'),
        (2, 3, 'Bella', 'small');
    `);

    // Insert walk requests
    await pool.query(`
      INSERT IGNORE INTO WalkRequests (request_id, dog_id, requested_time, duration_minutes, location, status)
      VALUES
        (1, 1, '2025-06-10 08:00:00', 30, 'Parklands', 'open'),
        (2, 2, '2025-06-10 09:30:00', 45, 'Beachside Ave', 'completed');
    `);

    // Insert applications
    await pool.query(`
      INSERT IGNORE INTO WalkApplications (application_id, request_id, walker_id, status)
      VALUES
        (1, 2, 2, 'completed');
    `);

    // Insert ratings
    await pool.query(`
      INSERT IGNORE INTO WalkRatings (rating_id, walk_application_id, rating, comment)
      VALUES
        (1, 1, 5, 'Great service!'),
        (2, 1, 4, 'Very good walk');
    `);

    console.log('✅ Database seeded with test data');
  } catch (err) {
    console.error('❌ Failed to seed database:', err.message);
  }
}

// ---------------------- ROUTES -------------------------

// GET /api/dogs
// Returns all dogs with their size and owner username
app.get('/api/dogs', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT d.name AS dog_name, d.size, u.username AS owner_username
      FROM Dogs d
      JOIN Users u ON d.owner_id = u.user_id;
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dog list' });
  }
});

// GET /api/walkrequests/open
// Returns all open walk requests with dog name and owner
app.get('/api/walkrequests/open', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT wr.request_id, d.name AS dog_name, wr.requested_time, wr.duration_minutes, wr.location, u.username AS owner_username
      FROM WalkRequests wr
      JOIN Dogs d ON wr.dog_id = d.dog_id
      JOIN Users u ON d.owner_id = u.user_id
      WHERE wr.status = 'open';
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch open walk requests' });
  }
});

// GET /api/walkers/summary
// Returns a summary of walkers: username, total ratings, avg rating, and completed walks
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
      GROUP BY u.user_id;
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch walker summaries' });
  }
});

// ---------------------- STARTUP -------------------------

// Start server only after seeding data
seedDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server is running at http://localhost:${PORT}`);
  });
});
