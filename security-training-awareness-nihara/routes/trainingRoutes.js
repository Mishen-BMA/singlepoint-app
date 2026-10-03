const express = require('express');
const router = express.Router();
const c = require('../controllers/trainingController');
const { requireAdmin, requireUser } = require('../../authentication-authorization-charuka/middleware/auth');

router.get('/training/survey', requireUser, c.getSurvey);
router.post('/training/survey', requireUser, c.submitSurvey);
router.get('/training/modules', requireUser, c.listModules);
router.post('/training/modules', requireUser, requireAdmin, c.createModule);
router.put('/training/modules/:id', requireUser, requireAdmin, c.updateModule);
router.get('/training/modules/:id', requireUser, c.getModule);
router.get('/training/modules/:id/quiz', requireUser, c.getQuiz);
router.post('/training/modules/:id/quiz', requireUser, c.submitQuiz);
router.post('/training/modules/:id/quiz/questions', requireUser, requireAdmin, c.saveQuizQuestion);
router.put('/training/modules/:id/quiz/questions/:questionId', requireUser, requireAdmin, c.saveQuizQuestion);
router.get('/training/progress/me', requireUser, c.myProgress);

module.exports = router;