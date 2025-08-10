const express = require('express');
const router = express.Router();
const { 
    createIssue, 
    getIssues, 
    voteIssue, 
    updateStatus, 
    getAnalytics 
} = require('../controllers/issueController');
const { isAuthenticated, isOfficial } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.post('/', isAuthenticated, upload, createIssue);
router.get('/', getIssues);
router.post('/:id/vote', isAuthenticated, voteIssue);
router.patch('/:id/status', isOfficial, updateStatus);
router.get('/analytics', isOfficial, getAnalytics);

module.exports = router;