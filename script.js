const $ = s => document.querySelector(s);
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
};

// Anahtarını sadece aşağıdaki tırnakların içine yapıştır
const DEFAULTS = {
  aiKey: 'sk_eOyzlCZgbCODMrKDb8Vrtrcy7UDT8mmq',
  key: '',
  cx: ''
};

let chats = store.get('camai.chats', []);
let cfg = { ...DEFAULTS, ...store.get('camai.cfg', {}) };
let currentId = null;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const save = () => store.set('camai.chats', chats);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const current = () => chats.find(c => c.id === currentId);

/* ---------- Sohbet yönetimi ---------- */
function newChat() {
  const c = { id: uid(), title: 'Yeni sohbet', msgs: [] };
  chats.unshift(c); currentId = c.id; save(); render();
  $('#input').focus();
}
function deleteChat(id) {
  if (!confirm('Bu sohbet silinsin mi?')) return;
  chats = chats.filter(c => c.id !== id);
  if (currentId === id) currentId = chats[0]?.id ?? null;
  save(); render();
}

/* ---------- Arayüz ---------- */
function renderList() {
  const q = $('#search').value.trim().toLocaleLowerCase('tr');
  const found = chats.filter(c => !q || c.title.toLocaleLowerCase('tr').includes(q) ||
    c.msgs.some(m => m.text.toLocaleLowerCase('tr').includes(q)));
  const ul = $('#list'); ul.innerHTML = '';
  if (!found.length) ul.innerHTML = `<li class="empty">${q ? 'Eşleşen sohbet yok' : 'Henüz sohbet yok'}</li>`;
  found.forEach(c => {
    const li = document.createElement('li');
    if (c.id === currentId) li.className = 'on';
    li.innerHTML = `<span>${esc(c.title)}</span><button aria-label="Sil" title="Sil">✕</button>`;
    li.onclick = () => { currentId = c.id; render(); $('#side').classList.remove('open'); };
    li.querySelector('button').onclick = e => { e.stopPropagation(); deleteChat(c.id); };
    ul.appendChild(li);
  });
}
function renderMsgs() {
  const c = current(), box = $('#msgs');
  $('#title').textContent = c ? c.title : 'Cam AI';
  $('#delCur').style.visibility = c ? 'visible' : 'hidden';
  if (!c || !c.msgs.length) {
    box.innerHTML = '<div class="hello"><b>Ne öğrenmek istersin?</b>Bir şey sor. Gerekirse webde arayıp kaynaklarla özetlerim.</div>';
    return;
  }
  box.innerHTML = '';
  c.msgs.forEach(m => {
    const d = document.createElement('div');
    d.className = 'msg ' + m.role;
    d[m.html ? 'innerHTML' : 'textContent'] = m.html || m.text;
    box.appendChild(d);
  });
  box.scrollTop = box.scrollHeight;
}
function render() { renderList(); renderMsgs(); }

