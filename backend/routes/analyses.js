const express = require('express');
const router = express.Router();
const Analysis = require('../models/Analysis');

router.get('/', async (req, res) => {
  const { type, datasetId } = req.query;
  const filter = {};
  if (type) filter.type = type;
  if (datasetId) filter.datasetId = datasetId;
  const analyses = await Analysis.find(filter).sort({ createdAt: -1 }).limit(50);
  res.json({ analyses });
});

router.get('/:id', async (req, res) => {
  const analysis = await Analysis.findById(req.params.id);
  if (!analysis) return res.status(404).json({ message: 'Analysis not found' });
  res.json(analysis);
});

module.exports = router;
