const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  type: { type: String, required: true }, // ttest | correlation | regression | imputation | normalization | boxplot
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset' },
  parameters: mongoose.Schema.Types.Mixed,
  results: mongoose.Schema.Types.Mixed,
  label: String,
  tags: [String],
}, { timestamps: true });

module.exports = mongoose.model('Analysis', analysisSchema);