/* ---------- Web verisi: Google varsa Google, yoksa Vikipedi ---------- */
async function googleSearch(q) {
  const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(cfg.key)}&cx=${encodeURIComponent(cfg.cx)}&hl=tr&num=6&q=${encodeURIComponent(q)}`;
  const r = await fetch(url);
  const d = await r.json();
  if (!r.ok) throw new Error('Google: ' + (d.error?.message || r.status));
  return (d.items || []).map(i => ({ title: i.title, link: i.link, text: (i.snippet || '').replace(/\s+/g, ' ') }));
}
async function wikiSearch(q) {
  const url = 'https://tr.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=4&prop=extracts|info&exintro=1&explaintext=1&exchars=900&exlimit=max&inprop=url&format=json&origin=*&gsrsearch=' + encodeURIComponent(q);
  const r = await fetch(url);
  const d = await r.json();
  const pages = Object.values(d.query?.pages || {}).sort((a, b) => a.index - b.index);
  return pages.map(p => ({ title: p.title, link: p.fullurl, text: (p.extract || '').replace(/\s+/g, ' ') }));
}
async function webSearch(q) {
  if (cfg.key && cfg.cx) {
    try { return await googleSearch(q); } catch (e) { console.warn(e); }
  }
  return wikiSearch(q);
}

/* ---------- Yapay zeka (OpenAI uyumlu API) ---------- */
async function callAI(messages) {
  const keyed = !!cfg.aiKey && cfg.aiKey !== 'BURAYA_ANAHTAR';
  const url = keyed ? 'https://gen.pollinations.ai/v1/chat/completions' : 'https://text.pollinations.ai/openai';
  const headers = { 'Content-Type': 'application/json' };
  if (keyed) headers.Authorization = 'Bearer ' + cfg.aiKey;
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ model: 'openai', messages }) });
  const raw = await r.text();
  if (!r.ok) throw new Error(`Yapay zeka hizmeti hata verdi (${r.status}). ${raw.slice(0, 200)}`);
  let d; try { d = JSON.parse(raw); } catch { throw new Error('Geçersiz cevap geldi.'); }
  const out = d.choices?.[0]?.message?.content;
  if (!out) throw new Error('Boş cevap geldi.');
  return out;
}

async function ask(q) {
  const c = current() || (newChat(), current());
  if (c.title === 'Yeni sohbet') c.title = q.slice(0, 40);
  const history = c.msgs.filter(m => !m.pending).slice(-8).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
  c.msgs.push({ role: 'user', text: q });
  const bot = { role: 'ai', text: 'Düşünüyorum…', pending: true };
  c.msgs.push(bot); save(); render();

  let sources = [];
  try {
    if ($('#web').checked) {
      bot.text = 'Webde aranıyor…'; renderMsgs();
      try { sources = (await webSearch(q)).filter(s => s.text); } catch (e) { console.warn(e); }
    }
    const ctx = sources.map((s, i) => `[${i + 1}] ${s.title}: ${s.text}`).join('\n\n');
    const system = 'Sen Cam AI adlı yardımcı bir yapay zekasın. Kullanıcıyla Türkçe, açık ve kısa konuş. ' +
      (ctx ? 'Aşağıdaki web kaynaklarını kullanarak özetle. Kullandığın bilgiyi [1], [2] gibi numaralarla belirt. Kaynaklar yetersizse bunu söyle.\n\nKaynaklar:\n' + ctx : '');
    bot.text = 'Cevap yazılıyor…'; renderMsgs();
    const answer = await callAI([{ role: 'system', content: system }, ...history, { role: 'user', content: q }]);
    bot.text = answer;
    bot.html = esc(answer) + (sources.length
      ? '<h3>Kaynaklar</h3>' + sources.map((s, i) => `<div class="src">[${i + 1}] <a href="${esc(s.link)}" target="_blank" rel="noopener">${esc(s.title)}</a></div>`).join('')
      : '');
  } catch (e) {
    bot.text = 'Hata: ' + e.message;
    delete bot.html;
  }
  delete bot.pending;
  save(); render();
}

/* ---------- Olaylar ---------- */
$('#form').onsubmit = e => {
  e.preventDefault();
  const q = $('#input').value.trim();
  if (q) { $('#input').value = ''; ask(q); }
};
$('#newChat').onclick = newChat;
$('#delCur').onclick = () => currentId && deleteChat(currentId);
$('#search').oninput = renderList;
$('#menu').onclick = () => $('#side').classList.toggle('open');
$('#settingsBtn').onclick = () => {
  $('#aiKey').value = cfg.aiKey === 'BURAYA_ANAHTAR' ? '' : (cfg.aiKey || '');
  $('#key').value = cfg.key || ''; $('#cx').value = cfg.cx || '';
  $('#dlg').showModal();
};
$('#save').onclick = () => {
  cfg = { aiKey: $('#aiKey').value.trim(), key: $('#key').value.trim(), cx: $('#cx').value.trim() };
  store.set('camai.cfg', cfg);
};

currentId = chats[0]?.id ?? null;
render();
