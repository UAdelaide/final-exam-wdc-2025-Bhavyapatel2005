const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 8080;

// MySQL config
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'dogwalks'
};

// Sample data to insert
const seedData = async (conn) => {
  await conn.execute(`INSERT IGNORE INTO Users (user_id, username, role) VALUES
    (1, 'alice123', 'owner'),
    (2, 'bobwalker', 'walker'),
    (3, 'carol123', 'owner'),
    (4, 'newwalker', 'walker')`);

  await conn.execute(`INSERT IGNORE INTO Dogs (dog_id, name, size, owner_id) VALUES
    (1, 'Max', 'medium', 1),
    (2, 'Bella', 'small', 3)`);

  await conn.execute(`INSERT IGNORE INTO WalkRequests (request_id, dog_id, requested_time, duration_minutes, location, status) VALUES
    (1, 1, '2025-06-10T08:00:00', 30, 'Parklands', 'open')`);

  await conn.execute(`INSERT IGNORE INTO WalkApplications (application_id, walker_id, request_id, status) VALUES
    (1, 2, 1, 'completed')`);

  await conn.execute(`INSERT IGNORE INTO WalkRatings (rating_id, walk_application_id, rating, comment) VALUES
    (1, 1, 4, 'Good'),
    (2, 1, 5, 'Great')`);
};

let connection;

const startServer = async () => {
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to MySQL');

    await seedData(connection);
    console.log('Database seeded');

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
                 SUM(CASE WHEN wa.status = 'completed' THEN 1 ELSE 0 END) AS completed_walks
          FROM Users u
          LEFT JOIN WalkApplications wa ON u.user_id = wa.walker_id
          LEFT JOIN WalkRatings r ON wa.application_id = r.walk_application_id
          WHERE u.role = 'walker'
          GROUP BY u.username
        `);
        res.json(rows);
      } catch (err) {
        res.status(500).json({ error: 'Failed to fetch walker summary' });
      }
    });

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error('Failed to start server:', err);
  }
};

startServer();
