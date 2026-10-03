const db = require('../../models/db');
const {
  createQuizQuestion,
  createTrainingModule,
  updateQuizQuestion,
  updateTrainingModule
} = require('../models/trainingModel');
const { can, scopeOf } = require('../../authentication-authorization-charuka/middleware/permissions');
const { getScopeUserIds } = require('../../authentication-authorization-charuka/models/scopeModel');
const { getAllRoles } = require('../../authentication-authorization-charuka/models/roleModel');

const PASS_MARK = 0.7;

// Anyone with training.manage (admin) can access any module; everyone else
// is limited to modules assigned to their role or to them personally.
async function isModuleAccessible(user, moduleId) {
  if (await can(user, 'training.manage')) return true;

  const assignmentCount = await db.query(
    'SELECT COUNT(*) AS count FROM training_assignments WHERE module_id = $1',
    [moduleId]
  );
  if (Number(assignmentCount.rows[0]?.count || 0) === 0) return true;

  const result = await db.query(
    `SELECT 1 FROM training_assignments WHERE module_id = $1 AND (role_key = $2 OR user_id = $3)`,
    [moduleId, user.role, user.id]
  );
  return result.rowCount > 0;
}

function validateModule({ title, category, durationMin, content }) {
  return typeof title === 'string' && title.trim().length >= 3 &&
    typeof category === 'string' && category.trim().length >= 2 &&
    Number.isInteger(Number(durationMin)) && Number(durationMin) >= 1 && Number(durationMin) <= 240 &&
    typeof content === 'string' && content.trim().length >= 10;
}

function validTargetRoles(targetRoles) {
  return targetRoles === undefined || (Array.isArray(targetRoles) &&
    targetRoles.every((role) => ['admin', 'ceo', 'manager', 'software_engineer', 'hr', 'data_science'].includes(role)));
}

function validateQuizQuestion({ question, options, correctIndex }) {
  return typeof question === 'string' && question.trim().length >= 8 &&
    Array.isArray(options) && options.length >= 2 && options.length <= 6 &&
    options.every((option) => typeof option === 'string' && option.trim().length > 0) &&
    Number.isInteger(Number(correctIndex)) && Number(correctIndex) >= 0 && Number(correctIndex) < options.length;
}

async function createModule(req, res) {
  const { title, category, durationMin, content, targetRoles = [] } = req.body;
  if (!validateModule({ title, category, durationMin, content }) || !validTargetRoles(targetRoles)) {
    return res.status(400).json({ error: 'Provide a title, category, lesson content, and duration from 1 to 240 minutes' });
  }
  try {
    const module = await createTrainingModule({ title: title.trim(), category: category.trim(), durationMin: Number(durationMin), content: content.trim(), targetRoles });
    res.status(201).json(module);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Failed to create training module' });
  }
}

async function updateModule(req, res) {
  const id = Number(req.params.id);
  const { title, category, durationMin, content, targetRoles = [] } = req.body;
  if (!Number.isInteger(id) || id < 1 || !validateModule({ title, category, durationMin, content }) || !validTargetRoles(targetRoles)) {
    return res.status(400).json({ error: 'Provide a valid module and complete module details' });
  }
  try {
    const module = await updateTrainingModule(id, { title: title.trim(), category: category.trim(), durationMin: Number(durationMin), content: content.trim(), targetRoles });
    if (!module) return res.status(404).json({ error: 'Training module not found' });
    res.json(module);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Failed to update training module' });
  }
}

async function saveQuizQuestion(req, res) {
  const moduleId = Number(req.params.id);
  const questionId = req.params.questionId ? Number(req.params.questionId) : null;
  const { question, options, correctIndex } = req.body;
  if (!Number.isInteger(moduleId) || moduleId < 1 || (questionId !== null && (!Number.isInteger(questionId) || questionId < 1)) || !validateQuizQuestion({ question, options, correctIndex })) {
    return res.status(400).json({ error: 'Provide a question, 2-6 options, and a valid correct option index' });
  }
  try {
    const saved = questionId
      ? await updateQuizQuestion(moduleId, questionId, { question: question.trim(), options, correctIndex: Number(correctIndex) })
      : await createQuizQuestion(moduleId, { question: question.trim(), options, correctIndex: Number(correctIndex) });
    if (!saved) return res.status(404).json({ error: 'Quiz question not found' });
    res.status(questionId ? 200 : 201).json(saved);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Failed to save quiz question' });
  }
}

async function getSurvey(req, res) {
  try {
    const [questions, responses] = await Promise.all([
      db.query('SELECT id, question FROM survey_questions ORDER BY id'),
      db.query('SELECT question_id, answer FROM survey_responses WHERE user_id = $1', [req.user.id])
    ]);
    res.json({
      questions: questions.rows,
      answers: responses.rows,
      complete: questions.rowCount > 0 && responses.rowCount === questions.rowCount
    });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: 'Server error' });
  }
}

