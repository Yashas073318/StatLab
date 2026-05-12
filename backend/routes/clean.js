const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/cleanController');

router.post('/impute', ctrl.impute);
router.post('/normalize', ctrl.normalize);
router.post('/outliers', ctrl.removeOutliers);

module.exports = router;
