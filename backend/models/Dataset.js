const mongoose = require('mongoose');

const columnSchema = new mongoose.Schema({
  name: String,
  type: { type: String, enum: ['numeric', 'categorical', 'datetime', 'unknown'] },
  nullCount: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  uniqueCount: Number,
  mean: Number,
  std: Number,
  min: Number,
  max: Number,
  median: Number,
  mode: Number,
  skewness: Number,
  histogram: [Number],
  profile: mongoose.Schema.Types.Mixed,
}, { _id: false });

const datasetSchema = new mongoose.Schema({
  name: { type: String, required: true },
  status: { type: String, enum: ['raw', 'cleaned'], default: 'raw' },
  rowCount: Number,
  columnCount: Number,
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', default: null },
  columns: [columnSchema],
  uploadedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Dataset', datasetSchema);