async function submitSurvey(req, res) {
  const answers = req.body.answers;
  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: 'answers must be a non-empty array' });
  }
  for (const a of answers) {
    if (!Number.isInteger(a.questionId) || !['yes', 'no'].includes(a.answer)) {
      return res.status(400).json({ error: 'Each answer needs questionId and yes/no' });
    }
  }
  try {
    for (const a of answers) {
      await db.query(
        `INSERT INTO survey_responses (user_id, question_id, answer)
         VALUES ($1,$2,$3)
         ON CONFLICT (user_id, question_id)
         DO UPDATE SET answer = EXCLUDED.answer, answered_at = NOW()`,
        [req.user.id, a.questionId, a.answer]);
    }
    const r = await db.query(
      `SELECT DISTINCT q.module_id
       FROM survey_responses r
       JOIN survey_questions q ON q.id = r.question_id
       WHERE r.user_id = $1 AND r.answer = q.weak_answer`,
      [req.user.id]);
    res.json({ recommendedModules: r.rows.map(x => Number(x.module_id)) });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: 'Server error' });
  }
}

async function listModules(req, res) {
  try {
    const r = await db.query(
      `SELECT m.id, m.title, m.category, m.duration_min, m.target_roles, m.created_at,
        (SELECT MAX(sr.answered_at) FROM survey_responses sr
         JOIN survey_questions sq ON sq.id = sr.question_id
         WHERE sr.user_id = $1 AND sr.answer = sq.weak_answer AND sq.module_id = m.id) AS recommended_at,
        EXISTS (
          SELECT 1 FROM survey_responses sr
          JOIN survey_questions sq ON sq.id = sr.question_id
          WHERE sr.user_id = $1 AND sr.answer = sq.weak_answer AND sq.module_id = m.id
        ) AS recommended,
        EXISTS (
          SELECT 1 FROM quiz_attempts qa
          WHERE qa.user_id = $1 AND qa.module_id = m.id AND qa.passed = TRUE
        ) AS completed
       FROM training_modules m
       ORDER BY m.id`,
      [req.user.id]);
    res.json(r.rows.map((module) => {
      const roleRecommended = (module.target_roles || '').split(',').map((role) => role.trim()).includes(req.user.role);
      const recommended = Boolean(module.recommended) || roleRecommended;
      const recommendedAt = module.recommended_at || (roleRecommended ? module.created_at : null);
      return {
        ...module,
        recommended,
        recommended_at: recommendedAt,
        completed: Boolean(module.completed),
        overdue: recommended && !Boolean(module.completed) &&
          (recommendedAt ? Date.parse(recommendedAt) <= Date.now() - 30 * 24 * 60 * 60 * 1000 : false)
      };
    }));
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: 'Server error' });
  }
}

async function getModule(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    if (!(await isModuleAccessible(req.user, id))) {
      return res.status(404).json({ error: 'Module not found' });
    }
    const r = await db.query(
      'SELECT id, title, category, duration_min, content, target_roles FROM training_modules WHERE id = $1', [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Module not found' });
    res.json(r.rows[0]);
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: 'Server error' });
  }
}

// correct_index is never sent to the frontend
async function getQuiz(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    if (!(await isModuleAccessible(req.user, id))) {
      return res.status(404).json({ error: 'Module not found' });
    }
    const r = await db.query(
      'SELECT id, question, options FROM quiz_questions WHERE module_id = $1 ORDER BY id', [id]);
    res.json(r.rows.map((question) => ({
      ...question,
      options: typeof question.options === 'string' ? JSON.parse(question.options) : question.options
    })));
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: 'Server error' });
  }
}

