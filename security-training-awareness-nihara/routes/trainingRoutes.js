const express = require('express');
const router = express.Router();
const c = require('../controllers/trainingController');
const { requireUser } = require('../../authentication-authorization-charuka/middleware/auth');
const { requirePermission } = require('../../authentication-authorization-charuka/middleware/permissions');

router.get('/training/survey', requireUser, c.getSurvey);
router.post('/training/survey', requireUser, c.submitSurvey);
router.get('/training/modules', requireUser, c.listModules);
router.post('/training/modules', requireUser, requirePermission('training.manage'), c.createModule);
router.put('/training/modules/:id', requireUser, requirePermission('training.manage'), c.updateModule);
router.delete('/training/modules/:id', requireUser, requirePermission('training.manage'), c.deleteModule);
router.get('/training/modules/:id', requireUser, c.getModule);
router.get('/training/modules/:id/quiz', requireUser, c.getQuiz);
router.post('/training/modules/:id/quiz', requireUser, c.submitQuiz);
router.post('/training/modules/:id/quiz/questions', requireUser, requirePermission('training.manage'), c.saveQuizQuestion);
router.put('/training/modules/:id/quiz/questions/:questionId', requireUser, requirePermission('training.manage'), c.saveQuizQuestion);
router.get('/training/modules/:id/assignments', requireUser, requirePermission('roles.manage_assignments'), c.getModuleAssignments);
router.put('/training/modules/:id/assignments', requireUser, c.setModuleAssignments);
router.get('/training/progress/me', requireUser, c.myProgress);

module.exports = router;