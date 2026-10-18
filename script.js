const $ = s => document.querySelector(s);
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
};

const DEFAULTS = {
  aiKey: 'sk_eOyzlCZgbCODMrKDb8Vrtrcy7UDT8mmq',
  key: '',
  cx: ''
};

let chats = store.get('camai.chats', []);
let saved = store.get('camai.cfg', {});
let cfg = {
  aiKey: saved.aiKey || DEFAULTS.aiKey,
  key: saved.key || DEFAULTS.key,
  cx: saved.cx || DEFAULTS.cx
};
let currentId = null;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const save = () => store.set('camai.chats', chats);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const current = () => chats.find(c => c.id === currentId);
const hasKey = () => !!cfg.aiKey;
const fmt = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

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
    box.innerHTML = '<div class="hello"><b>Ne öğrenmek istersin?</b>Sohbet edebilir, Vikipedi\'den araştırabilir ya da "kedi resmi oluştur" diyerek görsel üretebilirim.</div>';
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

/* ---------- Vikipedi araştırması ---------- */
async function wikiSearch(q) {
  const url = 'https://tr.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=4' +
    '&prop=extracts|info&exintro=1&explaintext=1&exchars=1500&exlimit=max&inprop=url' +
    '&format=json&origin=*&gsrsearch=' + encodeURIComponent(q);
  const r = await fetch(url);
  if (!r.ok) throw new Error('Vikipedi isteği başarısız oldu (' + r.status + ').');
  const d = await r.json();
  const pages = Object.values(d.query?.pages || {}).sort((a, b) => a.index - b.index);
  return pages
    .map(p => ({ title: p.title, link: p.fullurl, text: (p.extract || '').replace(/\s+/g, ' ').trim() }))
    .filter(p => p.text.length > 40);
}

/* ---------- Yapay zeka (OpenAI uyumlu API) ---------- */
async function callAI(messages) {
  const url = hasKey() ? 'https://gen.pollinations.ai/v1/chat/completions' : 'https://text.pollinations.ai/openai';
  const headers = { 'Content-Type': 'application/json' };
  if (hasKey()) headers.Authorization = 'Bearer ' + cfg.aiKey;
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ model: 'openai', messages }) });
  const raw = await r.text();
  if (!r.ok) throw new Error(`Yapay zeka hizmeti hata verdi (${r.status}). ${raw.slice(0, 200)}`);
  let d; try { d = JSON.parse(raw); } catch { throw new Error('Geçersiz cevap geldi.'); }
  const out = d.choices?.[0]?.message?.content;
  if (!out) throw new Error('Boş cevap geldi.');
  return out;
}

/* ---------- Karar verici: sohbet mi, araştırma mı, görsel mi? ---------- */
const GREETING = /^(merhaba|selam|slm|hey|naber|nasılsın|nbr|günaydın|iyi akşamlar|iyi geceler|teşekkür|sağ ol|sağol|eyvallah|tamam|ok|peki|evet|hayır)\b/i;
const IMG_WORD = /(fotoğraf|foto\b|resim|görsel|logo|illüstrasyon|çizim)/i;
const IMG_ACT = /(oluştur|yap\b|yapar|üret|çiz|hazırla|istiyorum)/i;

function fallbackRoute(q) {
  if (q.startsWith('/resim') || (IMG_WORD.test(q) && IMG_ACT.test(q))) return { mode: 'image', query: '' };
  if (GREETING.test(q) && q.length < 40) return { mode: 'chat', query: '' };
  return { mode: 'search', query: q };
}

async function route(q, history) {
  if (q.startsWith('/resim')) return { mode: 'image', query: '' };
  if (GREETING.test(q) && q.length < 40) return { mode: 'chat', query: '' };
  try {
    const out = await callAI([
      { role: 'system', content:
        'Kullanıcının son mesajını sınıflandır. SADECE şu JSON biçiminde cevap ver: {"mode":"chat","query":""}\n' +
        'mode değerleri:\n' +
        '- "chat": selamlaşma, hal hatır, teşekkür, görüş isteme, matematik, kod yazma, yaratıcı yazı, önceki konuşmaya devam eden sorular, genel sohbet.\n' +
        '- "search": Vikipedi\'de bulunabilecek bilgi soruları: kişi, yer, tarih, bilim, hayvan, olay, kavram gibi gerçek dünya bilgisi.\n' +
        '- "image": kullanıcı bir görsel, fotoğraf, resim veya logo oluşturulmasını istiyor.\n' +
        'query: sadece "search" modunda, Vikipedi aramasına yazılacak konu adı (en fazla 4 kelime, soru ekleri olmadan). Örnek: "eşeklerin kaç ayağı var" -> "eşek". Diğer modlarda boş bırak.' },
      ...history.slice(-4),
      { role: 'user', content: q }
    ]);
    const m = out.match(/\{[\s\S]*\}/);
    const j = JSON.parse(m[0]);
    if (['chat', 'search', 'image'].includes(j.mode)) return { mode: j.mode, query: j.query || q };
  } catch (e) { console.warn(e); }
  return fallbackRoute(q);
}