// grading happens on the server
async function submitQuiz(req, res) {
  const id = parseInt(req.params.id, 10);
  const answers = req.body.answers; // { "<questionId>": selectedIndex }
  if (!Number.isInteger(id) || !answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'Invalid request' });
  }
  try {
    if (!(await isModuleAccessible(req.user, id))) {
      return res.status(404).json({ error: 'Module not found' });
    }
    const r = await db.query(
      'SELECT id, correct_index FROM quiz_questions WHERE module_id = $1', [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'No quiz for this module' });

    let score = 0;
    for (const q of r.rows) {
      if (Number(answers[q.id]) === q.correct_index) score++;
    }
    const total = r.rows.length;
    const passed = score / total >= PASS_MARK;

    await db.query(
      `INSERT INTO quiz_attempts (user_id, module_id, score, total, passed)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.user.id, id, score, total, passed]);

    res.json({ score, total, passed });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: 'Server error' });
  }
}

async function myProgress(req, res) {
  try {
    const r = await db.query(
                  `SELECT m.id AS module_id, m.title, m.target_roles, m.created_at,
                          (SELECT MAX(sr.answered_at) FROM survey_responses sr
                           JOIN survey_questions sq ON sq.id = sr.question_id
                           WHERE sr.user_id = $1 AND sr.answer = sq.weak_answer AND sq.module_id = m.id) AS recommended_at,
                    EXISTS (
                SELECT 1 FROM survey_responses sr
                JOIN survey_questions sq ON sq.id = sr.question_id
                WHERE sr.user_id = $1 AND sr.answer = sq.weak_answer AND sq.module_id = m.id
                    ) AS recommended,
              MAX(CASE WHEN qa.passed = TRUE THEN 1 ELSE 0 END) AS completed,
              MAX(qa.attempted_at) AS last_attempt
       FROM training_modules m
       LEFT JOIN quiz_attempts qa ON qa.module_id = m.id AND qa.user_id = $1
       WHERE EXISTS (
         SELECT 1 FROM training_assignments ta
         WHERE ta.module_id = m.id AND (ta.role_key = $2 OR ta.user_id = $1)
       )
       GROUP BY m.id, m.title ORDER BY m.id`,
      [req.user.id, req.user.role]);
    res.json(r.rows.map((row) => {
      const roleRecommended = (row.target_roles || '').split(',').includes(req.user.role);
      const recommended = Boolean(row.recommended) || roleRecommended;
      const recommendedAt = row.recommended_at || (roleRecommended ? row.created_at : null);
      return {
        ...row,
        recommended,
        recommended_at: recommendedAt,
        completed: Number(row.completed) === 1,
        overdue: recommended && Number(row.completed) !== 1 &&
          Date.parse(recommendedAt) <= Date.now() - 30 * 24 * 60 * 60 * 1000
      };
    }));
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: 'Server error' });
  }
}

async function getModuleAssignments(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const result = await db.query(
      `SELECT ta.id, ta.role_key, ta.user_id, ta.due_days, u.name AS user_name, u.email AS user_email
       FROM training_assignments ta
       LEFT JOIN users u ON u.id = ta.user_id
       WHERE ta.module_id = $1
       ORDER BY ta.role_key, ta.user_id`,
      [id]
    );
    res.json(result.rows);
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: 'Failed to fetch training assignments' });
  }
}

async function setModuleAssignments(req, res) {
  const id = parseInt(req.params.id, 10);
  const { roleKeys, userIds, dueDays } = req.body;
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  if (!Array.isArray(roleKeys) && !Array.isArray(userIds)) {
    return res.status(400).json({ error: 'Provide roleKeys and/or userIds arrays' });
  }
  const due = Number.isFinite(dueDays) ? dueDays : 30;

  // Two ways in: full role+user assignment control (roles.manage_assignments,
  // admin), or restricted user-only assignment within a manager's own team
  // (training.assign_user).
  const canManageAll = await can(req.user, 'roles.manage_assignments');
  const assignScope = await scopeOf(req.user, 'training.assign_user');
  if (!canManageAll && !assignScope) {
    return res.status(403).json({ error: 'You do not have permission to perform this action' });
  }
  if (!canManageAll) {
    if (Array.isArray(roleKeys) && roleKeys.length > 0) {
      return res.status(403).json({ error: 'Only an administrator can assign training by role' });
    }
    const allowedIds = await getScopeUserIds(req.user, assignScope);
    const outOfScope = (userIds || []).some((userId) => allowedIds && !allowedIds.map(String).includes(String(userId)));
    if (outOfScope) {
      return res.status(404).json({ error: 'User not found' });
    }
  }

  try {
    const moduleRow = await db.query('SELECT id FROM training_modules WHERE id = $1', [id]);
    if (moduleRow.rowCount === 0) return res.status(404).json({ error: 'Training module not found' });

    const validRoles = (await getAllRoles()).map((role) => role.key);
    for (const roleKey of roleKeys || []) {
      if (!validRoles.includes(roleKey)) {
        return res.status(400).json({ error: `Unknown role: ${roleKey}` });
      }
    }

    await db.transaction(async (query) => {
      if (canManageAll) {
        await query('DELETE FROM training_assignments WHERE module_id = $1', [id]);
      } else {
        // Managers only touch their own individual-user assignment rows,
        // leaving any role-based assignments made by an admin untouched.
        for (const userId of userIds || []) {
          await query('DELETE FROM training_assignments WHERE module_id = $1 AND user_id = $2', [id, userId]);
        }
      }
      for (const roleKey of roleKeys || []) {
        await query(
          'INSERT INTO training_assignments (module_id, role_key, due_days) VALUES ($1, $2, $3)',
          [id, roleKey, due]
        );
      }
      for (const userId of userIds || []) {
        await query(
          'INSERT INTO training_assignments (module_id, user_id, due_days) VALUES ($1, $2, $3)',
          [id, userId, due]
        );
      }
    });

    const result = await db.query('SELECT * FROM training_assignments WHERE module_id = $1', [id]);
    res.json(result.rows);
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: 'Failed to update training assignments' });
  }
}

module.exports = {
  getSurvey, submitSurvey, listModules, getModule, getQuiz, submitQuiz, myProgress,
  createModule, updateModule, saveQuizQuestion, getModuleAssignments, setModuleAssignments
};