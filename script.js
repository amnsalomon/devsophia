'use strict';

// Apenas navegação local: este site não faz chamadas à API de entrevistas.
document.body.classList.add('enhanced');
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const sidebar = $('#sidebar');
const menu = $('.menu-toggle');
const overlay = $('.sidebar-overlay');
const mobile = window.matchMedia('(max-width: 760px)');

function setMenu(open, restoreFocus = false) {
  const active = open && mobile.matches;
  document.body.classList.toggle('menu-open', active);
  menu.setAttribute('aria-expanded', String(active));
  overlay.hidden = !active;
  sidebar.inert = mobile.matches && !active;
  if (active) sidebar.querySelector('a').focus();
  if (restoreFocus) menu.focus();
}
menu.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
overlay.addEventListener('click', () => setMenu(false, true));
mobile.addEventListener('change', () => setMenu(false));
setMenu(false);

// As âncoras usam os identificadores do caderno original, com acentos.
function anchorTarget(href) {
  try { return document.getElementById(decodeURIComponent(href.slice(1))); }
  catch { return null; }
}
document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  const target = anchorTarget(link.getAttribute('href'));
  if (!target) return;
  if (link.closest('.sidebar')) setMenu(false);
  closeSearch();
  // O comportamento nativo preserva o histórico e o endereço compartilhável.
  requestAnimationFrame(() => target.focus({ preventScroll: true }));
});

// Botões são acrescentados fora do código para preservar a cópia literal.
const languageNames = { javascript: 'JavaScript', python: 'Python', bash: 'cURL / Bash', json: 'JSON', http: 'HTTP', texto: 'Texto' };
for (const block of $$('.code-block')) {
  const toolbar = document.createElement('div');
  toolbar.className = 'code-toolbar';
  const label = document.createElement('span');
  label.textContent = languageNames[block.dataset.language] || block.dataset.language;
  const button = document.createElement('button');
  button.className = 'copy-button';
  button.type = 'button';
  button.textContent = 'Copiar';
  button.setAttribute('aria-label', `Copiar exemplo em ${label.textContent}`);
  toolbar.append(label, button);
  block.prepend(toolbar);
  let reset;
  button.addEventListener('click', async () => {
    const code = block.querySelector('code');
    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code.textContent);
        copied = true;
      }
    } catch { /* Tenta a cópia local abaixo quando o navegador a permite. */ }
    if (!copied) {
      const field = document.createElement('textarea');
      field.value = code.textContent;
      field.setAttribute('readonly', '');
      field.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.append(field);
      field.select();
      try { copied = document.execCommand('copy'); } catch { copied = false; }
      field.remove();
      button.focus({ preventScroll: true });
    }
    clearTimeout(reset);
    if (copied) {
      button.textContent = 'Copiado ✓';
      $('#copy-status').textContent = 'Exemplo copiado.';
    } else {
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      button.textContent = 'Código selecionado';
      $('#copy-status').textContent = 'Não foi possível copiar automaticamente. O código foi selecionado; use o comando copiar do seu dispositivo.';
    }
    reset = setTimeout(() => { button.textContent = 'Copiar'; }, 2500);
  });
}

// Índice gerado a partir do próprio documento, sem serviço externo.
const search = $('#search');
const panel = $('#search-panel');
const results = $('#search-results');
const status = $('#search-status');
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
const entries = [];
let entry = null;
for (const section of $$('.doc-section')) {
  if (section.dataset.section === 'sumário') continue;
  for (const node of section.children) {
    if (/^H[1-4]$/.test(node.tagName)) {
      if (entry) entries.push(entry);
      entry = { id: node.id, title: node.textContent.trim(), text: '' };
    } else if (entry) {
      const clone = node.cloneNode(true);
      clone.querySelectorAll('.code-toolbar').forEach(n => n.remove());
      entry.text += ` ${clone.textContent.replace(/\s+/g, ' ').trim()}`;
    }
  }
}
if (entry) entries.push(entry);
entries.forEach(item => { item.titleKey = normalize(item.title); item.textKey = normalize(item.text); });
search.disabled = false;

