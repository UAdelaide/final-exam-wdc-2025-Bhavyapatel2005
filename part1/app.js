const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 8080;

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'DogWalkService'  // <-- this matches your DB name!
};

let connection;

const seedData = async () => {
  // Clean existing data
  await connection.execute('DELETE FROM WalkRatings');
  await connection.execute('DELETE FROM WalkApplications');
  await connection.execute('DELETE FROM WalkRequests');
  await connection.execute('DELETE FROM Dogs');
  await connection.execute('DELETE FROM Users');

  // Insert users
  await connection.execute(`
    INSERT INTO Users (username, email, password_hash, role) VALUES
    ('alice123', 'alice@example.com', 'hashed123', 'owner'),
    ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
    ('carol123', 'carol@example.com', 'hashed789', 'owner'),
    ('sam36', 'david@example.com', 'hashed000', 'walker'),
    ('misty9', 'emily@example.com', 'hashed321', 'owner')
  `);

  // Insert dogs
  await connection.execute(`
    INSERT INTO Dogs (owner_id, name, size) VALUES
    ((SELECT user_id FROM Users WHERE username = 'alice123'), 'Max', 'medium'),
    ((SELECT user_id FROM Users WHERE username = 'carol123'), 'Bella', 'small'),
    ((SELECT user_id FROM Users WHERE username = 'alice123'), 'Ben', 'large'),
    ((SELECT user_id FROM Users WHERE username = 'carol123'), 'Luna', 'medium'),
    ((SELECT user_id FROM Users WHERE username = 'misty9'), 'Cooper', 'small')
  `);

  // Insert walk requests
  await connection.execute(`
    INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status) VALUES
    ((SELECT dog_id FROM Dogs WHERE name = 'Max'), '2025-06-10 08:00:00', 30, 'Parklands', 'open'),
    ((SELECT dog_id FROM Dogs WHERE name = 'Bella'), '2025-06-10 09:30:00', 45, 'Beachside Ave', 'accepted'),
    ((SELECT dog_id FROM Dogs WHERE name = 'Ben'), '2025-06-11 11:00:00', 60, 'City Garden', 'open'),
    ((SELECT dog_id FROM Dogs WHERE name = 'Luna'), '2025-06-12 07:30:00', 30, 'Riverside Trail', 'open'),
    ((SELECT dog_id FROM Dogs WHERE name = 'Cooper'), '2025-06-13 15:00:00', 25, 'Prospect Park', 'cancelled')
  `);

  // Insert walk applications — make sure status is valid ENUM (e.g., 'pending', 'accepted')
  await connection.execute(`
    INSERT INTO WalkApplications (walker_id, request_id, status) VALUES
    ((SELECT user_id FROM Users WHERE username = 'bobwalker'), 1, 'accepted'),
    ((SELECT user_id FROM Users WHERE username = 'sam36'), 2, 'pending')
  `);

  // Insert walk ratings
  await connection.execute(`
    INSERT INTO WalkRatings (walk_application_id, rating, comment) VALUES
    (1, 5, 'Excellent walk'),
    (1, 4, 'Good effort')
  `);
};

// /api/dogs
app.get('/api/dogs', async (req, res) => {
  try {
    const [rows] = await connection.execute(`
      SELECT d.name AS dog_name, d.size, u.username AS owner_username
      FROM Dogs d
      JOIN Users u ON d.owner_id = u.user_id
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dogs' });
  }
});

// /api/walkrequests/open
app.get('/api/walkrequests/open', async (req, res) => {
  try {
    const [rows] = await connection.execute(`
      SELECT wr.request_id, d.name AS dog_name, wr.requested_time, wr.duration_minutes, wr.location, u.username AS owner_username
      FROM WalkRequests wr
      JOIN Dogs d ON wr.dog_id = d.dog_id
      JOIN Users u ON d.owner_id = u.user_id
      WHERE wr.status = 'open'
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch open walk requests' });
  }
});

// /api/walkers/summary
app.get('/api/walkers/summary', async (req, res) => {
  try {
    const [rows] = await connection.execute(`
      SELECT u.username AS walker_username,
             COUNT(r.rating_id) AS total_ratings,
             ROUND(AVG(r.rating), 1) AS average_rating,
             SUM(CASE WHEN wa.status = 'accepted' THEN 1 ELSE 0 END) AS completed_walks
      FROM Users u
      LEFT JOIN WalkApplications wa ON u.user_id = wa.walker_id
      LEFT JOIN WalkRatings r ON wa.application_id = r.walk_application_id
      WHERE u.role = 'walker'
      GROUP BY u.username
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch walker summary' });
  }
});

// Start server
const startServer = async () => {
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to MySQL');
    await seedData();
    console.log('Database seeded');
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
  }
};

startServer();