const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 8080;
let db;

// This is asynchronous function to connect to the database.
async function connectDB() {
  db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'DogWalkService'
  });
  console.log("Connected to MySQL");
}

// Now before inserting the data  clearnign the old vales to that there is no conflict.
async function seedData() {
  try {
    await db.execute(`DELETE FROM WalkRatings`);
    await db.execute(`DELETE FROM WalkApplications`);
    await db.execute(`DELETE FROM WalkRequests`);
    await db.execute(`DELETE FROM Dogs`);
    await db.execute(`DELETE FROM Users`);

    await db.execute(`
      INSERT INTO Users (username, email, password_hash, role) VALUES
      ('alice123', 'alice@example.com', 'hashed123', 'owner'),
      ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
      ('carol123', 'carol@example.com', 'hashed789', 'owner'),
      ('sam36', 'sam@example.com', 'hashed000', 'walker'),
      ('emily99', 'emily@example.com', 'hashed321', 'owner')
    `);

    await db.execute(`
      INSERT INTO Dogs (owner_id, name, size) VALUES
      ((SELECT user_id FROM Users WHERE username = 'alice123'), 'Max', 'medium'),
      ((SELECT user_id FROM Users WHERE username = 'carol123'), 'Bella', 'small'),
      ((SELECT user_id FROM Users WHERE username = 'alice123'), 'Ben', 'large'),
      ((SELECT user_id FROM Users WHERE username = 'carol123'), 'Luna', 'medium'),
      ((SELECT user_id FROM Users WHERE username = 'emily99'), 'Cooper', 'small')
    `);

    await db.execute(`
      INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status) VALUES
      ((SELECT dog_id FROM Dogs WHERE name = 'Max'), '2025-06-10 08:00:00', 30, 'Parklands', 'open'),
      ((SELECT dog_id FROM Dogs WHERE name = 'Bella'), '2025-06-10 09:30:00', 45, 'Beachside Ave', 'accepted'),
      ((SELECT dog_id FROM Dogs WHERE name = 'Ben'), '2025-06-11 11:00:00', 60, 'City Garden', 'open'),
      ((SELECT dog_id FROM Dogs WHERE name = 'Luna'), '2025-06-12 07:30:00', 30, 'Riverside Trail', 'completed'),
      ((SELECT dog_id FROM Dogs WHERE name = 'Cooper'), '2025-06-13 15:00:00', 25, 'Prospect Park', 'completed')
    `);

    await db.execute(`
      INSERT INTO WalkApplications (request_id, walker_id, status) VALUES
      ((SELECT request_id FROM WalkRequests WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name = 'Max')),
       (SELECT user_id FROM Users WHERE username = 'bobwalker'), 'accepted'),
      ((SELECT request_id FROM WalkRequests WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name = 'Luna')),
       (SELECT user_id FROM Users WHERE username = 'sam36'), 'accepted'),
      ((SELECT request_id FROM WalkRequests WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name = 'Cooper')),
       (SELECT user_id FROM Users WHERE username = 'bobwalker'), 'accepted')
    `);

    await db.execute(`
      INSERT INTO WalkRatings (request_id, walker_id, owner_id, rating, comments) VALUES
      ((SELECT request_id FROM WalkRequests WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name = 'Luna')),
       (SELECT user_id FROM Users WHERE username = 'sam36'),
       (SELECT owner_id FROM Dogs WHERE name = 'Luna'), 5, 'Great walk'),
      ((SELECT request_id FROM WalkRequests WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name = 'Cooper')),
       (SELECT user_id FROM Users WHERE username = 'bobwalker'),
       (SELECT owner_id FROM Dogs WHERE name = 'Cooper'), 4, 'Good walk')
    `);

    console.log("Seed data inserted");
  } catch (err) {
    console.error("Seeding error (but server will still run):", err.message);
  }
}

// ✅ ROUTES (always registered, no DB dependency to bind)
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

// ✅ Start server right away — DB can fail but server runs
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// ✅ Run DB + seed async
(async () => {
  try {
    await connectDB();
    await seedData();
  } catch (err) {
    console.error("DB/Seed startup error (but server is up):", err.message);
  }
})();
