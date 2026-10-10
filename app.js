const STORAGE_KEY = 'universal-personal-planner-v1';
const form = document.querySelector('#planner-form');
const report = document.querySelector('#report');
const toast = document.querySelector('#toast');

const icon = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[character]);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2200);
}

function getData() {
  return Object.fromEntries(new FormData(form).entries());
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getData()));
  document.querySelector('#save-state').innerHTML = `${icon('circle-check')} 已保存`;
  if (window.lucide) lucide.createIcons();
}

function restoreData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    Object.entries(data).forEach(([name, value]) => {
      const field = form.elements.namedItem(name);
      if (field) field.value = value;
    });
  } catch (_error) {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function updateRanges() {
  document.querySelector('#energy-output').textContent = `${form.energy.value} / 10`;
  document.querySelector('#stress-output').textContent = `${form.stress.value} / 10`;
}

const dropZone = document.querySelector('#drop-zone');
const fileInput = document.querySelector('#file-input');
const importResult = document.querySelector('#import-result');
const importStatus = document.querySelector('#import-status');
const importDetail = document.querySelector('#import-detail');
const allowedExtensions = new Set(['pdf', 'docx', 'txt', 'md', 'json']);

function fileExtension(file) {
  return file.name.split('.').pop().toLowerCase();
}

function waitForGlobal(name, eventName) {
  if (window[name]) return Promise.resolve(window[name]);
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(`${name} 加载超时`)), 8000);
    window.addEventListener(eventName, () => {
      window.clearTimeout(timeout);
      resolve(window[name]);
    }, { once: true });
  });
}

async function extractFileText(file) {
  const extension = fileExtension(file);
  if (!allowedExtensions.has(extension)) throw new Error('不支持这种文件类型');
  if (file.size > 10 * 1024 * 1024) throw new Error('文件超过 10 MB');

  if (['txt', 'md', 'json'].includes(extension)) return file.text();
  if (extension === 'docx') {
    const mammothLib = await waitForGlobal('mammoth', 'load');
    const result = await mammothLib.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }
  const pdfLib = await waitForGlobal('pdfjsLib', 'pdfjs-ready');
  const documentTask = pdfLib.getDocument({ data: await file.arrayBuffer() });
  const pdf = await documentTask.promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(' '));
  }
  return pages.join('\n');
}

