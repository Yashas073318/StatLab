const Dataset = require('../models/Dataset');
const DataRow = require('../models/DataRow');
const Analysis = require('../models/Analysis');
const ss = require('simple-statistics');

async function getNumericValues(datasetId, colName) {
  const docs = await DataRow.find(
    { datasetId, [`data.${colName}`]: { $exists: true } },
    { [`data.${colName}`]: 1, _id: 0 }
  ).lean();
  return docs.map((d, i) => ({ value: parseFloat(d.data[colName]), rowIndex: i }))
    .filter(v => !isNaN(v.value));
}

// ─── Boxplot ─────────────────────────────────────────────────────────────────
exports.boxplot = async (req, res) => {
  const { datasetId } = req.params;
  const dataset = await Dataset.findById(datasetId);
  if (!dataset) return res.status(404).json({ message: 'Dataset not found' });
  const numericCols = dataset.columns.filter(c => c.type === 'numeric');
  const result = {};
  for (const col of numericCols) {
    const rawVals = await getNumericValues(datasetId, col.name);
    if (!rawVals.length) continue;
    
    const vals = rawVals.map(v => v.value).sort((a, b) => a - b);
    const q1 = ss.quantile(vals, 0.25), q3 = ss.quantile(vals, 0.75);
    const iqr = q3 - q1;
    const lowerFence = q1 - 1.5 * iqr, upperFence = q3 + 1.5 * iqr;
    
    const outliers = rawVals
      .filter(v => v.value < lowerFence || v.value > upperFence)
      .map(v => ({ rowIndex: v.rowIndex, value: v.value }));
      
    result[col.name] = { 
      q1, q2: ss.median(vals), q3, 
      min: vals[0], max: vals[vals.length - 1], 
      iqr, outliers 
    };
  }
  res.json(result);
};

// ─── Paired T-Test ────────────────────────────────────────────────────────────
exports.pairedTTest = async (req, res) => {
  const { datasetId, col1, col2, alpha = 0.05, tail = 'two' } = req.body;
  const dataset = await Dataset.findById(datasetId);
  if (!dataset) return res.status(404).json({ message: 'Dataset not found' });

  const vDocs = await getNumericValues(datasetId, col1);
  const v1 = vDocs.map(d => d.value);
  const vDocs2 = await getNumericValues(datasetId, col2);
  const v2 = vDocs2.map(d => d.value);
  const n = Math.min(v1.length, v2.length);
  if (n < 2) return res.status(400).json({ message: 'Insufficient paired observations' });

  const diffs = Array.from({ length: n }, (_, i) => v1[i] - v2[i]);
  const meanDiff = ss.mean(diffs);
  const stdDiff = ss.standardDeviation(diffs);
  const tStat = meanDiff / (stdDiff / Math.sqrt(n));
  const df = n - 1;

  // p-value approximation using t-distribution
  const pValue = approximateTTestPValue(tStat, df, tail);
  const cohensD = meanDiff / stdDiff;
  const reject = pValue < alpha;

  const result = { tStat, pValue, df, meanDiff, stdDiff, n, cohensD, reject, col1, col2, alpha, tail };
  await Analysis.create({ type: 'ttest', datasetId, parameters: { col1, col2, alpha, tail }, results: result });
  res.json(result);
};

function approximateTTestPValue(t, df, tail) {
  // Beta function approximation for t-distribution CDF
  const x = df / (df + t * t);
  const beta = incompleteBeta(df / 2, 0.5, x);
  const p2 = beta;
  if (tail === 'two') return p2;
  return t > 0 ? p2 / 2 : 1 - p2 / 2;
}

function incompleteBeta(a, b, x) {
  if (x === 0) return 1;
  if (x === 1) return 0;
  // Simple continued fraction approximation
  let result = 0;
  for (let i = 0; i < 100; i++) {
    result += Math.pow(x, i) * (1 - x) * Math.pow((1 - x), a - 1) / (a + i);
  }
  return Math.min(1, Math.max(0, result));
}

