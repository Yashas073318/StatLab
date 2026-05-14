const Dataset = require('../models/Dataset');
const DataRow = require('../models/DataRow');
const Analysis = require('../models/Analysis');
const ss = require('simple-statistics');

function inferType(values) {
  const nonNull = values.filter(v => v !== null && v !== '' && v !== undefined);
  if (nonNull.length === 0) return 'unknown';
  const numericCount = nonNull.filter(v => !isNaN(parseFloat(v)) && isFinite(v)).length;
  if (numericCount / nonNull.length > 0.8) return 'numeric';
  const dateRegex = /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/;
  if (nonNull.filter(v => dateRegex.test(String(v))).length / nonNull.length > 0.8) return 'datetime';
  return 'categorical';
}

function computeProfile(name, values, type) {
  const total = values.length;
  const nullCount = values.filter(v => v === null || v === '' || v === undefined).length;
  const nonNull = values.filter(v => v !== null && v !== '' && v !== undefined);
  const unique = new Set(nonNull).size;
  const profile = { name, type, totalCount: total, nullCount, uniqueCount: unique };
  if (type === 'numeric') {
    const nums = nonNull.map(v => parseFloat(v)).filter(n => !isNaN(n)).sort((a, b) => a - b);
    if (nums.length > 0) {
      const mean = ss.mean(nums), std = ss.standardDeviation(nums);
      const min = nums[0], max = nums[nums.length - 1];
      const median = ss.median(nums);
      const mode = ss.mode(nums);
      const skewness = nums.length > 2 ? ss.sampleSkewness(nums) : 0;
      const binSize = (max - min) / 10 || 1;
      const bins = Array(10).fill(0);
      nums.forEach(n => { const b = Math.min(Math.floor((n - min) / binSize), 9); bins[b]++; });
      Object.assign(profile, { mean, std, min, max, median, mode, skewness, histogram: bins });
    }
  }
  return profile;
}

exports.impute = async (req, res) => {
  const { datasetId, columns } = req.body;
  const dataset = await Dataset.findById(datasetId);
  if (!dataset) return res.status(404).json({ message: 'Dataset not found' });

  const rowDocs = await DataRow.find({ datasetId }).lean();
  const datasetRows = rowDocs.map(doc => doc.data);

  const rowsToDrop = new Set();
  columns.forEach(({ name, strategy }) => {
    if (strategy === 'remove_incomplete') {
      datasetRows.forEach((row, idx) => {
        if (row[name] === null || row[name] === '' || row[name] === undefined) {
          rowsToDrop.add(idx);
        }
      });
    }
  });

  const newRows = datasetRows.filter((_, idx) => !rowsToDrop.has(idx)).map(row => {
    const updated = { ...row };
    columns.forEach(({ name, strategy, customValue }) => {
      if (strategy !== 'remove_incomplete' && (updated[name] === null || updated[name] === '' || updated[name] === undefined)) {
        const col = dataset.columns.find(c => c.name === name);
        if (strategy === 'mean') updated[name] = col?.mean ?? 0;
        else if (strategy === 'median') updated[name] = col?.median ?? 0;
        else if (strategy === 'mode') updated[name] = col?.mode ?? 0;
        else if (strategy === 'custom_value') updated[name] = parseFloat(customValue) || 0;
      }
    });
    return updated;
  });

  const newCols = newRows[0] ? Object.keys(newRows[0]).map(name => {
    const values = newRows.map(r => r[name]);
    const type = inferType(values);
    return computeProfile(name, values, type);
  }) : dataset.columns;

  const newDataset = await Dataset.create({
    name: `${dataset.name} (imputed)`,
    parentId: dataset._id,
    status: 'cleaned',
    rowCount: newRows.length,
    columnCount: newCols.length,
    columns: newCols,
  });

  const dataRowsToInsert = newRows.map(data => ({ datasetId: newDataset._id, data }));
  await DataRow.insertMany(dataRowsToInsert);

  await Analysis.create({ type: 'imputation', datasetId, parameters: { columns }, results: { newDatasetId: newDataset._id } });
  res.json({ dataset: { _id: newDataset._id, name: newDataset.name, rowCount: newDataset.rowCount, columnCount: newDataset.columnCount, status: newDataset.status, uploadedAt: newDataset.createdAt } });
};

