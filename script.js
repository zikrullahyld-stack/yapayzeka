const $ = s => document.querySelector(s);
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
};
let chats = store.get('camai.chats', []);
let cfg = store.get('camai.cfg', { key: '', cx: '' });
let currentId = null;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const save = () => store.set('camai.chats', chats);
const esc = t => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const current = () => chats.find(c => c.id === currentId);

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
    box.innerHTML = '<div class="hello"><b>Ne öğrenmek istersin?</b>Bir konu yaz. Google sonuçlarını tarayıp kısa bir özet ve kaynakları sana getireyim.</div>';
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

// Google Programmable Search -> sonuçlar
async function googleSearch(q) {
  if (!cfg.key || !cfg.cx) throw new Error('Önce "Google ayarları" bölümüne API anahtarı ve cx bilgini gir.');
  const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(cfg.key)}&cx=${encodeURIComponent(cfg.cx)}&hl=tr&num=8&q=${encodeURIComponent(q)}`;
  const r = await fetch(url);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Google isteği başarısız oldu.');
  return (data.items || []).map(i => ({ title: i.title, link: i.link, snippet: (i.snippet || '').replace(/\s+/g, ' ') }));
}

// Basit çıkarımsal özet: sorgu kelimelerini en çok içeren cümleleri seç
function summarize(q, items, n = 4) {
  const words = q.toLocaleLowerCase('tr').split(/\s+/).filter(w => w.length > 2);
  const seen = new Set(), sents = [];
  items.forEach(it => it.snippet.split(/(?<=[.!?…])\s+/).forEach(s => {
    const k = s.toLocaleLowerCase('tr').replace(/[^a-zçğıöşü0-9 ]/g, '');
    if (s.length < 35 || seen.has(k)) return;
    seen.add(k);
    const score = words.reduce((a, w) => a + (k.includes(w) ? 1 : 0), 0) + Math.min(s.length, 200) / 400;
    sents.push({ s: s.trim(), score });
  }));
  return sents.sort((a, b) => b.score - a.score).slice(0, n).map(x => x.s);
}

async function ask(q) {
  const c = current() || (newChat(), current());
  if (c.title === 'Yeni sohbet') c.title = q.slice(0, 40);
  c.msgs.push({ role: 'user', text: q });
  const wait = { role: 'ai', text: 'Google\'da aranıyor…' };
  c.msgs.push(wait); save(); render();
  try {
    const items = await googleSearch(q);
    if (!items.length) { wait.text = 'Bu konuda sonuç bulamadım. Farklı kelimelerle dene.'; }
    else {
      const sum = summarize(q, items);
      wait.html = '<h3>Özet</h3>' + esc(sum.join(' ') || 'Özet çıkarılamadı, kaynaklara göz at.') +
        '<h3>Kaynaklar</h3>' + items.slice(0, 5).map(i =>
          `<div class="src"><a href="${esc(i.link)}" target="_blank" rel="noopener">${esc(i.title)}</a><small>${esc(i.snippet.slice(0, 110))}…</small></div>`).join('');
      wait.text = 'Özet: ' + sum.join(' ') + ' ' + items.map(i => i.title).join(' ');
    }
  } catch (e) { wait.text = 'Hata: ' + e.message; }
  save(); render();
}

$('#form').onsubmit = e => {
  e.preventDefault();
  const q = $('#input').value.trim();
  if (q) { $('#input').value = ''; ask(q); }
};
$('#newChat').onclick = newChat;
$('#delCur').onclick = () => currentId && deleteChat(currentId);
$('#search').oninput = renderList;
$('#menu').onclick = () => $('#side').classList.toggle('open');
$('#settingsBtn').onclick = () => { $('#key').value = cfg.key; $('#cx').value = cfg.cx; $('#dlg').showModal(); };
$('#save').onclick = () => { cfg = { key: $('#key').value.trim(), cx: $('#cx').value.trim() }; store.set('camai.cfg', cfg); };

currentId = chats[0]?.id ?? null;
render();
