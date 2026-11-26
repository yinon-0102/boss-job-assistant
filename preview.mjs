import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const catalog = JSON.parse(readFileSync(new URL('./evidence.json', import.meta.url), 'utf8'));
const names = Object.keys(catalog);
const normalize = s => s.normalize('NFKC').toLowerCase();
const match = (text, words) => words.filter(word => text.includes(normalize(word)));
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const stringList = value => Array.isArray(value) && value.every(text);
const unique = list => [...new Set(list.map(value => value.trim()))];
const employment = ['internship', 'full-time', 'part-time'];

function required(condition, field) {
  if (!condition) throw new Error(`${field} 格式不正确`);
}

function validate(input) {
  required(record(input), '输入');
  const { preferences: p, profile, jobs } = input;
  required(record(p), 'preferences');
  required(stringList(p.cities) && p.cities.length, 'preferences.cities（至少一个目标城市）');
  required(stringList(p.directions) && p.directions.length && p.directions.every(value => names.includes(value)), 'preferences.directions');
  required(typeof p.internshipOnly === 'boolean', 'preferences.internshipOnly');
  for (const key of ['availableDaysPerWeek', 'availableMonths']) {
    required(p[key] == null || (Number.isInteger(p[key]) && p[key] > 0 && (key !== 'availableDaysPerWeek' || p[key] <= 7)), `preferences.${key}`);
  }
  required(profile == null || (record(profile) && (profile.desiredTitle == null || text(profile.desiredTitle)) &&
    (profile.keywords == null || stringList(profile.keywords))), 'profile');
  required(Array.isArray(jobs), 'jobs');
  jobs.forEach((j, index) => {
    const field = `jobs[${index}]`;
    required(record(j) && ['id', 'title', 'company'].every(k => text(j[k])), field);
    for (const k of ['jd', 'city']) required(j[k] == null || typeof j[k] === 'string', `${field}.${k}`);
    required(j.employment == null || employment.includes(j.employment), `${field}.employment`);
    required(j.alreadyContacted == null || typeof j.alreadyContacted === 'boolean', `${field}.alreadyContacted`);
    for (const k of ['minDaysPerWeek', 'minMonths']) {
      required(j[k] == null || (Number.isInteger(j[k]) && j[k] > 0 && (k !== 'minDaysPerWeek' || j[k] <= 7)), `${field}.${k}`);
    }
  });
}

function searchPlan(p, profile) {
  const hints = normalize([profile?.desiredTitle, ...(profile?.keywords ?? [])].filter(Boolean).join(' '));
  return unique(p.cities).flatMap(city => unique(p.directions).map(direction => {
    const keywords = catalog[direction].searchKeywords;
    const relevant = match(hints, keywords);
    return { city, direction, employment: p.internshipOnly ? 'internship' : 'any', keywords: [...new Set([...relevant, ...keywords])] };
  }));
}

function classify(jd, title) {
  const product = ['prd', '产品经理', '产品助理', '竞品分析', '产品原型', '产品运营', '需求跟进'];
  if (match(title, ['产品经理', '产品助理', '产品运营']).length || match(jd, product).length >= 2) {
    return { skip: '偏产品职责，不进入技术投递队列' };
  }
  const fde = catalog.fde;
  const fdeSignals = match(jd, fde.signals);
  if (match(jd, fde.customerSignals).length && fdeSignals.length >= 2) return { direction: 'fde', signals: fdeSignals };
  const ranked = ['agent', 'ai-app'].map(direction => ({ direction, signals: match(jd, catalog[direction].signals) }))
    .sort((a, b) => b.signals.length - a.signals.length);
  if (!ranked[0].signals.length) {
    if (fdeSignals.length || match(jd, fde.customerSignals).length) return { review: '可能偏交付，但客户场景或技术职责未明确' };
    return { skip: '未发现目标方向的明确技术职责' };
  }
  if (ranked[0].signals.length === ranked[1].signals.length) return { review: 'Agent 与 AI 应用职责混合，需人工判断侧重' };
  return ranked[0];
}

