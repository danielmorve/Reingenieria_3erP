
const express = require('express');
const path = require('path');

const app = express();
const publicDir = path.join(__dirname);

app.use(express.static(publicDir));

const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log('Frontend server running on port ' + port);
});