exports.normalize = async (req, res) => {
  const { datasetId, columns } = req.body;
  const dataset = await Dataset.findById(datasetId);
  if (!dataset) return res.status(404).json({ message: 'Dataset not found' });

  const rowDocs = await DataRow.find({ datasetId }).lean();
  const datasetRows = rowDocs.map(doc => doc.data);

  const stats = {};
  columns.forEach(colName => {
    const col = dataset.columns.find(c => c.name === colName);
    stats[colName] = { mean: col?.mean ?? 0, std: col?.std ?? 1 };
  });

  const newRows = datasetRows.map(row => {
    const updated = { ...row };
    columns.forEach(colName => {
      const { mean, std } = stats[colName];
      const val = parseFloat(row[colName]);
      if (!isNaN(val)) {
        updated[`${colName}_original`] = val;
        updated[colName] = std > 0 ? (val - mean) / std : 0;
      }
    });
    return updated;
  });

  const newCols = Object.keys(newRows[0] || {}).map(name => {
    const values = newRows.map(r => r[name]);
    const type = inferType(values);
    return computeProfile(name, values, type);
  });

  const newDataset = await Dataset.create({
    name: `${dataset.name} (z-normalized)`,
    parentId: dataset._id,
    status: 'cleaned',
    rowCount: newRows.length,
    columnCount: newCols.length,
    columns: newCols,
  });

  const dataRowsToInsert = newRows.map(data => ({ datasetId: newDataset._id, data }));
  await DataRow.insertMany(dataRowsToInsert);

  await Analysis.create({ type: 'normalization', datasetId, parameters: { columns, stats }, results: { newDatasetId: newDataset._id } });
  res.json({ dataset: { _id: newDataset._id, name: newDataset.name, rowCount: newDataset.rowCount, columnCount: newDataset.columnCount, status: newDataset.status, uploadedAt: newDataset.createdAt }, stats });
};

exports.removeOutliers = async (req, res) => {
  const { datasetId, columns, iqrMultiplier = 1.5 } = req.body;
  const dataset = await Dataset.findById(datasetId);
  if (!dataset) return res.status(404).json({ message: 'Dataset not found' });

  const rowDocs = await DataRow.find({ datasetId }).lean();
  const datasetRows = rowDocs.map(doc => doc.data);

  // Precompute IQR bounds per column
  const bounds = {};
  columns.forEach(({ name, action }) => {
    if (action === 'keep') return;
    const vals = datasetRows.map(r => parseFloat(r[name])).filter(v => !isNaN(v)).sort((a, b) => a - b);
    if (!vals.length) return;
    const q1 = ss.quantile(vals, 0.25), q3 = ss.quantile(vals, 0.75);
    const iqr = q3 - q1;
    bounds[name] = { q1, q3, lower: q1 - iqrMultiplier * iqr, upper: q3 + iqrMultiplier * iqr, action };
  });

  let newRows = datasetRows.filter(row => {
    for (const [name, { lower, upper, action }] of Object.entries(bounds)) {
      const val = parseFloat(row[name]);
      if (!isNaN(val) && (val < lower || val > upper) && action === 'remove_rows') return false;
    }
    return true;
  }).map(row => {
    const updated = { ...row };
    for (const [name, { lower, upper, action }] of Object.entries(bounds)) {
      if (action === 'cap_to_whisker') {
        const val = parseFloat(updated[name]);
        if (!isNaN(val)) updated[name] = Math.min(Math.max(val, lower), upper);
      }
    }
    return updated;
  });

  const newCols = Object.keys(newRows[0] || {}).map(name => {
    const values = newRows.map(r => r[name]);
    const type = inferType(values);
    return computeProfile(name, values, type);
  });

  const newDataset = await Dataset.create({
    name: `${dataset.name} (outliers removed)`,
    parentId: dataset._id,
    status: 'cleaned',
    rowCount: newRows.length,
    columnCount: newCols.length,
    columns: newCols,
  });

  const dataRowsToInsert = newRows.map(data => ({ datasetId: newDataset._id, data }));
  await DataRow.insertMany(dataRowsToInsert);

  res.json({ dataset: { _id: newDataset._id, name: newDataset.name, rowCount: newDataset.rowCount, columnCount: newDataset.columnCount, status: newDataset.status, uploadedAt: newDataset.createdAt } });
};
