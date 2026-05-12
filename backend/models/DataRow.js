const mongoose = require('mongoose');

const dataRowSchema = new mongoose.Schema({
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', required: true, index: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true }, // The actual row data
}, { timestamps: false });

module.exports = mongoose.model('DataRow', dataRowSchema);
