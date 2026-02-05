const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('ok'));
app.listen(3002, () => console.log('Test running on 3002'));
setInterval(() => {}, 1000);
