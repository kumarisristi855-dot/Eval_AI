const express = require('express');
const app = express();
const authRoutes = require('./routes/auth');

app.use((req, res, next) => {
  console.log('Incoming:', req.method, req.url);
  next();
});

app.use('/api/auth', authRoutes);

app.use((req, res) => {
  console.log('404 for:', req.url);
  res.status(404).send('Not Found');
});

app.listen(5005, () => {
  console.log('Mock server on 5005');
});