/* ---------- Görsel üretimi ---------- */
window.imgFail = img => {
  const src = img.src;
  const show = t => img.replaceWith(document.createTextNode(t));
  fetch(src).then(async r => show(`Görsel oluşturulamadı (${r.status}). ${(await r.text()).slice(0, 150)}`))
    .catch(() => show('Görsel oluşturulamadı. Bağlantıyı veya bakiyeni kontrol et.'));
};

async function makeImage(q, bot) {
  let prompt = q.replace(/^\/resim\s*/i, '');
  try {
    prompt = await callAI([
      { role: 'system', content: 'Kullanıcının isteğinden, görsel üretim modeli için kısa ve ayrıntılı bir İngilizce prompt yaz. Sadece prompt metnini ver, başka hiçbir şey yazma.' },
      { role: 'user', content: prompt }
    ]);
  } catch (e) { console.warn(e); }
  prompt = prompt.replace(/["\n]/g, ' ').slice(0, 500).trim();
  const url = 'https://gen.pollinations.ai/image/' + encodeURIComponent(prompt) +
    '?width=1024&height=1024&seed=' + Math.floor(Math.random() * 1e6) +
    (hasKey() ? '&key=' + encodeURIComponent(cfg.aiKey) : '');
  bot.text = 'Görsel: ' + q;
  bot.html = 'İşte görselin:<img src="' + esc(url) + '" alt="' + esc(q) + '" ' +
    'onload="this.closest(\'#msgs\').scrollTop=1e9" onerror="imgFail(this)">';
}

/* ---------- Soru cevap ---------- */
const BASE_RULES =
  'Sen Cam AI adlı bir yapay zeka asistansın. Türkçe, doğal ve kısa cevap ver. ' +
  'Sorulmayan örnek, ek bilgi veya "istersen şunu da yapabilirim" gibi teklifler ekleme. ' +
  'Görsel oluşturamazsın, görsel ürettiğini veya üreteceğini asla söyleme.';

async function ask(q) {
  const c = current() || (newChat(), current());
  if (c.title === 'Yeni sohbet') c.title = q.slice(0, 40);
  const history = c.msgs.filter(m => !m.pending && !m.html?.includes('<img') && !m.text.startsWith('Hata:')).slice(-8)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
  c.msgs.push({ role: 'user', text: q });
  const bot = { role: 'ai', text: 'Düşünüyorum…', pending: true };
  c.msgs.push(bot); save(); render();

  try {
    const r = await route(q, history);
    if (r.mode === 'image') {
      bot.text = 'Görsel hazırlanıyor…'; renderMsgs();
      await makeImage(q, bot);
    } else {
      let sources = [];
      if (r.mode === 'search' && $('#web').checked) {
        bot.text = 'Vikipedi\'de aranıyor…'; renderMsgs();
        try { sources = await wikiSearch(r.query || q); } catch (e) { console.warn(e); }
      }
      const ctx = sources.map((s, i) => `[${i + 1}] ${s.title}: ${s.text}`).join('\n\n');
      const system = BASE_RULES + (ctx
        ? ' Aşağıda Vikipedi kaynakları var. Soruyla gerçekten ilgiliyse kullan ve kullandığın bilgiye [1], [2] gibi numara koy. İlgili değilse kaynakları tamamen yok say, numara yazma ve kendi bilginle cevap ver.\n\nVikipedi kaynakları:\n' + ctx
        : '');
      bot.text = 'Cevap yazılıyor…'; renderMsgs();
      const answer = await callAI([{ role: 'system', content: system }, ...history, { role: 'user', content: q }]);
      const used = [...new Set([...answer.matchAll(/\[(\d+)\]/g)].map(m => +m[1]))]
        .filter(n => n >= 1 && n <= sources.length).sort((a, b) => a - b);
      bot.text = answer;
      bot.html = fmt(answer) + (used.length
        ? '<h3>Kaynaklar (Vikipedi)</h3>' + used.map(n => `<div class="src">[${n}] <a href="${esc(sources[n - 1].link)}" target="_blank" rel="noopener">${esc(sources[n - 1].title)}</a></div>`).join('')
        : '');
    }
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
  $('#aiKey').value = cfg.aiKey || ''; $('#key').value = cfg.key || ''; $('#cx').value = cfg.cx || '';
  $('#dlg').showModal();
};
$('#save').onclick = () => {
  cfg = { aiKey: $('#aiKey').value.trim(), key: $('#key').value.trim(), cx: $('#cx').value.trim() };
  store.set('camai.cfg', cfg);
};

currentId = chats[0]?.id ?? null;
render();