function findLabeledValue(text, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = text.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*[:：]\\s*([^\\n]{1,500})`, 'i'));
    if (match) return match[1].trim();
  }
  return '';
}

function mapExtractedText(text) {
  const normalized = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
  const mapped = {
    name: findLabeledValue(normalized, ['姓名', '名字', '昵称', 'Name']),
    stage: findLabeledValue(normalized, ['年龄或阶段', '年龄', '年级', '人生阶段']),
    location: findLabeledValue(normalized, ['所在地', '所在城市', '地区', '居住地']),
    mainGoal: findLabeledValue(normalized, ['主要目标', '当前目标', '未来目标', '目标']),
    values: findLabeledValue(normalized, ['价值观', '看重的事', '核心价值']),
    decision: findLabeledValue(normalized, ['当前困惑', '主要问题', '担忧', '难做的决定']),
    field: findLabeledValue(normalized, ['专业或行业', '专业', '行业', '领域']),
    skills: findLabeledValue(normalized, ['技能与成果', '技能', '项目经历', '工作经历', '实习经历']),
    careerDirection: findLabeledValue(normalized, ['发展方向', '职业方向', '申请方向', '方向']),
    growthGap: findLabeledValue(normalized, ['当前短板', '主要短板', '不足', '待提升']),
    health: findLabeledValue(normalized, ['健康状况', '健康', '身体状况', '生活限制']),
    relationships: findLabeledValue(normalized, ['关系状况', '家庭关系', '人际关系', '社交现状']),
    strengths: findLabeledValue(normalized, ['个人优势', '优势', '优点']),
    habits: findLabeledValue(normalized, ['执行障碍', '坏习惯', '习惯问题']),
    idealDay: findLabeledValue(normalized, ['理想的一天', '理想生活', '理想中的普通一天']),
    backgroundNotes: normalized.slice(0, 6000)
  };

  if (!mapped.stage) {
    const age = normalized.match(/(?:年龄[:：]?\s*)?(\d{1,2}\s*岁)/);
    if (age) mapped.stage = age[1];
  }
  if (/(大学|本科|大一|大二|大三|大四)/.test(normalized)) mapped.identity = '大学生';
  else if (/(硕士|博士|研究生)/.test(normalized)) mapped.identity = '研究生';
  else if (/(工作|任职|从业|职场)/.test(normalized)) mapped.identity = '职场人士';
  if (/(负债|债务|还款压力)/.test(normalized)) mapped.finance = 'pressure';
  else if (/(结余|储蓄|存款)/.test(normalized)) mapped.finance = 'stable';
  return mapped;
}

function applyExtractedData(mapped) {
  let count = 0;
  Object.entries(mapped).forEach(([name, value]) => {
    if (!value) return;
    const field = form.elements.namedItem(name);
    if (!field) return;
    const canFill = !String(field.value).trim() || name === 'backgroundNotes' || (name === 'identity' && !field.value);
    if (!canFill) return;
    field.value = value;
    count += 1;
  });
  updateRanges();
  saveData();
  return count;
}

async function handleFiles(fileList) {
  const files = Array.from(fileList).slice(0, 5);
  if (!files.length) return;
  importResult.hidden = false;
  importStatus.textContent = '正在读取文件';
  importDetail.textContent = files.map((file) => file.name).join('、');
  const texts = [];
  const failures = [];
  for (const file of files) {
    try {
      texts.push(await extractFileText(file));
    } catch (error) {
      failures.push(`${file.name}：${error.message}`);
    }
  }
  if (!texts.length) {
    importStatus.textContent = '未能提取信息';
    importDetail.textContent = failures.join('；');
    return;
  }
  const matchedFields = applyExtractedData(mapExtractedText(texts.join('\n')));
  importStatus.textContent = `已预填 ${matchedFields} 个字段`;
  importDetail.textContent = failures.length
    ? `请核对下方内容。部分文件未读取：${failures.join('；')}`
    : '请向下核对自动提取的内容，再生成报告。';
  showToast('文件信息已提取，请核对表单');
}

['dragenter', 'dragover'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('is-dragging');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove('is-dragging');
  });
});

dropZone.addEventListener('drop', (event) => handleFiles(event.dataTransfer.files));
fileInput.addEventListener('change', () => handleFiles(fileInput.files));
document.querySelector('#clear-files').addEventListener('click', () => {
  fileInput.value = '';
  importResult.hidden = true;
  showToast('已清除导入记录，已填字段保留');
});

function includesAny(text, words) {
  const source = String(text || '').toLowerCase();
  return words.some((word) => source.includes(word));
}

function analyze(data) {
  const energy = Number(data.energy);
  const stress = Number(data.stress);
  const hours = Math.max(1, Number(data.weeklyHours) || 8);
  const healthRisk = energy <= 4 || stress >= 8 || data.sleep === 'under6' || Boolean(data.health.trim());
  const financeRisk = data.finance === 'pressure' || data.emergency === 'none';
  const directionRisk = data.clarity !== 'clear';
  const evidenceWeak = data.performance === 'weak' || data.performance === 'unknown' || includesAny(data.growthGap, ['没有作品', '经验不足', '基础', '技能']);

  const priorities = [];
  if (healthRisk) priorities.push({ title: '修复精力底盘', detail: '稳定睡眠、进食与恢复，必要时寻求正规帮助。', type: '基础' });
  if (directionRisk) priorities.push({ title: '小成本验证方向', detail: '用访谈、短项目或真实任务收集反馈。', type: '决策' });
  if (evidenceWeak) priorities.push({ title: '做出能力证据', detail: '完成一个可展示、可解释、可复盘的成果。', type: '成长' });
  if (financeRisk) priorities.push({ title: '降低财务风险', detail: '先稳现金流与应急资金，再做高成本选择。', type: '财务' });
  priorities.push({ title: '聚焦季度结果', detail: '未来 90 天只保留一个主结果。', type: '聚焦' });
  priorities.push({ title: '每周复盘一次', detail: '检查投入、产出、精力和下一步。', type: '系统' });

  const topPriorities = priorities.slice(0, 3);
  const focusScore = data.clarity === 'clear' ? '较清晰' : data.clarity === 'options' ? '待取舍' : '需探索';
  const energyLabel = energy >= 7 ? '充足' : energy >= 5 ? '一般' : '偏低';
  const baseLabel = healthRisk || financeRisk ? '需加固' : '相对稳定';
  const actionLabel = hours >= 15 ? '可推进' : hours >= 7 ? '需聚焦' : '小步验证';

  const lead = `${data.name ? `${data.name}，` : ''}围绕“${data.mainGoal}”，先完成一个 90 天可验证结果。${directionRisk ? '先收集真实反馈，再决定长期投入。' : '减少横向尝试，集中产出高价值成果。'}`;

  return { hours, energy, stress, healthRisk, financeRisk, directionRisk, evidenceWeak, topPriorities, focusScore, energyLabel, baseLabel, actionLabel, lead };
}

function renderSummary(data, analysis) {
  const cards = [
    ['目标清晰度', analysis.focusScore, data.mainGoal, data.clarity === 'clear' ? 88 : data.clarity === 'options' ? 58 : 32, data.clarity === 'clear' ? '88' : data.clarity === 'options' ? '58' : '32'],
    ['可执行时间', analysis.actionLabel, `${analysis.hours} 小时 / 周`, Math.min(100, analysis.hours * 5), `${analysis.hours}h`],
    ['个人精力', analysis.energyLabel, `压力 ${analysis.stress} / 10`, analysis.energy * 10, `${analysis.energy}/10`],
    ['生活底盘', analysis.baseLabel, analysis.healthRisk || analysis.financeRisk ? '优先加固' : '保持节奏', analysis.healthRisk || analysis.financeRisk ? 48 : 82, analysis.healthRisk || analysis.financeRisk ? '48' : '82']
  ];
  document.querySelector('#report-summary').innerHTML = cards.map(([label, value, note, score, ringValue]) => `
    <article class="summary-card"><div class="summary-card-head"><span>${escapeHTML(label)}</span><span class="score-ring" style="--score:${score}" data-value="${escapeHTML(ringValue)}"></span></div><strong>${escapeHTML(value)}</strong><p>${escapeHTML(note)}</p></article>
  `).join('');
}

function renderPriorities(analysis) {
  document.querySelector('#executive-copy').textContent = analysis.lead;
  document.querySelector('#priority-grid').innerHTML = analysis.topPriorities.map((item, index) => `
    <article class="priority-item"><span>优先级 0${index + 1} · ${escapeHTML(item.type)}</span><h4>${escapeHTML(item.title)}</h4><p>${escapeHTML(item.detail)}</p></article>
  `).join('');
}

function renderTimeline(data, analysis) {
  const first = analysis.directionRisk
    ? '选三个候选方向，各完成一次低成本验证。'
    : '定义一个可衡量的季度结果，删除无关任务。';
  const second = analysis.evidenceWeak
    ? `围绕“${data.careerDirection}”完成一个最小可展示成果。`
    : '进入真实场景，用项目、实习或工作结果积累证据。';
  const third = analysis.healthRisk
    ? '结合成果与精力恢复，决定下一季度投入。'
    : '整理证据，决定继续、调整或停止。';
  const steps = [['第 1 至 2 周', '定义问题与基线', first], ['第 3 至 8 周', '集中产出', second], ['第 9 至 12 周', '验证与取舍', third]];
  document.querySelector('#timeline').innerHTML = steps.map(([time, title, copy]) => `
    <article class="timeline-step"><span>${escapeHTML(time)}</span><h4>${escapeHTML(title)}</h4><p>${escapeHTML(copy)}</p></article>
  `).join('');
}

function domainAdvice(data, analysis) {
  const studyLead = analysis.evidenceWeak
    ? '先补一个会直接限制目标的关键短板，不同时开多条学习线。'
    : '已有基础不等于继续堆证书，应把知识转化为真实成果和表达能力。';
  const careerLead = analysis.directionRisk
    ? '当前最值钱的是方向验证，不是过早确定终身职业。'
    : '把目标岗位或项目拆成能力、证据、人脉和机会四张清单。';
  const healthLead = analysis.healthRisk
    ? '健康已经可能影响执行上限，计划需要主动降载并保留恢复空间。'
    : '当前底盘尚可，重点是保持规律，避免用短期冲刺透支未来几周。';
  const financeLead = analysis.financeRisk
    ? '财务安全应先于投资收益和高成本转型，先减少不可承受的波动。'
    : '维持结余并建立目标账户，让钱服务于选择权，而不是只追求账面数字。';

  return [
    { icon: 'graduation-cap', title: '学习与能力', lead: studyLead, points: [`围绕 ${data.field} 与 ${data.careerDirection} 建立学习路线`, '每学一项内容都配套输出、测试或真实应用'], action: '本周确定一个核心能力与一个可交付成果。' },
    { icon: 'briefcase-business', title: '职业与机会', lead: careerLead, points: ['每月与两位从业者交流真实工作内容', '经历描述统一使用问题、行动、结果、反思'], action: analysis.directionRisk ? '安排一次行业访谈和一次真实任务体验。' : '更新一版面向目标机会的作品与经历材料。' },
    { icon: 'heart-pulse', title: '健康与精力', lead: healthLead, points: [`睡眠现状：${data.sleep === 'under6' ? '明显不足' : data.sleep === '6to7' ? '偏少' : '基本可控'}`, '只追踪能指导行动的指标：睡眠、精力、运动和持续症状'], action: analysis.healthRisk ? '先连续两周记录精力；异常持续时寻求正规帮助。' : '固定三次轻到中等强度活动与稳定睡眠窗口。' },
    { icon: 'wallet-cards', title: '财务与风险', lead: financeLead, points: ['明确每月必要支出、可变支出与长期目标', '学习或转型预算必须设置总额和停止条件'], action: analysis.financeRisk ? '建立一个月现金流表并优先补应急资金。' : '把固定比例结余转入应急与成长账户。' },
    { icon: 'users', title: '关系与支持', lead: '关系不是时间管理之外的事情，它决定你的恢复质量、信息来源和长期稳定感。', points: ['主动维护真正支持你的少数关系', '对持续消耗的关系明确边界，不用忙碌代替沟通'], action: `根据你的描述“${data.relationships}”，选一段最值得改善的关系采取一次具体行动。` },
    { icon: 'house', title: '生活与自我', lead: `理想生活应能容纳你描述的普通一天：“${data.idealDay}”`, points: ['用可长期重复的节奏评价计划，而不只看短期产出', `警惕这些反复障碍：${data.habits}`], action: '删掉一个不重要承诺，为理想日常腾出固定空间。' }
  ];
}

function renderDomains(data, analysis) {
  document.querySelector('#domain-list').innerHTML = domainAdvice(data, analysis).map((item) => `
    <article class="domain-row">
      <div class="domain-title">${icon(item.icon)}<span>${escapeHTML(item.title)}</span></div>
      <div class="domain-advice"><p>${escapeHTML(item.lead)}</p><ul>${item.points.map((point) => `<li>${escapeHTML(point)}</li>`).join('')}</ul></div>
      <div class="domain-action"><span>下一步</span><p>${escapeHTML(item.action)}</p></div>
    </article>
  `).join('');
}

function renderWeek(analysis) {
  const hours = analysis.hours;
  const shares = analysis.healthRisk ? [0.42, 0.18, 0.16, 0.24] : [0.52, 0.2, 0.18, 0.1];
  const labels = ['主目标深度工作', '学习与输入', '关系与复盘', '恢复缓冲'];
  const rows = labels.map((label, index) => {
    const allocated = Math.max(1, Math.round(hours * shares[index]));
    return `<div class="allocation-row"><span>${label}</span><div class="allocation-track"><div class="allocation-fill" style="width:${shares[index] * 100}%"></div></div><strong>${allocated} 小时</strong></div>`;
  }).join('');
  document.querySelector('#week-layout').innerHTML = `
    <div class="allocation-list">${rows}</div>
    <aside class="week-rules"><h4>排程规则</h4><ul><li>先放恢复和固定责任，再放目标任务。</li><li>每周最多三个重要结果。</li><li>保留至少 15% 的机动时间。</li><li>连续两周无法执行，就缩小目标而不是责备自己。</li></ul></aside>
  `;
}

function renderGuardrails(data, analysis) {
  const items = [
    '结果不等于个人价值。',
    '健康信息不构成诊断或治疗意见。',
    analysis.financeRisk ? '现金流稳定前避免高风险选择。' : '重大财务决定需独立研究风险。',
    '每四周做一次继续、调整、停止复盘。'
  ];
  document.querySelector('#guardrails').innerHTML = items.map((item) => `<li>${icon('circle-alert')}<span>${escapeHTML(item)}</span></li>`).join('');
}

function generateReport(shouldScroll = true) {
  if (!form.reportValidity()) return;
  const data = getData();
  const analysis = analyze(data);
  saveData();
  renderSummary(data, analysis);
  renderPriorities(analysis);
  renderTimeline(data, analysis);
  renderDomains(data, analysis);
  renderWeek(analysis);
  renderGuardrails(data, analysis);
  document.querySelector('#report-title').textContent = `${data.name ? `${data.name}的` : '你的'}个人发展报告`;
  document.querySelector('#report-date').textContent = `根据当前信息生成 · ${new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long' }).format(new Date())}`;
  report.hidden = false;
  if (window.lucide) lucide.createIcons();
  if (shouldScroll) report.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

form.addEventListener('input', () => {
  updateRanges();
  window.clearTimeout(saveData.timer);
  saveData.timer = window.setTimeout(saveData, 350);
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  generateReport(true);
});

document.querySelector('#edit-button').addEventListener('click', () => {
  document.querySelector('#input').scrollIntoView({ behavior: 'smooth' });
});

document.querySelector('#print-button').addEventListener('click', () => window.print());
document.querySelector('#regenerate-button').addEventListener('click', () => generateReport(false));

document.querySelector('#reset-button').addEventListener('click', () => {
  if (!window.confirm('确定清空已填写的信息和当前报告吗？')) return;
  form.reset();
  localStorage.removeItem(STORAGE_KEY);
  report.hidden = true;
  updateRanges();
  showToast('已清空，可以重新填写');
  document.querySelector('#input').scrollIntoView({ behavior: 'smooth' });
});

restoreData();
updateRanges();
if (window.lucide) lucide.createIcons();
