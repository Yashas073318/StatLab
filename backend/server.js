require('express-async-errors');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
require('dotenv').config();

const datasetsRouter = require('./routes/datasets');
const cleanRouter = require('./routes/clean');
const statsRouter = require('./routes/stats');
const analysesRouter = require('./routes/analyses');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));

// Routes
app.use('/api/datasets', datasetsRouter);
app.use('/api/clean', cleanRouter);
app.use('/api/stats', statsRouter);
app.use('/api/analyses', analysesRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5001;
const { connectDB } = require('./config/db');

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`✓ StatLab backend running on port ${PORT}`));
  })
  .catch(err => {
    console.error('✗ Server failed to start:', err.message);
    process.exit(1);
  });

module.exports = app;
