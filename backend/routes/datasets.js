const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/datasetsController');

router.post('/upload', ctrl.uploadMiddleware, ctrl.uploadDataset);
router.get('/', ctrl.listDatasets);
router.get('/:id/preview', ctrl.previewDataset);
router.get('/:id/profile', ctrl.profileDataset);
router.get('/:id/nulls', ctrl.nullMap);
router.delete('/:id', ctrl.deleteDataset);

module.exports = router;
