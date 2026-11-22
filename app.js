/* ============================================================
   Tomografia · Sistema de Exames
   - Numeração sequencial por mês (zera na virada do mês)
   - Período operacional de 07:00 às 07:00 do dia seguinte
   - Relatórios em PDF e Excel (dia, intervalo e mês)
   ============================================================ */
(() => {
  'use strict';

  /* ---------------- constants ---------------- */
  const OP_HOUR = 7;
  const STORE_KEY = 'tomografia.records.v1';
  const CFG_KEY = 'tomografia.config.v1';
  const PAGE_SIZE = 25;
  const LOAD_MORE = 50;

  const EXAM_GROUPS = [
    {
      label: 'Exames Unilaterais',
      types: [
        'Abdome superior', 'Arco costais', 'Bacia', 'Coluna cervical', 'Coluna dorsal',
        'Coluna lombar', 'Crânio', 'Face', 'Mastoides', 'Mandíbula', 'Ossos da face',
        'Pelve', 'Pescoço', 'Sela túrcica', 'Tórax'
      ]
    },
    {
      label: 'Exames Bilaterais',
      types: [
        'Antebraço (direito)', 'Antebraço (esquerdo)', 'Braço (direito)', 'Braço (esquerdo)',
        'Cotovelo (direito)', 'Cotovelo (esquerdo)', 'Fêmur (direito)', 'Fêmur (esquerdo)',
        'Joelho (direito)', 'Joelho (esquerdo)', 'Mão (direita)', 'Mão (esquerda)',
        'Ombro (direito)', 'Ombro (esquerdo)', 'Pé (direito)', 'Pé (esquerdo)',
        'Perna (direita)', 'Perna (esquerda)', 'Punho (direito)', 'Punho (esquerdo)',
        'Quadril (direito)', 'Quadril (esquerdo)', 'Tornozelo (direito)', 'Tornozelo (esquerdo)'
      ]
    }
  ];

  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  const COLORS = ['#00f0ff', '#f5a524', '#3b82f6', '#22c55e', '#ec4899', '#ef4444',
    '#14b8a6', '#a855f7', '#f97316', '#84cc16', '#64748b'];

  const ICONS = {
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4M12 17h.01" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    empty: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 12h-6l-2 3h-4l-2-3H2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    hospital: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M10 10h.01M14 10h.01M10 13h.01M14 13h.01" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    emergency: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4M12 17h.01" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  /* ---------------- dom ---------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------------- state ---------------- */
  let records = [];
  let config = { seqCounters: {}, lastTech: '', lastPatientType: 'emergencia' };

  const ui = {
    search: '',
    showAll: false,
    limit: PAGE_SIZE,
    patientType: 'emergencia',
    editingId: null
  };

  const charts = {};

  /* ---------------- utilities ---------------- */
  const pad2 = n => String(n).padStart(2, '0');

  function ymd(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }
  function todayISO() { return ymd(new Date()); }
  function currentMonth() { return todayISO().slice(0, 7); }
  function nowHM() {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  function brDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  function brMonth(ym) {
    const [y, m] = ym.split('-');
    return `${m}/${y}`;
  }
  function monthLabel(ym) {
    const [y, m] = ym.split('-').map(Number);
    return `${MONTHS[m - 1]} de ${y}`;
  }
  function monthLabelCap(ym) {
    const label = monthLabel(ym);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  function addDaysISO(iso, days) {
    const [y, m, d] = iso.split('-').map(Number);
    return ymd(new Date(y, m - 1, d + days));
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }
  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }
  function ptypeLabel(type) { return type === 'internado' ? 'Internado' : 'Emergência'; }
  function fileStamp(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}-${m}-${y}`;
  }

  /* ---------------- storage ---------------- */
  function loadRecords() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function saveRecords() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(records));
    } catch (err) {
      toast('Não foi possível salvar os dados neste navegador.', 'warn');
    }
  }

  function loadConfig() {
    try {
      const raw = localStorage.getItem(CFG_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        seqCounters: (parsed && typeof parsed.seqCounters === 'object' && parsed.seqCounters) || {},
        lastTech: (parsed && parsed.lastTech) || '',
        lastPatientType: parsed && parsed.lastPatientType === 'internado' ? 'internado' : 'emergencia'
      };
    } catch (err) {
      return { seqCounters: {}, lastTech: '', lastPatientType: 'emergencia' };
    }
  }

  function saveConfig() {
    try { localStorage.setItem(CFG_KEY, JSON.stringify(config)); } catch (err) { /* ignore */ }
  }

  /* ---------------- period helpers ---------------- */
  function recordTs(record) {
    const [y, m, d] = record.date.split('-').map(Number);
    const [hh, mm] = (record.time || '00:00').split(':').map(Number);
    return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
  }

  function dayBounds(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const start = new Date(y, m - 1, d, OP_HOUR, 0, 0, 0);
    const end = new Date(y, m - 1, d + 1, OP_HOUR, 0, 0, 0);
    return [start, end];
  }

  function monthBounds(ym) {
    const [y, m] = ym.split('-').map(Number);
    return [new Date(y, m - 1, 1, OP_HOUR, 0, 0, 0), new Date(y, m, 1, OP_HOUR, 0, 0, 0)];
  }

  function currentOpDate() {
    const now = new Date();
    const d = new Date(now);
    if (now.getHours() < OP_HOUR) d.setDate(d.getDate() - 1);
    return ymd(d);
  }

  function opDateOfTs(ts) {
    const d = new Date(ts);
    if (d.getHours() < OP_HOUR) d.setDate(d.getDate() - 1);
    return ymd(d);
  }

  function inRange(ts, start, end) {
    return ts.getTime() >= start.getTime() && ts.getTime() < end.getTime();
  }

  function filterRange(start, end) {
    return records.filter(r => inRange(recordTs(r), start, end));
  }

  function currentPeriodRecords() {
    const [start, end] = dayBounds(currentOpDate());
    return filterRange(start, end);
  }

  function eachISO(startISO, endISO) {
    const list = [];
    let cursor = startISO;
    let guard = 0;
    while (cursor <= endISO && guard < 4000) {
      list.push(cursor);
      cursor = addDaysISO(cursor, 1);
      guard++;
    }
    return list;
  }

  /* ---------------- computed ---------------- */
  const examsOf = list => list.reduce((sum, r) => sum + (r.exams ? r.exams.length : 0), 0);

  function uniquePatients(list) {
    return new Set(list.map(r => `${r.patient}|${r.bam}`)).size;
  }

  function countBy(list, keyFn) {
    const map = new Map();
    list.forEach(item => {
      const key = keyFn(item);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }

  function sortedEntries(map) {
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'pt-BR'));
  }

  /* ---------------- sequence (per month) ---------------- */
  function monthOf(iso) { return iso.slice(0, 7); }

  function nextSeqFor(month) {
    const used = new Set(records.filter(r => monthOf(r.date) === month).map(r => r.seq));
    const stored = config.seqCounters[month];
    let next = 1;
    if (Number.isFinite(stored)) {
      next = stored;
    } else {
      while (used.has(next)) next++;
    }
    for (let n = 1; n < next; n++) {
      if (!used.has(n)) return n;
    }
    return next;
  }

  function bumpSeq(month, seq) {
    const stored = config.seqCounters[month];
    config.seqCounters[month] = Math.max(Number.isFinite(stored) ? stored : 1, seq + 1);
    saveConfig();
  }

  /* ---------------- toast ---------------- */
  function toast(message, type = 'ok') {
    const root = $('#toastRoot');
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'warn' ? ' warn' : '');
    el.innerHTML = (type === 'warn' ? ICONS.warn : ICONS.check) + `<span>${esc(message)}</span>`;
    root.appendChild(el);
    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 300);
    }, 3400);
  }

  /* ---------------- modal ---------------- */
  let activeModal = null;

  function onModalKey(e) {
    if (e.key === 'Escape') closeModal();
  }

  function openModal(html) {
    closeModal();
    const root = $('#modalRoot');
    root.innerHTML = html;
    activeModal = root.firstElementChild;
    document.body.style.overflow = 'hidden';
    activeModal.addEventListener('click', e => {
      if (e.target === activeModal || e.target.closest('[data-close]')) closeModal();
    });
    document.addEventListener('keydown', onModalKey);
    const focusable = activeModal.querySelector('input:not([type="hidden"]), select, textarea, button');
    if (focusable) setTimeout(() => focusable.focus(), 40);
  }

  function closeModal() {
    if (!activeModal) return;
    activeModal.remove();
    activeModal = null;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onModalKey);
  }

  function confirmDialog(opts) {
    const warning = opts.warning
      ? `<div class="modal-warn">${esc(opts.warning)}</div>`
      : '';
    openModal(`
      <div class="modal-backdrop">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal-head">
            <div>
              <p class="eyebrow accent">${esc(opts.eyebrow || 'Confirmação')}</p>
              <h3>${esc(opts.title)}</h3>
            </div>
            <button type="button" class="icon-btn" data-close aria-label="Fechar">${ICONS.x}</button>
          </div>
          <p class="modal-text">${opts.message}</p>
          ${warning}
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" data-close>Cancelar</button>
            <button type="button" class="btn btn-amber confirm" id="confirmYes">${esc(opts.confirmLabel || 'Confirmar')}</button>
          </div>
        </div>
      </div>
    `);
    $('#confirmYes').addEventListener('click', () => {
      closeModal();
      opts.onConfirm();
    });
  }

  /* ---------------- exam row editor ---------------- */
  function makeExamRow(value = '', examId = '') {
    const row = document.createElement('div');
    row.className = 'exam-row';
    if (examId) row.dataset.examId = examId;
    row.innerHTML = `
      <div class="exam-row-head">
        <span class="exam-idx"></span>
        <button type="button" class="rm" aria-label="Remover exame">${ICONS.trash}</button>
      </div>
      <select aria-label="Tipo de exame">
        <option value="">Selecione o tipo</option>
        ${EXAM_GROUPS.map(g => `
          <optgroup label="${esc(g.label)}">
            ${g.types.map(t => `<option value="${esc(t)}"${t === value ? ' selected' : ''}>${esc(t)}</option>`).join('')}
          </optgroup>`).join('')}
      </select>
    `;
    return row;
  }

  function renumberExamRows(wrapper) {
    const rows = $$('.exam-row', wrapper);
    rows.forEach((row, i) => {
      row.querySelector('.exam-idx').textContent = `Exame ${i + 1}`;
      row.querySelector('.rm').style.visibility = rows.length > 1 ? 'visible' : 'hidden';
    });
  }

  function bindExamWrapper(wrapper) {
    if (wrapper.dataset.bound) return;
    wrapper.dataset.bound = '1';
    wrapper.addEventListener('click', e => {
      const rm = e.target.closest('.rm');
      if (!rm || !wrapper.contains(rm)) return;
      rm.closest('.exam-row').remove();
      if (!wrapper.children.length) wrapper.appendChild(makeExamRow());
      renumberExamRows(wrapper);
    });
  }

  function setupExamEditor(wrapper, values) {
    wrapper.innerHTML = '';
    values.forEach(v => wrapper.appendChild(makeExamRow(v)));
    if (!values.length) wrapper.appendChild(makeExamRow());
    bindExamWrapper(wrapper);
    renumberExamRows(wrapper);
  }

  function readExamValues(wrapper) {
    return $$('.exam-row', wrapper).map(row => ({
      id: row.dataset.examId || '',
      select: row.querySelector('select'),
      type: row.querySelector('select').value
    }));
  }

  /* ---------------- render: header / form ---------------- */
  function renderDayTechs() {
    const list = currentPeriodRecords();
    const techs = Array.from(new Set(list.map(r => r.technician))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const el = $('#dayTechs');
    if (!techs.length) {
      el.innerHTML = `<span class="chip empty">Nenhum registro no período</span>`;
      return;
    }
    el.innerHTML = techs.map(t => `<span class="chip">${esc(t)}</span>`).join('');
  }

  function renderNextSeq() {
    const date = $('#examDate').value || todayISO();
    const month = monthOf(date);
    const seq = nextSeqFor(month);
    $('#nextSeq').textContent = `#${seq}`;
    $('#nextSeq').parentElement.title = `Próximo número de ${monthLabel(month)}`;
  }

  function renderFormTime() {
    $('#regTime').textContent = nowHM();
  }

  /* ---------------- render: stats ---------------- */
  function renderStats() {
    const totalExams = examsOf(records);
    $('#statTotal').textContent = String(totalExams);
    $('#footTotal').textContent = String(totalExams);

    const current = currentPeriodRecords();
    $('#statPeriod').textContent = String(examsOf(current));

    const typeCounts = countBy(
      current.flatMap(r => r.exams),
      ex => ex.type
    );
    const topTypes = sortedEntries(typeCounts).slice(0, 8);
    $('#statTypes').innerHTML = topTypes.length
      ? topTypes.map(([type, count]) => `
          <div class="mini-row">
            <span class="name">${esc(type)}</span>
            <span class="count">${count}</span>
          </div>`).join('')
      : '<p class="mini-empty">Sem exames no período atual.</p>';

    const patientMap = new Map();
    current.forEach(r => {
      const key = `${r.patient}|${r.bam}`;
      const entry = patientMap.get(key) || { name: r.patient, bam: r.bam, count: 0 };
      entry.count += r.exams.length;
      patientMap.set(key, entry);
    });
    const topPatients = Array.from(patientMap.values())
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'))
      .slice(0, 8);

    $('#statPatients').innerHTML = topPatients.length
      ? topPatients.map(p => `
          <div class="mini-row patient">
            <span class="name">${esc(p.name)}</span>
            <span class="bam">· ${esc(p.bam)}</span>
            <span class="count">${p.count}</span>
          </div>`).join('')
      : '<p class="mini-empty">Nenhum paciente no período atual.</p>';
  }

  /* ---------------- render: records ---------------- */
  function filteredRecords() {
    let base = ui.showAll ? records.slice() : currentPeriodRecords();
    const q = normalize(ui.search).replace(/^#/, '').trim();
    if (q) {
      base = base.filter(r => {
        const hay = normalize([
          r.patient, r.bam, r.technician, r.notes, r.seq,
          brDate(r.date), r.exams.map(e => e.type).join(' ')
        ].join(' '));
        return hay.includes(q);
      });
    }
    return base.sort((a, b) => {
      const diff = recordTs(b) - recordTs(a);
      return diff !== 0 ? diff : b.seq - a.seq;
    });
  }

  function recordHTML(r) {
    const exams = r.exams || [];
    const examRows = exams.map((ex, i) => `
      <div class="exam-item">
        <span class="idx">#${i + 1}</span>
        <span class="type">${esc(ex.type)}</span>
        <span class="time">${esc(ex.time)}</span>
        ${exams.length > 1 ? `<button type="button" class="rm" data-act="del-exam" data-id="${r.id}" data-exam="${ex.id}" aria-label="Excluir este exame">${ICONS.trash}</button>` : ''}
      </div>`).join('');

    return `
      <article class="record">
        <div class="record-top">
          <span class="rec-seq">${r.seq}</span>
          <div class="rec-main">
            <h3 class="rec-name">${esc(r.patient)}</h3>
            <div class="badges">
              <span class="badge badge-${r.patientType === 'internado' ? 'internado' : 'emergencia'}">${ptypeLabel(r.patientType)}</span>
            </div>
          </div>
          <div class="rec-actions">
            <button type="button" class="icon-btn" data-act="edit" data-id="${r.id}" aria-label="Editar registro" title="Editar">${ICONS.edit}</button>
            <button type="button" class="icon-btn danger" data-act="del" data-id="${r.id}" aria-label="Excluir registro" title="Excluir">${ICONS.trash}</button>
          </div>
        </div>
        <div class="rec-meta">
          <span><span class="k">BAM:</span>${esc(r.bam)}</span><span class="dot">·</span>
          <span><span class="k">Data:</span>${brDate(r.date)}</span><span class="dot">·</span>
          <span>${esc(r.time)}</span><span class="dot">·</span>
          <span><span class="k">Técnico:</span>${esc(r.technician)}</span>
        </div>
        <div class="rec-exams">
          <p class="rec-exams-head">Exames realizados (total: ${exams.length})</p>
          ${examRows}
          ${r.notes ? `<p class="rec-notes">${esc(r.notes)}</p>` : ''}
        </div>
      </article>`;
  }

  function renderRecords() {
    const list = filteredRecords();
    const visible = list.slice(0, ui.limit);
    const root = $('#records');

    $('#listTitle').textContent = ui.showAll
      ? 'Todos os Exames'
      : 'Exames do Período Atual (07:00 às 07:00)';

    const [start, end] = dayBounds(currentOpDate());
    const suffix = ui.showAll
      ? ''
      : ` · Período ${brDate(ymd(start))} 07:00 → ${brDate(addDaysISO(ymd(start), 1))} 07:00`;

    $('#listCount').textContent = `Mostrando ${visible.length} de ${list.length} registros${suffix}`;

    if (!visible.length) {
      const message = ui.search
        ? 'Nenhum registro encontrado para essa busca.'
        : (ui.showAll ? 'Nenhum exame registrado ainda.' : 'Nenhum exame registrado neste período.');
      root.innerHTML = `
        <div class="empty">
          ${ICONS.empty}
          <p>${message}</p>
          <small>${ui.search ? 'Tente outro nome, BAM, técnico ou tipo de exame.' : 'Os registros aparecem aqui em ordem do mais recente.'}</small>
        </div>`;
    } else {
      root.innerHTML = visible.map(recordHTML).join('');
    }

    const moreVisible = list.length > ui.limit;
    $('#listMoreWrap').classList.toggle('hidden', !moreVisible);
  }

  /* ---------------- form interactions ---------------- */
  function updatePtypeUI() {
    $$('#ptype .seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === ui.patientType);
    });
  }

  function resetForm() {
    $('#bam').value = '';
    $('#patient').value = '';
    $('#notes').value = '';
    setupExamEditor($('#examRows'), []);
    renderFormTime();
    $('#bam').focus();
  }

  function validateForm() {
    let ok = true;
    [['#tech', $('#tech').value.trim()], ['#examDate', $('#examDate').value],
      ['#bam', $('#bam').value.trim()], ['#patient', $('#patient').value.trim()]]
      .forEach(([sel, value]) => {
        const el = $(sel);
        el.classList.toggle('invalid', !value);
        if (!value) ok = false;
      });

    $$('#examRows select').forEach(sel => {
      const empty = !sel.value;
      sel.classList.toggle('invalid', empty);
      if (empty) ok = false;
    });
    return ok;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validateForm()) {
      toast('Preencha os campos obrigatórios e selecione o tipo de cada exame.', 'warn');
      return;
    }

    const date = $('#examDate').value;
    const time = nowHM();
    const month = monthOf(date);
    const seq = nextSeqFor(month);
    const exams = $$('#examRows select').map(sel => ({ id: uid(), type: sel.value, time }));

    const record = {
      id: uid(),
      seq,
      date,
      time,
      bam: $('#bam').value.trim(),
      patient: $('#patient').value.trim().toLocaleUpperCase('pt-BR'),
      patientType: ui.patientType,
      technician: $('#tech').value.trim().toLocaleUpperCase('pt-BR'),
      notes: $('#notes').value.trim(),
      exams
    };

    records.push(record);
    bumpSeq(month, seq);
    config.lastTech = record.technician;
    config.lastPatientType = ui.patientType;
    saveConfig();
    saveRecords();

    resetForm();
    renderAll();
    toast(`Exame #${seq} registrado para ${record.patient.split(' ')[0]}.`);
  }

  /* ---------------- edit / delete ---------------- */
  function openEdit(id) {
    const r = records.find(item => item.id === id);
    if (!r) return;
    ui.editingId = id;

    openModal(`
      <div class="modal-backdrop">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal-head">
            <div>
              <p class="eyebrow accent">Registro #${r.seq}</p>
              <h3>Editar Exame</h3>
            </div>
            <button type="button" class="icon-btn" data-close aria-label="Fechar">${ICONS.x}</button>
          </div>
          <form id="editForm" novalidate>
            <div class="field">
              <label for="eTech">Técnicos do plantão</label>
              <input id="eTech" type="text" value="${esc(r.technician)}">
            </div>
            <div class="field-row">
              <div class="field">
                <label for="eDate">Data do exame</label>
                <input id="eDate" type="date" value="${r.date}">
              </div>
              <div class="field">
                <label>Hora do registro</label>
                <div class="time-readonly">${esc(r.time)}</div>
              </div>
            </div>
            <div class="field">
              <label for="eBam">Número BAM</label>
              <input id="eBam" type="text" value="${esc(r.bam)}">
            </div>
            <div class="field">
              <label for="ePatient">Nome do paciente</label>
              <input id="ePatient" type="text" value="${esc(r.patient)}">
            </div>
            <div class="field">
              <label>Tipo de paciente</label>
              <div class="seg" id="ePtype">
                <button type="button" class="seg-btn" data-type="internado">${ICONS.hospital} Internado</button>
                <button type="button" class="seg-btn" data-type="emergencia">${ICONS.emergency} Emergência</button>
              </div>
            </div>
            <div class="field">
              <div class="field-head">
                <label>Exames</label>
                <button type="button" class="btn btn-cyan-ghost" id="eAddExam">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                  Adicionar Exame
                </button>
              </div>
              <div id="eExamRows" class="exam-rows"></div>
            </div>
            <div class="field">
              <label for="eNotes">Observações (opcional)</label>
              <textarea id="eNotes" rows="2" placeholder="Adicione observações sobre o exame">${esc(r.notes)}</textarea>
            </div>
          </form>
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" data-close>Cancelar</button>
            <button type="button" class="btn btn-primary" id="editSave">Salvar Alterações</button>
          </div>
        </div>
      </div>
    `);

    let ptype = r.patientType === 'internado' ? 'internado' : 'emergencia';
    const wrapper = $('#eExamRows');
    const modal = $('#modalRoot .modal');
    const ptypeButtons = $$('#ePtype .seg-btn', modal);

    const syncPtype = () => ptypeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.type === ptype));
    syncPtype();
    ptypeButtons.forEach(btn => btn.addEventListener('click', () => {
      ptype = btn.dataset.type;
      syncPtype();
    }));

    setupExamEditor(wrapper, r.exams.map(ex => ex.type));
    // keep exam ids in the same order so times are preserved
    $$('.exam-row', wrapper).forEach((row, i) => {
      if (r.exams[i]) row.dataset.examId = r.exams[i].id;
    });

    $('#eAddExam', modal).addEventListener('click', () => {
      wrapper.appendChild(makeExamRow());
      renumberExamRows(wrapper);
    });

    $('#editSave', modal).addEventListener('click', () => {
      const tech = $('#eTech', modal).value.trim();
      const date = $('#eDate', modal).value;
      const bam = $('#eBam', modal).value.trim();
      const patient = $('#ePatient', modal).value.trim();
      const values = readExamValues(wrapper);

      let ok = true;
      [['#eTech', tech], ['#eDate', date], ['#eBam', bam], ['#ePatient', patient]].forEach(([sel, val]) => {
        const el = $(sel, modal);
        el.classList.toggle('invalid', !val);
        if (!val) ok = false;
      });
      values.forEach(v => {
        v.select.classList.toggle('invalid', !v.type);
        if (!v.type) ok = false;
      });

      if (!ok) {
        toast('Preencha os campos obrigatórios e selecione o tipo de cada exame.', 'warn');
        return;
      }

      const now = nowHM();
      const newExams = values.map(v => {
        const existing = r.exams.find(ex => ex.id === v.id);
        return { id: v.id || uid(), type: v.type, time: existing ? existing.time : now };
      });

      r.technician = tech.toLocaleUpperCase('pt-BR');
      r.date = date;
      r.bam = bam;
      r.patient = patient.toLocaleUpperCase('pt-BR');
      r.patientType = ptype;
      r.notes = $('#eNotes', modal).value.trim();
      r.exams = newExams;
      config.lastPatientType = ptype;
      saveConfig();
      saveRecords();
      closeModal();
      renderAll();
      toast(`Registro #${r.seq} atualizado.`);
    });
  }

  function confirmDeleteRecord(id) {
    const r = records.find(item => item.id === id);
    if (!r) return;
    confirmDialog({
      eyebrow: `Registro #${r.seq}`,
      title: 'Excluir Registro',
      message: `Excluir o registro <strong>#${r.seq}</strong> de <strong>${esc(r.patient)}</strong>? ${plural(r.exams.length, 'exame será removido', 'exames serão removidos')} junto com o registro.`,
      warning: 'Esta ação não pode ser desfeita. O número sequencial será liberado e reutilizado automaticamente pelo próximo registro.',
      confirmLabel: 'Excluir Registro',
      onConfirm: () => {
        records = records.filter(item => item.id !== id);
        saveRecords();
        renderAll();
        toast(`Registro #${r.seq} excluído.`);
      }
    });
  }

  function confirmDeleteExam(recordId, examId) {
    const r = records.find(item => item.id === recordId);
    if (!r || r.exams.length <= 1) return;
    const exam = r.exams.find(ex => ex.id === examId);
    if (!exam) return;
    confirmDialog({
      eyebrow: `Registro #${r.seq}`,
      title: 'Excluir Exame',
      message: `Remover o exame <strong>${esc(exam.type)}</strong> do registro <strong>#${r.seq}</strong> de <strong>${esc(r.patient)}</strong>?`,
      warning: 'O registro continuará existindo com os demais exames.',
      confirmLabel: 'Excluir Exame',
      onConfirm: () => {
        r.exams = r.exams.filter(ex => ex.id !== examId);
        saveRecords();
        renderAll();
        toast('Exame removido do registro.');
      }
    });
  }

  /* ---------------- reports: ranges and notes ---------------- */
  function reportRange(kind) {
    if (kind === 'day') {
      const iso = $('#repDay').value;
      if (!iso) return null;
      const [start, end] = dayBounds(iso);
      return { start, end, iso };
    }
    if (kind === 'range') {
      const s = $('#repStart').value;
      const e = $('#repEnd').value;
      if (!s || !e || s > e) return null;
      return { start: dayBounds(s)[0], end: dayBounds(e)[1], startISO: s, endISO: e };
    }
    if (kind === 'month') {
      const ym = $('#repMonth').value;
      if (!ym) return null;
      const [start, end] = monthBounds(ym);
      return { start, end, ym };
    }
    return null;
  }

  function renderReportNotes() {
    const day = reportRange('day');
    if (day) {
      const list = filterRange(day.start, day.end);
      $('#repDayNote').textContent = `${plural(examsOf(list), 'exame', 'exames')} · ${plural(uniquePatients(list), 'paciente', 'pacientes')}`;
    } else {
      $('#repDayNote').textContent = 'Selecione a data';
    }

    const range = reportRange('range');
    if (range) {
      const list = filterRange(range.start, range.end);
      $('#repRangeNote').textContent = `${plural(examsOf(list), 'exame', 'exames')} · ${plural(uniquePatients(list), 'paciente', 'pacientes')}`;
    } else {
      $('#repRangeNote').textContent = 'Intervalo inválido';
    }

    const month = reportRange('month');
    if (month) {
      const list = filterRange(month.start, month.end);
      $('#repMonthNote').textContent = `${plural(examsOf(list), 'exame', 'exames')} · ${plural(uniquePatients(list), 'paciente', 'pacientes')}`;
    } else {
      $('#repMonthNote').textContent = 'Selecione o mês';
    }
  }

  function getReportConfig(kind) {
    if (kind === 'day') {
      const iso = $('#repDay').value || todayISO();
      const [start, end] = dayBounds(iso);
      return {
        title: 'Relatório por Dia',
        subtitle: `Período de 07:00 de ${brDate(iso)} às 07:00 de ${brDate(addDaysISO(iso, 1))}`,
        start, end,
        fileBase: `tomografia-dia-${fileStamp(iso)}`
      };
    }
    if (kind === 'range') {
      const s = $('#repStart').value;
      const e = $('#repEnd').value;
      if (!s || !e) { toast('Informe a data inicial e a final.', 'warn'); return null; }
      if (s > e) { toast('A data inicial deve ser anterior à data final.', 'warn'); return null; }
      return {
        title: 'Relatório por Intervalo',
        subtitle: `De ${brDate(s)} 07:00 até ${brDate(addDaysISO(e, 1))} 07:00`,
        start: dayBounds(s)[0],
        end: dayBounds(e)[1],
        fileBase: `tomografia-periodo-${fileStamp(s)}-a-${fileStamp(e)}`
      };
    }
    if (kind === 'month') {
      const ym = $('#repMonth').value || currentMonth();
      const [start, end] = monthBounds(ym);
      return {
        title: 'Relatório Mensal',
        subtitle: `${monthLabelCap(ym)} · períodos de 07:00 às 07:00`,
        start, end,
        fileBase: `tomografia-mes-${ym}`
      };
    }
    return null;
  }

  /* ---------------- report builder ---------------- */
  function buildReport(cfg) {
    const list = filterRange(cfg.start, cfg.end)
      .sort((a, b) => recordTs(a) - recordTs(b) || a.seq - b.seq);

    const rows = [];
    const types = new Map();
    const techs = new Map();
    const ptypes = new Map();
    const days = new Map();

    list.forEach(r => {
      const ptype = ptypeLabel(r.patientType);
      const patientKey = `${r.patient}|${r.bam}`;
      const opDay = opDateOfTs(recordTs(r));

      if (!days.has(opDay)) days.set(opDay, { exams: 0, patients: new Set() });
      if (!techs.has(r.technician)) techs.set(r.technician, { exams: 0, patients: new Set() });
      if (!ptypes.has(ptype)) ptypes.set(ptype, { exams: 0, patients: new Set() });

      days.get(opDay).patients.add(patientKey);
      techs.get(r.technician).patients.add(patientKey);
      ptypes.get(ptype).patients.add(patientKey);

      const examTypes = r.exams.map(ex => ex.type);
      const times = Array.from(new Set(r.exams.map(ex => ex.time).filter(Boolean)));

      rows.push({
        seq: r.seq,
        date: brDate(r.date),
        time: times.join(', '),
        bam: r.bam,
        patient: r.patient,
        ptype,
        tech: r.technician,
        exam: examTypes.join(', '),
        notes: r.notes || ''
      });

      r.exams.forEach(ex => {
        types.set(ex.type, (types.get(ex.type) || 0) + 1);
        days.get(opDay).exams++;
        techs.get(r.technician).exams++;
        ptypes.get(ptype).exams++;
      });
    });

    const startISO = ymd(cfg.start);
    const lastISO = addDaysISO(ymd(cfg.end), -1);
    const dayList = eachISO(startISO, lastISO).map(iso => {
      const entry = days.get(iso);
      return {
        iso,
        label: brDate(iso),
        exams: entry ? entry.exams : 0,
        patients: entry ? entry.patients.size : 0
      };
    });

    return {
      ...cfg,
      list,
      rows,
      examsTotal: examsOf(list),
      patients: uniquePatients(list),
      types: sortedEntries(types),
      techs: sortedEntries(new Map(Array.from(techs.entries()).map(([name, v]) => [name, v.exams]))),
      techPatients: techs,
      ptypes: Array.from(ptypes.entries()).map(([name, v]) => [name, v.exams, v.patients.size]),
      dayList
    };
  }

  /* ---------------- PDF export ---------------- */
  function exportPDF(kind) {
    const cfg = getReportConfig(kind);
    if (!cfg) return;
    const report = buildReport(cfg);
    if (!report.rows.length) {
      toast('Nenhum exame encontrado no período selecionado.', 'warn');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const M = 36;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const contentW = pageW - M * 2;
    const generatedAt = new Date().toLocaleString('pt-BR');

    const drawHeader = () => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.6);
      doc.setTextColor(120, 132, 148);
      doc.text('PREFEITURA DE SÃO GONÇALO · PRONTO SOCORRO CENTRAL DR. ARMANDO GOMES DE SÁ COUTO', M, 26);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(14, 22, 34);
      doc.text(cfg.title.toUpperCase(), M, 47);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(90, 103, 120);
      doc.text(cfg.subtitle, M, 61);

      doc.setFontSize(6.8);
      doc.text(`Sistema de Exames de Tomografia · gerado em ${generatedAt}`, pageW - M, 26, { align: 'right' });

      doc.setDrawColor(0, 186, 200);
      doc.setLineWidth(1.6);
      doc.line(M, 68, M + 46, 68);
    };

    drawHeader();

    // KPI band
    doc.setFillColor(243, 247, 250);
    doc.roundedRect(M, 76, contentW, 30, 4, 4, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.roundedRect(M, 76, contentW, 30, 4, 4, 'S');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    const kpis = [
      ['EXAMES', String(report.examsTotal)],
      ['PACIENTES', String(report.patients)],
      ['REGISTROS', String(report.list.length)],
      ['TÉCNICOS', String(report.techs.length)]
    ];
    const cellW = contentW / 4;
    kpis.forEach(([label, value], i) => {
      const x = M + 14 + cellW * i;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 132, 148);
      doc.text(label, x, 90);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(14, 22, 34);
      doc.setFontSize(12);
      doc.text(value, x, 101);
      doc.setFontSize(7.2);
    });

    doc.autoTable({
      startY: 118,
      margin: { left: M, right: M, top: 78, bottom: 34 },
      head: [['Nº', 'Data', 'Hora', 'BAM', 'Paciente', 'Tipo', 'Técnico', 'Exames', 'Observações']],
      body: report.rows.map(row => [
        `#${row.seq}`, row.date, row.time, row.bam, row.patient, row.ptype, row.tech, row.exam, row.notes
      ]),
      styles: {
        font: 'helvetica',
        fontSize: 7.1,
        cellPadding: 3.6,
        textColor: [30, 41, 59],
        lineColor: [232, 237, 243],
        lineWidth: 0.35,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [10, 13, 18],
        textColor: [0, 228, 242],
        fontStyle: 'bold',
        fontSize: 6.5,
        cellPadding: 4.5
      },
      alternateRowStyles: { fillColor: [249, 251, 253] },
      columnStyles: {
        0: { cellWidth: 30, fontStyle: 'bold', textColor: [2, 132, 199] },
        1: { cellWidth: 54 },
        2: { cellWidth: 40 },
        3: { cellWidth: 62 },
        4: { cellWidth: 162 },
        5: { cellWidth: 58 },
        6: { cellWidth: 86 },
        7: { cellWidth: 150 },
        8: { cellWidth: 'auto' }
      },
      didDrawPage: () => drawHeader()
    });

    // ---- summary page ----
    doc.addPage();
    drawHeader();
    let y = 96;

    const summaryTable = (title, head, body) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(14, 22, 34);
      doc.text(title, M, y);

      doc.autoTable({
        startY: y + 7,
        margin: { left: M, right: M, top: 80, bottom: 34 },
        head: [head],
        body,
        styles: {
          font: 'helvetica',
          fontSize: 7.6,
          cellPadding: 4,
          textColor: [30, 41, 59],
          lineColor: [232, 237, 243],
          lineWidth: 0.35
        },
        headStyles: { fillColor: [243, 247, 250], textColor: [51, 65, 85], fontStyle: 'bold', fontSize: 7 },
        tableWidth: 'wrap',
        didDrawPage: () => drawHeader()
      });
      y = doc.lastAutoTable.finalY + 18;
      if (y > pageH - 60) {
        doc.addPage();
        drawHeader();
        y = 96;
      }
    };

    const totalExams = report.examsTotal;

    summaryTable(
      'Resumo por dia',
      ['Dia', 'Exames', 'Pacientes'],
      report.dayList.map(d => [d.label, String(d.exams), String(d.patients)])
    );

    summaryTable(
      'Resumo por tipo de exame',
      ['Tipo de exame', 'Quantidade', '%'],
      report.types.map(([type, count]) => [
        type, String(count), `${(count / totalExams * 100).toFixed(1).replace('.', ',')}%`
      ])
    );

    summaryTable(
      'Resumo por técnico',
      ['Técnico', 'Exames', 'Pacientes'],
      report.techs.map(([name, count]) => [
        name, String(count), String(report.techPatients.get(name).patients.size)
      ])
    );

    summaryTable(
      'Resumo por tipo de paciente',
      ['Tipo de paciente', 'Exames', 'Pacientes'],
      report.ptypes.map(([name, examsCount, patientsCount]) => [
        name, String(examsCount), String(patientsCount)
      ])
    );

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.6);
      doc.setTextColor(148, 163, 184);
      doc.text('Sistema de Exames de Tomografia · Arquitetura da Claridade Radial', M, pageH - 18);
      doc.text(`Página ${i} de ${pageCount}`, pageW - M, pageH - 18, { align: 'right' });
    }

    doc.save(`${cfg.fileBase}.pdf`);
    toast('Relatório PDF gerado.');
  }

  /* ---------------- Excel export ---------------- */
  function exportXLSX(kind) {
    const cfg = getReportConfig(kind);
    if (!cfg) return;
    const report = buildReport(cfg);
    if (!report.rows.length) {
      toast('Nenhum exame encontrado no período selecionado.', 'warn');
      return;
    }

    const wb = XLSX.utils.book_new();
    const totalExams = report.examsTotal;

    const detail = [
      ['Nº', 'Data', 'Hora', 'BAM', 'Paciente', 'Tipo', 'Técnico', 'Exames', 'Observações'],
      ...report.rows.map(row => [
        row.seq, row.date, row.time, row.bam, row.patient, row.ptype, row.tech, row.exam, row.notes
      ])
    ];
    const wsDetail = XLSX.utils.aoa_to_sheet(detail);
    wsDetail['!cols'] = [
      { wch: 6 }, { wch: 11 }, { wch: 7 }, { wch: 12 }, { wch: 40 },
      { wch: 12 }, { wch: 18 }, { wch: 28 }, { wch: 40 }
    ];
    wsDetail['!autofilter'] = {
      ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: detail.length - 1, c: 8 } })
    };
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Exames');

    const wsTypes = XLSX.utils.aoa_to_sheet([
      ['Tipo de exame', 'Quantidade', '%'],
      ...report.types.map(([type, count]) => [
        type, count, Number((count / totalExams * 100).toFixed(2))
      ])
    ]);
    wsTypes['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, wsTypes, 'Resumo por Tipo');

    const wsDays = XLSX.utils.aoa_to_sheet([
      ['Dia', 'Exames', 'Pacientes'],
      ...report.dayList.map(d => [d.label, d.exams, d.patients])
    ]);
    wsDays['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 11 }];
    XLSX.utils.book_append_sheet(wb, wsDays, 'Resumo por Dia');

    const wsTechs = XLSX.utils.aoa_to_sheet([
      ['Técnico', 'Exames', 'Pacientes'],
      ...report.techs.map(([name, count]) => [
        name, count, report.techPatients.get(name).patients.size
      ])
    ]);
    wsTechs['!cols'] = [{ wch: 26 }, { wch: 10 }, { wch: 11 }];
    XLSX.utils.book_append_sheet(wb, wsTechs, 'Resumo por Técnico');

    const wsPtypes = XLSX.utils.aoa_to_sheet([
      ['Tipo de paciente', 'Exames', 'Pacientes'],
      ...report.ptypes.map(([name, examsCount, patientsCount]) => [name, examsCount, patientsCount])
    ]);
    wsPtypes['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 11 }];
    XLSX.utils.book_append_sheet(wb, wsPtypes, 'Tipo de Paciente');

    XLSX.writeFile(wb, `${cfg.fileBase}.xlsx`);
    toast('Planilha Excel gerada.');
  }

  /* ---------------- charts ---------------- */
  function destroyChart(key) {
    if (charts[key]) {
      charts[key].destroy();
      charts[key] = null;
    }
  }

  function chartPlaceholder(canvasId, show, message) {
    const canvas = document.getElementById(canvasId);
    const wrap = canvas.parentElement;
    let ph = wrap.querySelector('.chart-empty');
    if (!ph) {
      ph = document.createElement('div');
      ph.className = 'chart-empty';
      wrap.appendChild(ph);
    }
    ph.textContent = message;
    ph.style.display = show ? 'grid' : 'none';
    canvas.style.display = show ? 'none' : 'block';
  }

  function tooltipStyle() {
    return {
      backgroundColor: '#0f141b',
      borderColor: 'rgba(148,163,184,.25)',
      borderWidth: 1,
      titleColor: '#e6edf5',
      bodyColor: '#b7c2d0',
      padding: 10,
      cornerRadius: 8,
      displayColors: false
    };
  }

  function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function renderCharts() {
    if (typeof Chart === 'undefined') return;

    const canvasDaily = document.getElementById('chartDaily');
    if (!canvasDaily) return;

    const ym = $('#chartMonth').value || currentMonth();
    const [start, end] = monthBounds(ym);
    const list = filterRange(start, end);
    const total = examsOf(list);
    const patients = uniquePatients(list);

    const [yNum, mNum] = ym.split('-').map(Number);
    const daysInMonth = new Date(yNum, mNum, 0).getDate();
    const isCurrent = ym === currentMonth();
    const opToday = opDateOfTs(new Date());
    const elapsedDays = isCurrent
      ? (opToday.startsWith(ym) ? Number(opToday.slice(8, 10)) : 1)
      : daysInMonth;
    const avg = total ? (total / elapsedDays).toFixed(1).replace('.', ',') : '0';

    // bucket by operational day
    const dayCounts = new Array(daysInMonth).fill(0);
    list.forEach(r => {
      const opDay = opDateOfTs(recordTs(r));
      if (!opDay.startsWith(ym)) return;
      const index = Number(opDay.slice(8, 10)) - 1;
      if (index >= 0 && index < daysInMonth) dayCounts[index] += r.exams.length;
    });

    let peakIndex = -1;
    dayCounts.forEach((count, i) => { if (peakIndex < 0 || count > dayCounts[peakIndex]) peakIndex = i; });
    const peakCount = peakIndex >= 0 ? dayCounts[peakIndex] : 0;
    const peakLabel = peakCount > 0
      ? `${pad2(peakIndex + 1)}/${pad2(mNum)}`
      : '—';

    $('#chartKpis').innerHTML = `
      <div class="kpi">
        <p class="eyebrow">Exames no mês</p>
        <div class="kpi-value cyan">${total}</div>
        <small>${monthLabelCap(ym)}</small>
      </div>
      <div class="kpi">
        <p class="eyebrow">Pacientes</p>
        <div class="kpi-value">${patients}</div>
        <small>atendimentos únicos</small>
      </div>
      <div class="kpi">
        <p class="eyebrow">Média por dia</p>
        <div class="kpi-value">${avg}</div>
        <small>por período 07:00–07:00</small>
      </div>
      <div class="kpi">
        <p class="eyebrow">Dia de pico</p>
        <div class="kpi-value amber">${peakLabel}</div>
        <small>${peakCount > 0 ? plural(peakCount, 'exame', 'exames') : 'sem dados'}</small>
      </div>`;

    $('#tagDaily').textContent = `${plural(total, 'exame', 'exames')} · ${monthLabel(ym)}`;

    ['chartDaily', 'chartTypes', 'chartTechs', 'chartPtype', 'chartPatients', 'chartHours']
      .forEach(id => destroyChart(id));

    const chartsGrid = document.querySelector('.charts-grid');
    if (!total) {
      chartsGrid.classList.add('hidden');
      $('#chartsEmpty').classList.remove('hidden');
      $('#legendTypes').innerHTML = '';
      $('#legendPtype').innerHTML = '';
      return;
    }
    chartsGrid.classList.remove('hidden');
    $('#chartsEmpty').classList.add('hidden');

    ['chartDaily', 'chartTypes', 'chartTechs', 'chartPtype', 'chartPatients', 'chartHours']
      .forEach(id => chartPlaceholder(id, false, ''));

    Chart.defaults.font.family = "'JetBrains Mono', ui-monospace, monospace";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#5f6c7d';

    /* ---- daily line ---- */
    const dailyLabels = dayCounts.map((_, i) => `${pad2(i + 1)}/${pad2(mNum)}`);
    const ctxDaily = document.getElementById('chartDaily').getContext('2d');
    const gradient = ctxDaily.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, 'rgba(0,240,255,0.20)');
    gradient.addColorStop(1, 'rgba(0,240,255,0)');

    charts.chartDaily = new Chart(ctxDaily, {
      type: 'line',
      data: {
        labels: dailyLabels,
        datasets: [{
          data: dayCounts,
          borderColor: '#00f0ff',
          backgroundColor: gradient,
          borderWidth: 2,
          fill: true,
          tension: 0.32,
          pointRadius: 2.5,
          pointHoverRadius: 5,
          pointBackgroundColor: '#00f0ff',
          pointBorderColor: '#04161a',
          pointBorderWidth: 1.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipStyle(),
            callbacks: {
              title: items => `${items[0].label}/${yNum}`,
              label: item => ` ${plural(item.parsed.y, 'exame', 'exames')}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(148,163,184,0.06)' },
            ticks: { maxTicksLimit: 16, color: '#5f6c7d', maxRotation: 0 }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(148,163,184,0.08)' },
            ticks: { precision: 0, color: '#5f6c7d' }
          }
        }
      }
    });

    /* ---- types doughnut ---- */
    const typeCounts = new Map();
    list.forEach(r => r.exams.forEach(ex => typeCounts.set(ex.type, (typeCounts.get(ex.type) || 0) + 1)));
    const typeEntries = sortedEntries(typeCounts);
    const topTypes = typeEntries.slice(0, 10);
    const otherCount = typeEntries.slice(10).reduce((sum, entry) => sum + entry[1], 0);
    const typesLabels = topTypes.map(entry => entry[0]);
    const typesData = topTypes.map(entry => entry[1]);
    const typesColors = topTypes.map((_, i) => COLORS[i % COLORS.length]);
    if (otherCount > 0) {
      typesLabels.push('Outros');
      typesData.push(otherCount);
      typesColors.push('#475569');
    }

    charts.chartTypes = new Chart(document.getElementById('chartTypes'), {
      type: 'doughnut',
      data: {
        labels: typesLabels,
        datasets: [{
          data: typesData,
          backgroundColor: typesColors,
          borderColor: '#0b0e13',
          borderWidth: 2,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '58%',
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipStyle(),
            callbacks: {
              label: item => ` ${plural(item.parsed, 'exame', 'exames')}`
            }
          }
        }
      }
    });

    $('#legendTypes').innerHTML = typesLabels.map((label, i) => `
      <div class="legend-row">
        <span class="legend-dot" style="background:${typesColors[i]}"></span>
        <span>${esc(label)}</span>
        <span class="val">${typesData[i]}</span>
      </div>`).join('');

    /* ---- technicians ---- */
    const techCounts = new Map();
    list.forEach(r => techCounts.set(r.technician, (techCounts.get(r.technician) || 0) + r.exams.length));
    const techEntries = sortedEntries(techCounts).slice(0, 8);

    charts.chartTechs = new Chart(document.getElementById('chartTechs'), {
      type: 'bar',
      data: {
        labels: techEntries.map(entry => truncate(entry[0], 18)),
        datasets: [{
          data: techEntries.map(entry => entry[1]),
          backgroundColor: 'rgba(0,240,255,0.5)',
          hoverBackgroundColor: 'rgba(0,240,255,0.75)',
          borderRadius: 4,
          barThickness: 18
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipStyle(),
            callbacks: { label: item => ` ${plural(item.parsed.x, 'exame', 'exames')}` }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: 'rgba(148,163,184,0.07)' },
            ticks: { precision: 0, color: '#5f6c7d' }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#8b98a9' }
          }
        }
      }
    });

    /* ---- patient type ---- */
    const ptypeCounts = new Map([
      ['Emergência', 0],
      ['Internado', 0]
    ]);
    list.forEach(r => {
      const label = ptypeLabel(r.patientType);
      ptypeCounts.set(label, (ptypeCounts.get(label) || 0) + r.exams.length);
    });
    const ptypeLabels = ['Emergência', 'Internado'];
    const ptypeData = ptypeLabels.map(label => ptypeCounts.get(label) || 0);
    const ptypeColors = ['#f5a524', '#00f0ff'];

    charts.chartPtype = new Chart(document.getElementById('chartPtype'), {
      type: 'doughnut',
      data: {
        labels: ptypeLabels,
        datasets: [{
          data: ptypeData,
          backgroundColor: ptypeColors,
          borderColor: '#0b0e13',
          borderWidth: 2,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '58%',
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipStyle(),
            callbacks: { label: item => ` ${plural(item.parsed, 'exame', 'exames')}` }
          }
        }
      }
    });

    const ptypeTotal = ptypeData.reduce((sum, value) => sum + value, 0);
    $('#legendPtype').innerHTML = ptypeLabels.map((label, i) => `
      <div class="legend-row">
        <span class="legend-dot" style="background:${ptypeColors[i]}"></span>
        <span>${esc(label)}</span>
        <span class="val">${ptypeData[i]} · ${ptypeTotal ? Math.round(ptypeData[i] / ptypeTotal * 100) : 0}%</span>
      </div>`).join('');

    /* ---- top patients ---- */
    const patientMap = new Map();
    list.forEach(r => {
      const key = `${r.patient}|${r.bam}`;
      const entry = patientMap.get(key) || { name: r.patient, exams: 0 };
      entry.exams += r.exams.length;
      patientMap.set(key, entry);
    });
    const topPatients = Array.from(patientMap.values())
      .sort((a, b) => b.exams - a.exams || a.name.localeCompare(b.name, 'pt-BR'))
      .slice(0, 8);

    charts.chartPatients = new Chart(document.getElementById('chartPatients'), {
      type: 'bar',
      data: {
        labels: topPatients.map(p => truncate(p.name, 22)),
        datasets: [{
          data: topPatients.map(p => p.exams),
          backgroundColor: 'rgba(245,165,36,0.5)',
          hoverBackgroundColor: 'rgba(245,165,36,0.75)',
          borderRadius: 4,
          barThickness: 18
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipStyle(),
            callbacks: { label: item => ` ${plural(item.parsed.x, 'exame', 'exames')}` }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: 'rgba(148,163,184,0.07)' },
            ticks: { precision: 0, color: '#5f6c7d' }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#8b98a9' }
          }
        }
      }
    });

    /* ---- hours ---- */
    const hours = new Array(24).fill(0);
    list.forEach(r => {
      const hour = Number((r.time || '00:00').split(':')[0]);
      r.exams.forEach(() => { hours[hour] += 1; });
    });
    const hourOrder = Array.from({ length: 24 }, (_, i) => (OP_HOUR + i) % 24);
    const hourData = hourOrder.map(h => hours[h]);
    const maxHour = Math.max(...hourData);

    charts.chartHours = new Chart(document.getElementById('chartHours'), {
      type: 'bar',
      data: {
        labels: hourOrder.map(h => `${pad2(h)}h`),
        datasets: [{
          data: hourData,
          backgroundColor: hourData.map(value => value === maxHour && value > 0 ? 'rgba(245,165,36,0.75)' : 'rgba(0,240,255,0.35)'),
          hoverBackgroundColor: 'rgba(0,240,255,0.7)',
          borderRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipStyle(),
            callbacks: {
              title: items => `Horário ${items[0].label}`,
              label: item => ` ${plural(item.parsed.y, 'exame', 'exames')}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#5f6c7d', font: { size: 10 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(148,163,184,0.08)' },
            ticks: { precision: 0, color: '#5f6c7d' }
          }
        }
      }
    });
  }

  /* ---------------- render all ---------------- */
  function renderAll() {
    renderDayTechs();
    renderNextSeq();
    renderStats();
    renderRecords();
    renderReportNotes();
    renderCharts();
  }

  /* ---------------- events ---------------- */
  function bindEvents() {
    $('#examForm').addEventListener('submit', handleSubmit);
    $('#examForm').addEventListener('input', e => {
      if (e.target.matches('input, select, textarea')) e.target.classList.remove('invalid');
    });

    $('#btnAddExam').addEventListener('click', () => {
      const wrapper = $('#examRows');
      wrapper.appendChild(makeExamRow());
      renumberExamRows(wrapper);
      const selects = $$('#examRows select');
      selects[selects.length - 1].focus();
    });

    $('#ptype').addEventListener('click', e => {
      const btn = e.target.closest('.seg-btn');
      if (!btn) return;
      ui.patientType = btn.dataset.type;
      updatePtypeUI();
    });

    $('#examDate').addEventListener('change', renderNextSeq);

    $('#btnResetSeq').addEventListener('click', () => {
      const targetMonth = monthOf($('#examDate').value || todayISO());
      const label = monthLabelCap(targetMonth);
      confirmDialog({
        eyebrow: 'Numeração sequencial',
        title: 'Zerar Sequencial',
        message: `O próximo exame registrado em <strong>${label}</strong> receberá o número <strong>#1</strong>.`,
        warning: 'Os registros já lançados permanecem com os números atuais. A numeração mensal recomeça a partir do próximo lançamento.',
        confirmLabel: 'Zerar Sequencial',
        onConfirm: () => {
          config.seqCounters[targetMonth] = 1;
          saveConfig();
          renderNextSeq();
          toast(`Sequencial de ${label} zerado. Próximo exame: #1.`);
        }
      });
    });

    $('#search').addEventListener('input', e => {
      ui.search = e.target.value;
      ui.limit = PAGE_SIZE;
      renderRecords();
    });

    $('#btnToggleAll').addEventListener('click', () => {
      ui.showAll = !ui.showAll;
      ui.limit = PAGE_SIZE;
      $('#btnToggleAll').textContent = ui.showAll ? 'Ver Exames do Período' : 'Ver Todos os Exames';
      renderRecords();
    });

    $('#btnMore').addEventListener('click', () => {
      ui.limit += LOAD_MORE;
      renderRecords();
    });

    $('#records').addEventListener('click', e => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const { act, id, exam } = btn.dataset;
      if (act === 'edit') openEdit(id);
      else if (act === 'del') confirmDeleteRecord(id);
      else if (act === 'del-exam') confirmDeleteExam(id, exam);
    });

    ['#repDay', '#repStart', '#repEnd', '#repMonth'].forEach(sel => {
      $(sel).addEventListener('change', renderReportNotes);
    });

    $$('[data-export]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [kind, format] = btn.dataset.export.split('-');
        if (format === 'pdf') exportPDF(kind);
        else exportXLSX(kind);
      });
    });

    $('#chartMonth').addEventListener('change', renderCharts);

    window.addEventListener('storage', e => {
      if (e.key === STORE_KEY) {
        records = loadRecords();
        renderAll();
      } else if (e.key === CFG_KEY) {
        config = loadConfig();
        renderNextSeq();
      }
    });
  }

  /* ---------------- init ---------------- */
  function init() {
    records = loadRecords();
    config = loadConfig();

    const today = todayISO();
    $('#examDate').value = today;
    $('#repDay').value = today;
    $('#repStart').value = today;
    $('#repEnd').value = today;
    $('#repMonth').value = currentMonth();
    $('#chartMonth').value = currentMonth();

    ui.patientType = config.lastPatientType;
    updatePtypeUI();

    $('#tech').value = config.lastTech || '';
    $('#regTime').textContent = nowHM();

    setupExamEditor($('#examRows'), []);
    bindEvents();
    renderAll();

    setInterval(renderFormTime, 30000);

    // keep the operational period label fresh across midnight/07:00
    let lastOpDate = currentOpDate();
    setInterval(() => {
      const op = currentOpDate();
      if (op !== lastOpDate) {
        lastOpDate = op;
        renderAll();
      }
    }, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
