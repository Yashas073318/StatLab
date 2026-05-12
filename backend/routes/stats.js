const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/statsController');

router.get('/boxplot/:datasetId', ctrl.boxplot);
router.post('/ttest/paired', ctrl.pairedTTest);
router.post('/correlation/pearson', ctrl.pearsonCorr);
router.post('/correlation/matrix', ctrl.correlationMatrix);
router.get('/scatter', ctrl.scatter);
router.post('/correlation/spearman', ctrl.spearmanCorr);
router.get('/correlation/compare', ctrl.correlationCompare);
router.post('/correlation/synthetic', ctrl.syntheticCorrelation);
router.get('/correlation/gallery', ctrl.correlationGallery);
router.post('/regression/simple', ctrl.simpleRegression);
router.post('/regression/predict', ctrl.regressionPredict);
router.post('/regression/multiple', ctrl.multipleRegression);
router.post('/regression/predict/multiple', ctrl.regressionPredictMultiple);
router.post('/regression/stepwise', ctrl.stepwiseRegression);

module.exports = router;
