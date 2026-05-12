const { parse } = require('csv-parse/sync');
const multer = require('multer');
const Dataset = require('../models/Dataset');
const DataRow = require('../models/DataRow');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Helper: infer column type
function inferType(values) {
  const nonNull = values.filter(v => v !== null && v !== '' && v !== undefined);
  if (nonNull.length === 0) return 'unknown';
  const numericCount = nonNull.filter(v => !isNaN(parseFloat(v)) && isFinite(v)).length;
  if (numericCount / nonNull.length > 0.8) return 'numeric';
  const dateRegex = /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/;
  if (nonNull.filter(v => dateRegex.test(String(v))).length / nonNull.length > 0.8) return 'datetime';
  return 'categorical';
}

// Helper: compute profile for a column
function computeProfile(name, values, type) {
  const total = values.length;
  const nullCount = values.filter(v => v === null || v === '' || v === undefined).length;
  const nonNull = values.filter(v => v !== null && v !== '' && v !== undefined);
  const unique = new Set(nonNull).size;
  const profile = { name, type, totalCount: total, nullCount, uniqueCount: unique };

  if (type === 'numeric') {
    const nums = nonNull.map(v => parseFloat(v)).filter(n => !isNaN(n)).sort((a, b) => a - b);
    if (nums.length > 0) {
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      const variance = nums.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / nums.length;
      const std = Math.sqrt(variance);
      const min = nums[0], max = nums[nums.length - 1];
      const mid = Math.floor(nums.length / 2);
      const median = nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
      // Mini histogram (10 bins)
      const binSize = (max - min) / 10 || 1;
      const bins = Array(10).fill(0);
      nums.forEach(n => { const b = Math.min(Math.floor((n - min) / binSize), 9); bins[b]++; });
      Object.assign(profile, { mean, std, min, max, median, histogram: bins });
    }
  }
  return profile;
}

exports.uploadMiddleware = upload.single('file');

exports.uploadDataset = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const { originalname, buffer, mimetype } = req.file;
  let rows = [];

  if (mimetype === 'application/json' || originalname.endsWith('.json')) {
    rows = JSON.parse(buffer.toString());
    if (!Array.isArray(rows)) throw new Error('JSON must be an array of objects');
  } else {
    rows = parse(buffer.toString(), { columns: true, skip_empty_lines: true, trim: true });
  }

  if (rows.length === 0) throw new Error('File is empty');
  const columnNames = Object.keys(rows[0]);
  if (columnNames.length > 50) throw new Error('Too many columns (max 50)');

  const columns = columnNames.map(name => {
    const values = rows.map(r => r[name]);
    const type = inferType(values);
    return computeProfile(name, values, type);
  });

  const dataset = await Dataset.create({
    name: originalname,
    rowCount: rows.length,
    columnCount: columnNames.length,
    columns,
    status: 'raw',
  });

  const numericColNames = columns.filter(c => c.type === 'numeric').map(c => c.name);
  
  // Prepare data rows for insert, casting numeric values correctly
  const dataRowsToInsert = rows.map(r => {
    const parsedData = { ...r };
    numericColNames.forEach(col => {
      if (parsedData[col] !== null && parsedData[col] !== '' && parsedData[col] !== undefined) {
        const num = parseFloat(parsedData[col]);
        if (!isNaN(num)) parsedData[col] = num;
      }
    });
    return { datasetId: dataset._id, data: parsedData };
  });

  await DataRow.insertMany(dataRowsToInsert);

  res.status(201).json({ dataset: { _id: dataset._id, name: dataset.name, rowCount: dataset.rowCount, columnCount: dataset.columnCount, status: dataset.status, uploadedAt: dataset.createdAt, columns: dataset.columns } });
};

exports.listDatasets = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const datasets = await Dataset.find({}, { rows: 0 }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
  const total = await Dataset.countDocuments();
  res.json({ datasets, page, totalPages: Math.ceil(total / limit), total });
};

exports.previewDataset = async (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const dataset = await Dataset.findById(id);
  if (!dataset) return res.status(404).json({ message: 'Dataset not found' });
  
  const skip = (page - 1) * limit;
  const rowDocs = await DataRow.find({ datasetId: id }).skip(skip).limit(limit).lean();
  const rows = rowDocs.map(doc => doc.data);
  const columns = dataset.columns.map(c => c.name);
  
  res.json({ rows, columns, page, totalPages: Math.ceil(dataset.rowCount / limit), totalRows: dataset.rowCount });
};

exports.profileDataset = async (req, res) => {
  const { id } = req.params;
  const dataset = await Dataset.findById(id, { columns: 1 });
  if (!dataset) return res.status(404).json({ message: 'Dataset not found' });
  res.json({ columns: dataset.columns });
};

exports.nullMap = async (req, res) => {
  const { id } = req.params;
  const dataset = await Dataset.findById(id, { columns: 1 });
  if (!dataset) return res.status(404).json({ message: 'Dataset not found' });
  const cols = dataset.columns.map(c => ({
    name: c.name, type: c.type, nullCount: c.nullCount, totalCount: c.totalCount,
    mean: c.mean, std: c.std, median: c.median,
  }));
  res.json({ columns: cols });
};

exports.deleteDataset = async (req, res) => {
  const { id } = req.params;
  await Dataset.findByIdAndDelete(id);
  await DataRow.deleteMany({ datasetId: id });
  res.json({ message: 'Dataset deleted' });
};
