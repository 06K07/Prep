const $ = (id) => document.getElementById(id);

const state = {
  sessionId: null,
  part: 'dsa',
  secondsLeft: { dsa: 0, repo: 0 },
  secondsSpent: { dsa: 0, repo: 0 },
  problems: [],
  activeProblem: 0,
  files: {},
  original: {},
  currentFile: null,
  repoTitle: '',
  aiRemaining: 0,
  aiEnabled: false,
  lastRepoOutput: '',
  timerId: null,
};

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `Request failed (${response.status})`);
  return data;
}

/** Disables a button while an async action runs. */
async function busy(button, action) {
  button.disabled = true;
  try {
    await action();
  } finally {
    button.disabled = false;
  }
}

function setOutput(element, lines) {
  element.replaceChildren(
    ...lines.map(({ text, className }) => {
      const span = document.createElement('span');
      if (className) span.className = className;
      span.textContent = `${text}\n`;
      return span;
    }),
  );
}

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

const current = () => state.problems[state.activeProblem];

// ---------- setup ----------
async function loadCatalog() {
  try {
    const catalog = await api('/api/catalog');
    const { dsaMinutesPerQuestion, dsaQuestions, repoMinutes } = catalog.limits;
    $('count-select').value = String(dsaQuestions);
    const showMinutes = () => {
      $('dsa-min').textContent = dsaMinutesPerQuestion * Number($('count-select').value);
    };
    $('count-select').addEventListener('change', showMinutes);
    showMinutes();
    $('repo-min').textContent = repoMinutes;
    for (const item of catalog.repos) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.title} (${item.difficulty})`;
      $('repo-select').append(option);
    }
  } catch (err) {
    $('setup-error').textContent = err.message;
  }
}

async function startTest() {
  $('setup-error').textContent = '';
  const session = await api('/api/sessions', {
    method: 'POST',
    body: { repoId: $('repo-select').value, dsaCount: Number($('count-select').value) },
  });
  state.sessionId = session.sessionId;
  state.problems = session.problems.map((p) => ({
    ...p,
    code: p.starter,
    customInput: '5 3\n1 -1 5 -2 3',
    solved: false,
  }));
  state.files = { ...session.repo.files };
  state.original = { ...session.repo.files };
  state.secondsLeft = {
    dsa: session.limits.dsaMinutes * 60,
    repo: session.limits.repoMinutes * 60,
  };
  state.aiRemaining = session.limits.aiQueries;
  state.aiEnabled = session.limits.aiQueries > 0;
  state.repoTitle = session.repo.title;

  $('setup').hidden = true;
  $('app').hidden = false;
  renderQuestionTabs();
  loadQuestion(0);
  showPart('dsa');
  tick();
  state.timerId = setInterval(tick, 1000);
  window.addEventListener('beforeunload', warnBeforeLeave);
}

const warnBeforeLeave = (event) => {
  event.preventDefault();
  event.returnValue = '';
};

// ---------- timer & parts ----------
function showPart(part) {
  state.part = part;
  $('dsa-view').hidden = part !== 'dsa';
  $('repo-view').hidden = part !== 'repo';
  $('part-title').textContent = part === 'dsa' ? 'Part 1: DSA' : `Part 2: ${state.repoTitle}`;
  updateAiPill();
  if (part === 'repo' && !state.currentFile) renderFiles(sortedFileNames()[0]);
}

function tick() {
  const left = Math.max(state.secondsLeft[state.part], 0);
  $('timer').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  $('timer').classList.toggle('low', left < 300);
  if (state.secondsLeft[state.part] <= 0) return submitPart();
  state.secondsLeft[state.part] -= 1;
  state.secondsSpent[state.part] += 1;
}

function submitPart() {
  if (state.part === 'dsa') {
    saveQuestion();
    showPart('repo');
    tick();
  } else {
    finish().catch((err) => {
      $('result').hidden = false;
      $('result-card').textContent = err.message;
    });
  }
}

// ---------- DSA ----------
function renderQuestionTabs() {
  $('q-tabs').replaceChildren(
    ...state.problems.map((problem, index) => {
      const tab = el('button', `Q${index + 1}`, `tab${problem.solved ? ' solved' : ''}`);
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(index === state.activeProblem));
      tab.title = problem.title;
      tab.addEventListener('click', () => {
        saveQuestion();
        loadQuestion(index);
      });
      return tab;
    }),
  );
}

function saveQuestion() {
  const problem = current();
  problem.code = $('code').value;
  problem.customInput = $('custom-input').value;
}

function loadQuestion(index) {
  state.activeProblem = index;
  const problem = current();
  $('problem-title').textContent = `${problem.title} (${problem.difficulty})`;
  $('statement').textContent = problem.statement;
  $('code').value = problem.code;
  $('custom-input').value = problem.customInput;
  $('sample-output').textContent = '';
  $('dsa-output').textContent = problem.lastOutput || 'Output will appear here.';
  renderQuestionTabs();
}

async function runSample() {
  saveQuestion();
  setOutput($('sample-output'), [{ text: 'Compiling...' }]);
  const result = await api(`/api/sessions/${state.sessionId}/dsa/sample`, {
    method: 'POST',
    body: { problemId: current().id, code: $('code').value, input: $('custom-input').value },
  });
  setOutput($('sample-output'), [{ text: result.compileError || result.output || '(no output)' }]);
}

async function runDsa() {
  saveQuestion();
  const problem = current();
  setOutput($('dsa-output'), [{ text: 'Compiling and running...' }]);
  const result = await api(`/api/sessions/${state.sessionId}/dsa/run`, {
    method: 'POST',
    body: { problemId: problem.id, code: $('code').value },
  });
  if (result.compileError) {
    setOutput($('dsa-output'), [{ text: result.compileError, className: 'fail' }]);
    return;
  }
  problem.solved = result.passed === result.total;
  setOutput(
    $('dsa-output'),
    result.results.map((r, i) => ({
      text: `Test ${i + 1}${r.large ? ' (large)' : ''}: ${r.verdict} (${r.durationMs}ms)`,
      className: r.verdict === 'PASS' ? 'pass' : 'fail',
    })),
  );
  problem.lastOutput = $('dsa-output').textContent;
  renderQuestionTabs();
}

// ---------- repo ----------
const sortedFileNames = () =>
  Object.keys(state.files).sort((a, b) =>
    a === 'README.md' ? -1 : b === 'README.md' ? 1 : a.localeCompare(b),
  );

function renderFiles(selected) {
  state.currentFile = selected;
  $('file-editor').value = state.files[selected];
  $('file-tabs').replaceChildren(
    ...sortedFileNames().map((name) => {
      const tab = el('button', name, 'file');
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(name === selected));
      tab.addEventListener('click', () => renderFiles(name));
      return tab;
    }),
  );
}

async function runRepo() {
  setOutput($('repo-output'), [{ text: 'Compiling and running tests...' }]);
  const result = await api(`/api/sessions/${state.sessionId}/repo/run`, {
    method: 'POST',
    body: { files: state.files },
  });
  state.lastRepoOutput = result.output;
  setOutput(
    $('repo-output'),
    result.output.split('\n').map((line) => ({
      text: line,
      className: line.startsWith('PASS') ? 'pass' : line.startsWith('FAIL') ? 'fail' : '',
    })),
  );
}

function resetRepo() {
  if (!confirm('All your changes will be lost. Reset the repo?')) return;
  state.files = { ...state.original };
  renderFiles(state.currentFile);
}

// ---------- AI ----------
function updateAiPill() {
  $('ai-pill').textContent =
    state.part === 'repo'
      ? state.aiEnabled
        ? `AI left: ${state.aiRemaining}`
        : 'AI: not configured'
      : '';
  $('ai-ask').disabled = !state.aiEnabled;
}

async function askAi() {
  const question = $('ai-question').value.trim();
  if (!question) return;
  $('ai-answer').textContent = 'Thinking...';
  try {
    const result = await api(`/api/sessions/${state.sessionId}/ai`, {
      method: 'POST',
      body: { question, files: state.files, testOutput: state.lastRepoOutput },
    });
    state.aiRemaining = result.remaining;
    $('ai-answer').textContent = result.answer;
    $('ai-question').value = '';
  } catch (err) {
    $('ai-answer').textContent = err.message;
  }
  updateAiPill();
}

// ---------- report ----------
const fmtMinutes = (seconds) => `${Math.round(seconds / 60)} min`;

function section(title, ...children) {
  const wrapper = el('div');
  wrapper.append(el('h3', title), ...children);
  return wrapper;
}

function list(items, emptyText) {
  if (items.length === 0) return el('p', emptyText, 'muted');
  const ul = el('ul');
  for (const item of items) ul.append(el('li', item));
  return ul;
}

function reportText(report) {
  const lines = [`Overall: ${report.overall}%`, '', 'DSA:'];
  for (const q of report.dsa.questions) {
    const status = q.solved
      ? `solved in ${q.minutesToSolve} min`
      : `${q.bestPassed}/${q.total || '?'} tests`;
    lines.push(`- ${q.title}: ${status}, ${q.attempts} run(s)`);
  }
  lines.push('', `Repo: ${report.repo.passed ?? 0}/${report.repo.total ?? '?'} tests passing`);
  lines.push(`Bugs fixed: ${report.repo.fixed.join(', ') || 'none'}`);
  lines.push(`Still failing: ${report.repo.stillFailing.join(', ') || 'none'}`);
  lines.push(
    report.ai.limit > 0
      ? `AI hints: ${report.ai.used}/${report.ai.limit}`
      : 'AI helper: not configured',
  );
  return lines.join('\n');
}

async function finish() {
  clearInterval(state.timerId);
  window.removeEventListener('beforeunload', warnBeforeLeave);
  $('dsa-view').hidden = $('repo-view').hidden = $('submit-part').hidden = true;
  $('result').hidden = false;
  $('result-card').textContent = 'Building your report...';

  const report = await api(`/api/sessions/${state.sessionId}/report`, {
    method: 'POST',
    body: { secondsSpent: state.secondsSpent },
  });

  const card = $('result-card');
  card.classList.add('report');
  card.replaceChildren(
    el('h2', 'Your report'),
    el('p', `${report.overall}%`, 'score'),
    el('p', 'overall (50% DSA, 50% backend repo)', 'muted'),
    section(
      `DSA (${report.dsa.score}%)`,
      list(
        report.dsa.questions.map((q) => {
          const result = q.solved
            ? `solved in ${q.minutesToSolve} min`
            : `best ${q.bestPassed}/${q.total || '?'} tests`;
          return `${q.title}: ${result} (${q.attempts} run${q.attempts === 1 ? '' : 's'}, ${q.compileErrors} compile error${q.compileErrors === 1 ? '' : 's'})`;
        }),
        'No DSA questions.',
      ),
    ),
    section(
      `Backend repo (${report.repo.score}%)`,
      el(
        'p',
        report.repo.runs
          ? `${report.repo.passed}/${report.repo.total} tests passing after ${report.repo.runs} run(s)${report.repo.allGreen ? `, all green at ${report.repo.minutesToAllGreen} min` : ''}`
          : 'You did not run the repo tests.',
      ),
      el('p', `Bugs you fixed (${report.repo.fixed.length})`, 'pass'),
      list(report.repo.fixed, 'None yet.'),
      el('p', `Still failing (${report.repo.stillFailing.length})`, 'fail'),
      list(report.repo.stillFailing, 'Nothing, all tests pass.'),
      ...(report.repo.regressions.length
        ? [el('p', 'Broken by your edits', 'fail'), list(report.repo.regressions, '')]
        : []),
    ),
    section(
      'Time and AI',
      list(
        [
          `DSA: ${fmtMinutes(report.time.dsaSeconds)}, repo: ${fmtMinutes(report.time.repoSeconds)}`,
          report.ai.limit > 0
            ? `AI hints used: ${report.ai.used}/${report.ai.limit}`
            : 'AI helper was not configured',
        ],
        '',
      ),
    ),
    section('What to work on', list(report.tips, '')),
  );

  const actions = el('div', undefined, 'row');
  const copy = el('button', 'Copy summary', 'secondary');
  copy.addEventListener('click', async () => {
    await navigator.clipboard.writeText(reportText(report));
    copy.textContent = 'Copied';
  });
  const again = el('button', 'Try again');
  again.addEventListener('click', () => location.reload());
  actions.append(copy, again);
  card.append(actions);
}

// ---------- wiring ----------
function guarded(button, action) {
  button.addEventListener('click', () =>
    busy(button, action).catch((err) => {
      const target = state.part === 'dsa' ? $('dsa-output') : $('repo-output');
      setOutput(target, [{ text: err.message, className: 'fail' }]);
    }),
  );
}

guarded($('start-btn'), () =>
  startTest().catch((err) => {
    $('setup-error').textContent = err.message;
  }),
);
guarded($('run-sample'), runSample);
guarded($('run-dsa'), runDsa);
guarded($('run-repo'), runRepo);
$('submit-part').addEventListener('click', submitPart);
$('reset-repo').addEventListener('click', resetRepo);
$('ai-ask').addEventListener('click', askAi);
$('ai-question').addEventListener('keydown', (event) => event.key === 'Enter' && askAi());
$('file-editor').addEventListener('input', (event) => {
  state.files[state.currentFile] = event.target.value;
});
for (const editor of [$('code'), $('file-editor')]) {
  editor.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const { selectionStart: start, selectionEnd: end } = editor;
    editor.setRangeText('    ', start, end, 'end');
    editor.dispatchEvent(new Event('input'));
  });
}
loadCatalog();