// ─── Pearson Correlation ──────────────────────────────────────────────────────
exports.pearsonCorr = async (req, res) => {
  const { datasetId, col1, col2 } = req.body;
  const dataset = await Dataset.findById(datasetId);
  if (!dataset) return res.status(404).json({ message: 'Dataset not found' });
  const vDocs1 = await getNumericValues(datasetId, col1);
  const v1 = vDocs1.map(d => d.value);
  const vDocs2 = await getNumericValues(datasetId, col2);
  const v2 = vDocs2.map(d => d.value);
  const n = Math.min(v1.length, v2.length);
  const x = v1.slice(0, n), y = v2.slice(0, n);
  const r = ss.sampleCorrelation(x, y);
  const tStat = r * Math.sqrt(n - 2) / Math.sqrt(1 - r * r);
  const pValue = Math.min(1, 2 * Math.exp(-Math.abs(tStat) * 0.717 - 0.416 * tStat * tStat / (n - 2)));
  const interpretation = getInterpretation(r);
  await Analysis.create({ type: 'pearson', datasetId, parameters: { col1, col2 }, results: { r, pValue, tStat, n, interpretation } });
  res.json({ r, pValue, tStat, n, interpretation });
};

function getInterpretation(r) {
  const a = Math.abs(r);
  if (a >= 0.9) return r > 0 ? 'Very strong positive correlation' : 'Very strong negative correlation';
  if (a >= 0.7) return r > 0 ? 'Strong positive correlation' : 'Strong negative correlation';
  if (a >= 0.5) return r > 0 ? 'Moderate positive correlation' : 'Moderate negative correlation';
  if (a >= 0.3) return r > 0 ? 'Weak positive correlation' : 'Weak negative correlation';
  return 'No linear correlation';
}

// ─── Correlation Matrix ───────────────────────────────────────────────────────
exports.correlationMatrix = async (req, res) => {
  const { datasetId, columns } = req.body;
  const dataset = await Dataset.findById(datasetId);
  if (!dataset) return res.status(404).json({ message: 'Dataset not found' });
  
  const matrix = [];
  for (const c1 of columns) {
    const row = [];
    for (const c2 of columns) {
      const vDocs1 = await getNumericValues(datasetId, c1);
      const v1 = vDocs1.map(d => d.value);
      const vDocs2 = await getNumericValues(datasetId, c2);
      const v2 = vDocs2.map(d => d.value);
      const n = Math.min(v1.length, v2.length);
      if (n < 2) row.push(0);
      else row.push(ss.sampleCorrelation(v1.slice(0, n), v2.slice(0, n)));
    }
    matrix.push(row);
  }
  res.json({ matrix, columns });
};

// ─── Scatter data ─────────────────────────────────────────────────────────────
exports.scatter = async (req, res) => {
  const { datasetId, col1, col2 } = req.query;
  const dataset = await Dataset.findById(datasetId);
  if (!dataset) return res.status(404).json({ message: 'Dataset not found' });
  const vDocs1 = await getNumericValues(datasetId, col1);
  const v1 = vDocs1.map(d => d.value);
  const vDocs2 = await getNumericValues(datasetId, col2);
  const v2 = vDocs2.map(d => d.value);
  const n = Math.min(v1.length, v2.length);
  const points = Array.from({ length: n }, (_, i) => ({ x: v1[i], y: v2[i] }));
  const lr = ss.linearRegression(points.map(p => [p.x, p.y]));
  const xMin = Math.min(...v1), xMax = Math.max(...v1);
  const regressionLine = [{ x: xMin, y: lr.m * xMin + lr.b }, { x: xMax, y: lr.m * xMax + lr.b }];
  res.json({ points: points.slice(0, 500), regressionLine });
};

// ─── Spearman Correlation ─────────────────────────────────────────────────────
function rankValues(arr) {
  const sorted = [...arr].map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(arr.length);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length - 1 && sorted[j + 1].v === sorted[j].v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[sorted[k].i] = avgRank;
    i = j + 1;
  }
  return ranks;
}