function buildPreview(input) {
  validate(input);
  const { preferences: p, profile, jobs } = input;
  const searches = searchPlan(p, profile);
  const cities = unique(p.cities).map(normalize);
  const contacted = new Set(jobs.filter(j => j.alreadyContacted).map(j => j.id.trim()));
  const seen = new Set();
  const rows = jobs.map(j => {
    const id = j.id.trim();
    const base = { id, company: j.company, title: j.title, city: j.city ?? null, greeting: null, resume: null };
    const stop = (status, reason) => ({ ...base, status, reason });
    if (contacted.has(id)) return stop('skip', '已沟通');
    if (seen.has(id)) return stop('skip', '本批次重复岗位');
    seen.add(id);
    if (text(j.city) && !cities.includes(normalize(j.city.trim()))) return stop('skip', '不在目标城市');
    if (p.internshipOnly && j.employment && j.employment !== 'internship') return stop('skip', '不是实习岗位');
    if (p.availableDaysPerWeek != null && j.minDaysPerWeek > p.availableDaysPerWeek) return stop('skip', '每周到岗天数不满足');
    if (p.availableMonths != null && j.minMonths > p.availableMonths) return stop('skip', '连续实习时长不满足');
    if (!text(j.jd)) return stop('review', '缺少 JD');
    const fit = classify(normalize(j.jd), normalize(j.title));
    if (fit.skip) return stop('skip', fit.skip);
    if (fit.review) return stop('review', fit.review);
    if (!p.directions.includes(fit.direction)) return stop('skip', '不在本次选择的岗位方向');
    const missing = [];
    if (!text(j.city)) missing.push('岗位城市');
    if (p.internshipOnly && !j.employment) missing.push('是否招实习');
    if (p.availableDaysPerWeek != null && j.minDaysPerWeek == null) missing.push('岗位每周到岗要求');
    if (p.availableMonths != null && j.minMonths == null) missing.push('岗位实习时长要求');
    if (j.minDaysPerWeek != null && p.availableDaysPerWeek == null) missing.push('个人每周可到岗天数');
    if (j.minMonths != null && p.availableMonths == null) missing.push('个人可实习时长');
    if (missing.length) return stop('review', `待确认：${missing.join('、')}`);
    const route = catalog[fit.direction];
    const best = route.evidence.map(e => ({ e, count: match(normalize(j.jd), e.signals).length }))
      .sort((a, b) => b.count - a.count)[0];
    if (!best?.count) return stop('review', '岗位方向相符，但没有足够对口的简历证据');
    const { id: evidenceId, project, claim, focus } = best.e;
    return {
      ...base, status: 'draft', direction: fit.direction, jdSignals: fit.signals,
      evidence: { id: evidenceId, project, claim },
      greeting: `您好，看到这个岗位涉及${focus}。${claim}，想和您聊聊这个岗位。`,
      resume: { id: fit.direction, label: route.resumeLabel }, attachmentStatus: 'unverified',
    };
  });
  return { mode: 'dry-run', contactActionsPerformed: 0, searches, jobs: rows };
}

const usage = '用法：node preview.mjs --demo 或 node preview.mjs --input <JSON 文件路径 | ->（- 代表 UTF-8 标准输入）';
try {
  const { values } = parseArgs({ options: { input: { type: 'string' }, demo: { type: 'boolean' }, help: { type: 'boolean' } } });
  if ([values.demo, values.input, values.help].filter(Boolean).length !== 1) throw new Error(usage);
  if (values.help) console.log(usage);
  else {
    const source = values.demo ? new URL('./examples/demo.json', import.meta.url) : values.input === '-' ? 0 : values.input;
    const input = JSON.parse(readFileSync(source, 'utf8').replace(/^\uFEFF/, ''));
    console.log(JSON.stringify(buildPreview(input), null, 2));
  }
} catch (error) {
  console.error(`错误：${error.message}`);
  process.exitCode = 2;
}
