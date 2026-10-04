import { useEffect, useState } from 'react';
import { api } from './api';

function TrainingCenter({ user }) {
  const isAdmin = user.role === 'admin';
  const [modules, setModules] = useState([]);
  const [progress, setProgress] = useState([]);
  const [survey, setSurvey] = useState(null);
  const [answers, setAnswers] = useState({});
  const [activeModule, setActiveModule] = useState(null);
  const [quiz, setQuiz] = useState([]);
  const [selected, setSelected] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [moduleForm, setModuleForm] = useState({ title: '', category: '', durationMin: 10, content: '', targetRoles: [] });
  const [editingModuleId, setEditingModuleId] = useState(null);
  const [questionForm, setQuestionForm] = useState({ question: '', options: ['', ''], correctIndex: 0 });
  const [managementMessage, setManagementMessage] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  async function refresh() {
    const [moduleData, progressData, surveyData] = await Promise.all([
      api('/training/modules'), api('/training/progress/me'), api('/training/survey')
    ]);
    setModules(moduleData);
    setProgress(progressData);
    setSurvey(surveyData);
    setAnswers(Object.fromEntries((surveyData.answers || []).map((item) => [item.question_id, item.answer])));
  }

  useEffect(() => { refresh().catch((loadError) => setError(loadError.message)); }, []);

  async function submitSurvey(event) {
    event.preventDefault();
    try {
      await api('/training/survey', {
        method: 'POST',
        body: { answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId: Number(questionId), answer })) }
      });
      await refresh();
    } catch (submitError) { setError(submitError.message); }
  }

  async function openModule(module) {
    setError('');
    setResult(null);
    setSelected({});
    try {
      const [details, questions] = await Promise.all([
        api(`/training/modules/${module.id}`), api(`/training/modules/${module.id}/quiz`)
      ]);
      setActiveModule(details);
      setQuiz(questions);
    } catch (loadError) { setError(loadError.message); }
  }

  async function submitQuiz(event) {
    event.preventDefault();
    try {
      const score = await api(`/training/modules/${activeModule.id}/quiz`, {
        method: 'POST',
        body: { answers: selected }
      });
      setResult(score);
      await refresh();
    } catch (submitError) { setError(submitError.message); }
  }

  async function saveModule(event) {
    event.preventDefault();
    setError('');
    setManagementMessage('');
    try {
      const savedModule = await api(editingModuleId ? `/training/modules/${editingModuleId}` : '/training/modules', {
        method: editingModuleId ? 'PUT' : 'POST',
        body: { ...moduleForm, durationMin: Number(moduleForm.durationMin) }
      });
      setModuleForm({ title: '', category: '', durationMin: 10, content: '', targetRoles: [] });
      setEditingModuleId(null);
      setManagementMessage('Training module saved. Add at least one quiz question before assigning it.');
      await refresh();
      if (!editingModuleId) await openModule(savedModule);
    } catch (saveError) { setError(saveError.message); }
  }

  async function editModule(module) {
    try {
      const details = await api(`/training/modules/${module.id}`);
      setEditingModuleId(module.id);
      setModuleForm({ title: details.title, category: details.category, durationMin: details.duration_min, content: details.content, targetRoles: String(details.target_roles || '').split(',').filter(Boolean) });
      window.requestAnimationFrame(() => {
        document.getElementById('training-editor-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('training-title-input')?.focus();
      });
    } catch (loadError) { setError(loadError.message); }
  }

  async function deleteModule(module) {
    if (pendingDeleteId !== module.id) {
      setPendingDeleteId(module.id);
      setManagementMessage(`Click Delete again to permanently remove "${module.title}".`);
      return;
    }
    setError('');
    setManagementMessage('');
    try {
      await api(`/training/modules/${module.id}`, { method: 'DELETE' });
      setManagementMessage('Training module deleted.');
      setPendingDeleteId(null);
      await refresh();
    } catch (deleteError) {
      setError(deleteError.message);
      setPendingDeleteId(null);
    }
  }

  async function addQuizQuestion(event) {
    event.preventDefault();
    setError('');
    setManagementMessage('');
    const options = questionForm.options.split(/\r?\n/).map((option) => option.trim()).filter(Boolean);
    try {
      await api(`/training/modules/${activeModule.id}/quiz/questions`, {
        method: 'POST',
        body: { question: questionForm.question, options, correctIndex: Number(questionForm.correctIndex) }
      });
      setQuestionForm({ question: '', options: ['', ''], correctIndex: 0 });
      setManagementMessage('Quiz question added.');
      await openModule(activeModule);
    } catch (saveError) { setError(saveError.message); }
  }

  if (error) return <p className="error-message" role="alert">{error}</p>;
  if (!survey) return <p>Loading training...</p>;

  return (
    <div className="page-stack">
      {activeModule ? (
        <section className="data-section">
          <button className="link-button" onClick={() => { setActiveModule(null); setResult(null); }}>Back to training</button>
          <span className="eyebrow">{activeModule.category} · {activeModule.duration_min} MIN</span>
          <h2>{activeModule.title}</h2>
          <p className="lesson-copy">{activeModule.content}</p>
          {isAdmin && <section className="authoring-section">
            <h3>Quiz authoring</h3>
            <form className="stack-form" onSubmit={addQuizQuestion}>
              <label>Question<input value={questionForm.question} onChange={(event) => setQuestionForm({ ...questionForm, question: event.target.value })} minLength="8" required /></label>
              <fieldset className="quiz-authoring-options">
                <legend>Answer options</legend>
                {questionForm.options.map((option, optionIndex) => (
                  <label className="quiz-authoring-option" key={optionIndex}>
                    <input type="radio" name="correct-answer" checked={questionForm.correctIndex === optionIndex} onChange={() => setQuestionForm({ ...questionForm, correctIndex: optionIndex })} aria-label={`Mark option ${optionIndex + 1} as correct`} />
                    <input value={option} onChange={(event) => setQuestionForm({ ...questionForm, options: questionForm.options.map((current, index) => index === optionIndex ? event.target.value : current) })} placeholder={`Answer option ${optionIndex + 1}`} required />
                  </label>
                ))}
                {questionForm.options.length < 6 && <button type="button" className="btn-secondary" onClick={() => setQuestionForm({ ...questionForm, options: [...questionForm.options, ''] })}>Add answer option</button>}
                <small>Select the radio button beside the correct answer.</small>
              </fieldset>
              <button className="btn-secondary" type="submit">Add quiz question</button>
            </form>
            {managementMessage && <p className="success-message" role="status">{managementMessage}</p>}
          </section>}
          <form onSubmit={submitQuiz} className="quiz-list">
            {quiz.map((question, index) => (
              <fieldset className="quiz-question" key={question.id}>
                <legend>{index + 1}. {question.question}</legend>
                {question.options.map((option, optionIndex) => (
                  <label className="choice-row" key={option}>
                    <input type="radio" name={`question-${question.id}`} checked={Number(selected[question.id]) === optionIndex} onChange={() => setSelected((current) => ({ ...current, [question.id]: optionIndex }))} required />
                    <span>{option}</span>
                  </label>
                ))}
              </fieldset>
            ))}
            {result && <p className={result.passed ? 'success-message' : 'error-message'} role="status">Score: {result.score}/{result.total}. {result.passed ? 'Passed. You can retake the quiz any time.' : 'Not passed yet. Review the lesson and try again.'}</p>}
            <button className="btn-primary" type="submit">Submit answers</button>
          </form>
        </section>
      ) : (
        <>
          {isAdmin && <section className="data-section">
            <span className="eyebrow">ADMIN CONTENT</span>
            <h2>{editingModuleId ? 'Edit training module' : 'Create training module'}</h2>
            <form id="training-editor-form" className="stack-form" onSubmit={saveModule}>
              <label>Title<input id="training-title-input" value={moduleForm.title} onChange={(event) => setModuleForm({ ...moduleForm, title: event.target.value })} minLength="3" required /></label>
              <label>Category<input value={moduleForm.category} onChange={(event) => setModuleForm({ ...moduleForm, category: event.target.value })} minLength="2" required /></label>
              <fieldset className="target-roles"><legend>Required for roles</legend>{[['ceo', 'CEO'], ['manager', 'Manager'], ['software_engineer', 'Software Engineer'], ['hr', 'HR'], ['data_science', 'Data Analyst / Data Science']].map(([role, label]) => <label key={role}><input type="checkbox" checked={moduleForm.targetRoles.includes(role)} onChange={(event) => setModuleForm({ ...moduleForm, targetRoles: event.target.checked ? [...moduleForm.targetRoles, role] : moduleForm.targetRoles.filter((target) => target !== role) })} />{label}</label>)}</fieldset>
              <label>Duration in minutes<input type="number" min="1" max="240" value={moduleForm.durationMin} onChange={(event) => setModuleForm({ ...moduleForm, durationMin: event.target.value })} required /></label>
              <label>Lesson content<textarea rows="5" value={moduleForm.content} onChange={(event) => setModuleForm({ ...moduleForm, content: event.target.value })} minLength="10" required /></label>
              <div className="button-row"><button className="btn-primary" type="submit">{editingModuleId ? 'Save changes' : 'Create module'}</button>{editingModuleId && <button className="btn-secondary" type="button" onClick={() => { setEditingModuleId(null); setModuleForm({ title: '', category: '', durationMin: 10, content: '', targetRoles: [] }); }}>Cancel</button>}</div>
            </form>
            {managementMessage && <p className="success-message" role="status">{managementMessage}</p>}
          </section>}
          {!survey.complete && <section className="data-section">
            <span className="eyebrow">PERSONALIZED TRAINING</span>
            <h2>Security habits survey</h2>
            <p>Your answers recommend the modules most relevant to your work.</p>
            <form className="survey-form" onSubmit={submitSurvey}>
              {survey.questions.map((question) => (
                <fieldset className="survey-question" key={question.id}>
                  <legend>{question.question}</legend>
                  {['yes', 'no'].map((answer) => (
                    <label className="choice-row" key={answer}>
                      <input type="radio" name={`survey-${question.id}`} value={answer} checked={answers[question.id] === answer} onChange={() => setAnswers((current) => ({ ...current, [question.id]: answer }))} required />
                      <span>{answer === 'yes' ? 'Yes' : 'No'}</span>
                    </label>
                  ))}
                </fieldset>
              ))}
              <button className="btn-primary" type="submit">Get recommendations</button>
            </form>
          </section>}
          <section className="data-section">
            <div className="section-heading"><div><span className="eyebrow">LEARN AND PRACTICE</span><h2>Training modules</h2></div><span>{progress.filter((item) => item.recommended && item.completed).length}/{progress.filter((item) => item.recommended).length} recommended complete</span></div>
            <div className="module-list">
              {modules.map((module) => (
                <article className="module-row" key={module.id}>
                  <div><span className="eyebrow">{module.category} · {module.duration_min} MIN</span><h3>{module.title}</h3><span className={module.overdue ? 'module-status status-overdue' : 'module-status'}>{module.completed ? 'Completed' : module.overdue ? 'Overdue' : module.recommended ? 'Recommended for you' : 'Available'}</span></div>
                  <div className="button-row">
                    {isAdmin && <><button type="button" className="btn-secondary" onClick={() => editModule(module)}>Edit</button><button type="button" className="btn-danger" onClick={() => deleteModule(module)}>{pendingDeleteId === module.id ? 'Confirm delete' : 'Delete'}</button></>}
                    <button type="button" className="btn-secondary" onClick={() => openModule(module)}>{isAdmin ? 'Add questions & answers' : module.completed ? 'Retake' : 'Start'}</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default TrainingCenter;