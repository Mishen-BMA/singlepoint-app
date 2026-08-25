require('./models/policyModel');
const express = require('express');
const app = express();

app.use(express.json()); // lets our server understand JSON sent from the frontend

app.get('/', (req, res) => {
  res.send('SinglePoint API is running');
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});