function closeSearch() {
  panel.hidden = true;
  search.setAttribute('aria-expanded', 'false');
}
function showResults() {
  const query = normalize(search.value.trim());
  results.replaceChildren();
  if (!query) { closeSearch(); return; }
  panel.hidden = false;
  search.setAttribute('aria-expanded', 'true');
  const words = query.split(/\s+/);
  const matches = entries.filter(item => words.every(word => `${item.titleKey} ${item.textKey}`.includes(word)))
    .map(item => ({ item, score: (item.titleKey.includes(query) ? 10 : 0) + words.filter(word => item.titleKey.includes(word)).length }))
    .sort((a, b) => b.score - a.score);
  status.textContent = matches.length ? `${matches.length} ${matches.length === 1 ? 'resultado' : 'resultados'}${matches.length > 30 ? ' · exibindo os primeiros 30' : ''}` : 'Nenhum resultado. Tente um campo, endpoint ou assunto do guia.';
  for (const { item } of matches.slice(0, 30)) {
    const link = document.createElement('a');
    link.href = `#${item.id}`;
    link.className = 'search-result';
    const title = document.createElement('strong');
    title.textContent = item.title;
    const snippet = document.createElement('small');
    const position = Math.max(0, item.textKey.indexOf(words[0]) - 48);
    snippet.textContent = `${position ? '…' : ''}${item.text.slice(position, position + 170).trim()}${item.text.length > position + 170 ? '…' : ''}`;
    link.append(title, snippet);
    results.append(link);
  }
}
search.addEventListener('input', showResults);
search.addEventListener('focus', () => { if (search.value.trim()) showResults(); });
search.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown' && results.firstElementChild && !panel.hidden) {
    event.preventDefault(); results.firstElementChild.focus();
  }
  if (event.key === 'Enter' && results.firstElementChild && !panel.hidden) {
    event.preventDefault(); results.firstElementChild.click();
  }
});
results.addEventListener('keydown', event => {
  const current = event.target.closest('a');
  if (!current) return;
  if (event.key === 'ArrowDown') { event.preventDefault(); (current.nextElementSibling || current).focus(); }
  if (event.key === 'ArrowUp') { event.preventDefault(); (current.previousElementSibling || search).focus(); }
});
document.addEventListener('click', event => { if (!event.target.closest('.search-wrap')) closeSearch(); });
document.addEventListener('focusin', event => { if (!event.target.closest('.search-wrap')) closeSearch(); });
document.addEventListener('keydown', event => {
  const typing = event.target.closest('input, textarea, select, [contenteditable="true"]');
  if (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault(); setMenu(false); search.focus();
  }
  if (event.key === 'Escape') {
    if (!panel.hidden) { closeSearch(); search.focus(); closeSearch(); }
    if (document.body.classList.contains('menu-open')) setMenu(false, true);
  }
  if (event.key === 'Tab' && document.body.classList.contains('menu-open')) {
    const links = [...sidebar.querySelectorAll('a')].filter(n => n.getClientRects().length);
    const first = links[0], last = links.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});

// A leitura real define a seção ativa e a linha de progresso no topo.
const sectionNodes = $$('.doc-section');
const navGroups = $$('.nav-group');
const subheadings = $$('.doc-section h3');
let activeId;
let activeSubId;
let scheduled = false;
function updateReading() {
  scheduled = false;
  const offset = mobile.matches ? 105 : 120;
  let current = sectionNodes[0];
  for (const section of sectionNodes) {
    if (section.getBoundingClientRect().top <= offset) current = section;
    else break;
  }
  if (current.dataset.section !== activeId) {
    activeId = current.dataset.section;
    navGroups.forEach(group => {
      const active = group.dataset.group === activeId;
      group.classList.toggle('active', active);
      const link = group.querySelector('.nav-link');
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  let selected = null;
  for (const heading of subheadings) {
    if (heading.closest('.doc-section') === current && heading.getBoundingClientRect().top <= offset + 8) selected = heading.id;
  }
  if (selected !== activeSubId) {
    activeSubId = selected;
    $$('.subnav a').forEach(link => {
      if (link.getAttribute('href') === `#${selected}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  const total = document.documentElement.scrollHeight - window.innerHeight;
  $('#reading-progress').style.width = `${total > 0 ? Math.min(100, Math.max(0, window.scrollY / total * 100)) : 0}%`;
}
function scheduleReading() { if (!scheduled) { scheduled = true; requestAnimationFrame(updateReading); } }
window.addEventListener('scroll', scheduleReading, { passive: true });
window.addEventListener('resize', scheduleReading);
window.addEventListener('hashchange', scheduleReading);
updateReading();
