const express = require('express');
const app = express();
const PORT = 8080;

app.get('/api/test', (req, res) => {
  res.json({ message: "Test route works!" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
