const express = require('express');
const app = express();
const PORT = 8084;

app.get('/', (req, res) => {
  res.send('Root OK');
});

app.get('/api/dogs', (req, res) => {
  res.json([{ dog_name: 'Max', size: 'medium', owner_username: 'alice123' }]);
});

app.get('/api/walkrequests/open', (req, res) => {
  res.json([{ request_id: 1, dog_name: 'Max', requested_time: '2025-06-10T08:00:00.000Z', duration_minutes: 30, location: 'Parklands', owner_username: 'alice123' }]);
});

app.get('/api/walkers/summary', (req, res) => {
  res.json([{ walker_username: 'bobwalker', total_ratings: 2, average_rating: 4.5, completed_walks: 2 }]);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
