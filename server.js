const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (request, response) => {
	response.send('Singlepoint server is running');
});

app.listen(port, () => {
	console.log(`Singlepoint server listening on http://localhost:${port}`);
});