exports.spearmanCorr = async (req, res) => {
  const { datasetId, col1, col2 } = req.body;
  const dataset = await Dataset.findById(datasetId);
  if (!dataset) return res.status(404).json({ message: 'Dataset not found' });
  const vDocs1 = await getNumericValues(datasetId, col1);
  const v1 = vDocs1.map(d => d.value);
  const vDocs2 = await getNumericValues(datasetId, col2);
  const v2 = vDocs2.map(d => d.value);
  const n = Math.min(v1.length, v2.length);
  const x = v1.slice(0, n), y = v2.slice(0, n);
  const rankX = rankValues(x), rankY = rankValues(y);
  const dSquaredSum = rankX.reduce((sum, rx, i) => sum + Math.pow(rx - rankY[i], 2), 0);
  const rho = 1 - (6 * dSquaredSum) / (n * (n * n - 1));
  const tStat = rho * Math.sqrt(n - 2) / Math.sqrt(1 - rho * rho);
  const pValue = Math.min(1, 2 * Math.exp(-Math.abs(tStat) * 0.717));
  const rankedPairs = x.slice(0, 100).map((xv, i) => ({
    x: xv, y: y[i], rankX: rankX[i], rankY: rankY[i],
    d: rankX[i] - rankY[i], dSq: Math.pow(rankX[i] - rankY[i], 2),
  }));
  await Analysis.create({ type: 'spearman', datasetId, parameters: { col1, col2 }, results: { rho, pValue, n, dSquaredSum } });
  res.json({ rho, pValue, tStat, n, dSquaredSum, rankedPairs });
};

exports.correlationCompare = async (req, res) => {
  const { datasetId, col1, col2 } = req.query;
  const dataset = await Dataset.findById(datasetId);
  if (!dataset) return res.status(404).json({ message: 'Dataset not found' });
  const vDocs1 = await getNumericValues(datasetId, col1);
  const v1 = vDocs1.map(d => d.value);
  const vDocs2 = await getNumericValues(datasetId, col2);
  const v2 = vDocs2.map(d => d.value);
  const n = Math.min(v1.length, v2.length);
  const x = v1.slice(0, n), y = v2.slice(0, n);
  const r = ss.sampleCorrelation(x, y);
  const rankX = rankValues(x), rankY = rankValues(y);
  const dSq = rankX.reduce((s, rx, i) => s + Math.pow(rx - rankY[i], 2), 0);
  const rho = 1 - (6 * dSq) / (n * (n * n - 1));
  res.json({
    pearson: { r, interpretation: getInterpretation(r), n },
    spearman: { rho, n },
  });
};

// ─── Synthetic Correlation Data ───────────────────────────────────────────────
exports.syntheticCorrelation = async (req, res) => {
  const { targetR, n = 100 } = req.body;
  const r = Math.max(-1, Math.min(1, parseFloat(targetR)));
  const points = [];
  for (let i = 0; i < n; i++) {
    const x = (Math.random() - 0.5) * 4;
    const noise = (Math.random() - 0.5) * 2 * Math.sqrt(1 - r * r);
    const y = r * x + noise;
    points.push({ x: parseFloat(x.toFixed(3)), y: parseFloat(y.toFixed(3)) });
  }
  const actualR = ss.sampleCorrelation(points.map(p => p.x), points.map(p => p.y));
  res.json({ points, r: parseFloat(actualR.toFixed(4)), targetR: r, n });
};

exports.correlationGallery = async (req, res) => {
  const examples = [
    { label: 'Height vs Weight', description: 'Classic strong positive correlation', r: 0.85 },
    { label: 'Study Hours vs GPA', description: 'Moderate positive correlation', r: 0.6 },
    { label: 'Age vs Reaction Time', description: 'Weak positive (older → slower)', r: 0.35 },
    { label: 'Ice Cream vs Sunburn', description: 'No causal relationship', r: 0.72 },
    { label: 'Exercise vs Body Fat', description: 'Moderate negative correlation', r: -0.55 },
    { label: 'Salary vs Absence', description: 'Weak negative correlation', r: -0.3 },
    { label: 'Shoe Size vs IQ', description: 'No meaningful correlation', r: 0.02 },
  ].map(ex => {
    const n = 80, rTarget = ex.r;
    const points = [];
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * 4;
      const noise = (Math.random() - 0.5) * 2 * Math.sqrt(Math.max(0, 1 - rTarget * rTarget));
      points.push({ x: parseFloat(x.toFixed(2)), y: parseFloat((rTarget * x + noise).toFixed(2)) });
    }
    return { ...ex, points };
  });
  res.json({ examples });
};

