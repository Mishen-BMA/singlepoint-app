const db = require('../../models/db');

const PASS_MARK = 0.7;

async function getSurvey(req, res) {
  try {
    const r = await db.query('SELECT id, question FROM survey_questions ORDER BY id');
    res.json(r.rows);
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
      `SELECT m.id, m.title, m.category, m.duration_min,
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
    res.json(r.rows);
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: 'Server error' });
  }
}

async function getModule(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const r = await db.query(
      'SELECT id, title, category, duration_min, content FROM training_modules WHERE id = $1', [id]);
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
    const r = await db.query(
      'SELECT id, question, options FROM quiz_questions WHERE module_id = $1 ORDER BY id', [id]);
    res.json(r.rows);
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
      `SELECT m.id AS module_id, m.title,
              BOOL_OR(qa.passed) AS completed,
              MAX(qa.attempted_at) AS last_attempt
       FROM training_modules m
       LEFT JOIN quiz_attempts qa ON qa.module_id = m.id AND qa.user_id = $1
       GROUP BY m.id, m.title ORDER BY m.id`,
      [req.user.id]);
    res.json(r.rows.map(x => ({ ...x, completed: !!x.completed })));
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { getSurvey, submitSurvey, listModules, getModule, getQuiz, submitQuiz, myProgress };