// ─── Simple Regression ────────────────────────────────────────────────────────
exports.simpleRegression = async (req, res) => {
  const { datasetId, xCol, yCol } = req.body;
  const dataset = await Dataset.findById(datasetId);
  if (!dataset) return res.status(404).json({ message: 'Dataset not found' });
  const vDocsX = await getNumericValues(datasetId, xCol);
  const xVals = vDocsX.map(d => d.value);
  const vDocsY = await getNumericValues(datasetId, yCol);
  const yVals = vDocsY.map(d => d.value);
  const n = Math.min(xVals.length, yVals.length);
  const x = xVals.slice(0, n), y = yVals.slice(0, n);
  const pairs = x.map((xi, i) => [xi, y[i]]);
  const lr = ss.linearRegression(pairs);
  const beta0 = lr.b, beta1 = lr.m;
  const yHat = x.map(xi => beta0 + beta1 * xi);
  const residuals = y.map((yi, i) => yi - yHat[i]);
  const yMean = ss.mean(y);
  const ssTot = y.reduce((s, yi) => s + Math.pow(yi - yMean, 2), 0);
  const ssRes = residuals.reduce((s, r) => s + r * r, 0);
  const rSquared = 1 - ssRes / ssTot;
  const mse = ssRes / (n - 2);
  const rmse = Math.sqrt(mse);
  const fStat = (ssTot - ssRes) / 1 / mse;
  const pValue = Math.min(1, Math.exp(-0.717 * Math.sqrt(fStat)));

  // Points for scatter
  const points = x.map((xi, i) => ({ x: xi, y: y[i] })).slice(0, 500);
  const xMin = Math.min(...x), xMax = Math.max(...x);
  const regressionLine = [{ x: xMin, y: beta0 + beta1 * xMin }, { x: xMax, y: beta0 + beta1 * xMax }];

  // Residuals
  const residualPoints = yHat.map((yh, i) => ({
    fitted: parseFloat(yh.toFixed(3)),
    residual: parseFloat(residuals[i].toFixed(3)),
    isOutlier: Math.abs(residuals[i]) > 2 * Math.sqrt(mse),
  })).slice(0, 500);

  // Assumptions
  const assumptions = [
    { name: 'Linearity', status: Math.abs(ss.sampleCorrelation(x, y)) > 0.3 ? 'pass' : 'warn', detail: 'Check scatter plot for linear pattern' },
    { name: 'Normality of Residuals', status: 'warn', detail: 'Inspect residual histogram or Q-Q plot' },
    { name: 'Homoscedasticity', status: 'warn', detail: 'Residual plot should show random scatter' },
    { name: 'Independence', status: 'pass', detail: 'Assumed for cross-sectional data' },
  ];

  const result = { beta0, beta1, rSquared, mse, rmse, fStat, pValue, n, points, regressionLine, residuals: residualPoints, assumptions };
  await Analysis.create({ type: 'regression_simple', datasetId, parameters: { xCol, yCol }, results: { beta0, beta1, rSquared } });
  res.json(result);
};

exports.regressionPredict = async (req, res) => {
  const { beta0, beta1, xValue, n = 30, mse = 1 } = req.body;
  const yHat = beta0 + beta1 * xValue;
  const margin = 1.96 * Math.sqrt(mse * (1 + 1 / n));
  res.json({ yHat, ciLower: yHat - margin, ciUpper: yHat + margin });
};

// ─── Multiple Regression ─────────────────────────────────────────────────────
exports.multipleRegression = async (req, res) => {
  const { datasetId, xCols, yCol } = req.body;
  const dataset = await Dataset.findById(datasetId);
  if (!dataset) return res.status(404).json({ message: 'Dataset not found' });

  const vDocsY = await getNumericValues(datasetId, yCol);
  const y = vDocsY.map(d => d.value);
  const XsDocs = await Promise.all(xCols.map(c => getNumericValues(datasetId, c)));
  const Xs = XsDocs.map(docs => docs.map(d => d.value));
  const n = Math.min(y.length, ...Xs.map(x => x.length));

  // OLS via normal equations (simplified for POC)
  const ySlice = y.slice(0, n);
  const xSlices = Xs.map(x => x.slice(0, n));

  // Build design matrix with intercept
  const X = Array.from({ length: n }, (_, i) => [1, ...xSlices.map(x => x[i])]);
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);
  const XtY = matVecMul(Xt, ySlice);

  let betas;
  try {
    betas = solveLinearSystem(XtX, XtY);
  } catch {
    return res.status(400).json({ message: 'Matrix is singular — multicollinearity may be severe' });
  }

  const beta0 = betas[0];
  const betaCoeffs = betas.slice(1);
  const yHat = X.map(row => row.reduce((s, v, i) => s + v * betas[i], 0));
  const residuals = ySlice.map((yi, i) => yi - yHat[i]);
  const ssRes = residuals.reduce((s, r) => s + r * r, 0);
  const ssTot = ySlice.reduce((s, yi) => s + Math.pow(yi - ss.mean(ySlice), 2), 0);
  const rSquared = Math.max(0, 1 - ssRes / ssTot);
  const k = xCols.length;
  const adjRSquared = 1 - (1 - rSquared) * (n - 1) / (n - k - 1);
  const mse = ssRes / (n - k - 1);
  const fStat = (ssTot - ssRes) / k / mse;
  const aic = n * Math.log(ssRes / n) + 2 * (k + 1);

  // Simplified VIF (using R² of each predictor vs others)
  const vif = {};
  xCols.forEach((col, idx) => {
    const others = xCols.filter((_, i) => i !== idx);
    if (others.length === 0) { vif[col] = 1; return; }
    const xj = xSlices[idx];
    const r = ss.sampleCorrelation(xj, xSlices[(idx + 1) % xSlices.length]);
    vif[col] = 1 / Math.max(0.01, 1 - r * r);
  });

  // Coefficient stats (simplified SE)
  const seCoeff = Math.sqrt(mse);
  const coefficients = xCols.map((col, i) => {
    const beta = betaCoeffs[i];
    const stdErr = seCoeff / Math.sqrt(n);
    const tStat = beta / stdErr;
    const pValue = Math.min(1, 2 * Math.exp(-0.717 * Math.abs(tStat)));
    return { col, beta, stdErr, tStat, pValue };
  });

  // Standardized betas
  const standardizedBetas = xCols.map((col, i) => {
    const xStd = ss.standardDeviation(xSlices[i]);
    const yStd = ss.standardDeviation(ySlice);
    return { col, beta: betaCoeffs[i] * xStd / yStd };
  }).sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta));

  const result = { coefficients, rSquared, adjRSquared, fStat, aic, vif, standardizedBetas, n, mse };
  await Analysis.create({ type: 'regression_multiple', datasetId, parameters: { xCols, yCol }, results: { rSquared, adjRSquared, aic } });
  res.json(result);
};

exports.regressionPredictMultiple = async (req, res) => {
  const { coefficients, xValues } = req.body;
  const yHat = coefficients.reduce((s, { col, beta }) => s + beta * (parseFloat(xValues[col]) || 0), 0);
  res.json({ yHat, ciLower: yHat - 1.96, ciUpper: yHat + 1.96 });
};

exports.stepwiseRegression = async (req, res) => {
  const { datasetId, candidateCols, yCol } = req.body;
  const dataset = await Dataset.findById(datasetId);
  if (!dataset) return res.status(404).json({ message: 'Dataset not found' });
  const y = await getNumericValues(datasetId, yCol);
  const n = y.length;

  const ranked = [];
  for (const col of candidateCols) {
    const vDocsX = await getNumericValues(datasetId, col);
    const x = vDocsX.map(d => d.value).slice(0, n);
    const r = ss.sampleCorrelation(x, y.slice(0, Math.min(x.length, n)));
    ranked.push({ col, rSquaredGain: r * r });
  }
  ranked.sort((a, b) => b.rSquaredGain - a.rSquaredGain);

  await Analysis.create({ type: 'stepwise', datasetId, parameters: { candidateCols, yCol }, results: { ranked } });
  res.json({ ranked });
};

// ─── Matrix helpers ───────────────────────────────────────────────────────────
function transpose(M) {
  return M[0].map((_, ci) => M.map(row => row[ci]));
}
function matMul(A, B) {
  const rows = A.length, cols = B[0].length, inner = B.length;
  return Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) =>
      Array.from({ length: inner }, (_, k) => A[i][k] * B[k][j]).reduce((s, v) => s + v, 0)
    )
  );
}
function matVecMul(A, v) {
  return A.map(row => row.reduce((s, a, i) => s + a * v[i], 0));
}
function solveLinearSystem(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    if (Math.abs(M[col][col]) < 1e-10) throw new Error('Singular matrix');
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      for (let j = col; j <= n; j++) M[row][j] -= factor * M[col][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n] / M[i][i];
    for (let j = i - 1; j >= 0; j--) M[j][n] -= M[j][i] * x[i];
  }
  return x;
}
