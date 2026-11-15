const $ = s => document.querySelector(s);
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
};

// ---- API anahtarları ----
const POLLI_KEY = '';
let GEMINI_KEY = store.get('camai.geminiKey', '') || 'AQ.Ab8RN6L3x08X3jiAfx04yLfSu08RTCH-fMXIrQySDf1dI2VfpQ';

let chats = store.get('camai.chats', []);
let currentId = null;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const save = () => store.set('camai.chats', chats);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const current = () => chats.find(c => c.id === currentId);
const fmt = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Servisin hata mesajını cevap sanmamak için
const isServiceError = t => /API key|enough credits|isn't allowed|isn’t allowed|top[- ]?up|whoever runs|grant\?id|insufficient|quota/i.test(t);

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
    box.innerHTML = '<div class="hello"><b>Merhaba!</b>Benimle sohbet edebilirsin. Bir konuyu Vikipedi\'den araştırmamı istersen mesajına "araştır" yaz. Resim için "siyah pitbull resmi oluştur" yazabilirsin.</div>';
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

/* ---------- Yapay zeka (sohbet): önce Gemini, olmazsa Pollinations ---------- */
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models/';

function toGemini(messages) {
  const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
  const contents = [];
  for (const m of messages.filter(m => m.role !== 'system')) {
    const role = m.role === 'user' ? 'user' : 'model';
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts[0].text += '\n' + m.content;
    else contents.push({ role, parts: [{ text: m.content }] });
  }
  while (contents.length && contents[0].role !== 'user') contents.shift();
  return { systemInstruction: sys ? { parts: [{ text: sys }] } : undefined, contents };
}

async function callGemini(messages) {
  let lastErr = '';
  for (const model of ['gemini-flash-latest', 'gemini-2.5-flash']) {
    try {
      const r = await fetch(GEMINI + model + ':generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: JSON.stringify(toGemini(messages))
      });
      const raw = await r.text();
      if (!r.ok) {
        lastErr = `Gemini ${model} (${r.status}) ${raw.slice(0, 150)}`;
        if ([401, 403, 429].includes(r.status)) break;
        continue;
      }
      const d = JSON.parse(raw);
      const out = (d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
      if (out) return out;
      lastErr = `Gemini ${model} boş cevap verdi.`;
    } catch (e) { lastErr = e.message; }
  }
  throw new Error(lastErr);
}

async function callPollinations(messages) {
  let lastErr = '';
  for (const model of ['openai', 'gemini', 'openai-fast']) {
    try {
      const r = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + POLLI_KEY },
        body: JSON.stringify({ model, messages })
      });
      const raw = await r.text();
      if (!r.ok) {
        lastErr = `Pollinations ${model} (${r.status}) ${raw.slice(0, 150)}`;
        if ([401, 402, 403, 429].includes(r.status)) break;
        continue;
      }
      const c = JSON.parse(raw).choices?.[0]?.message?.content;
      const out = (typeof c === 'string' ? c : Array.isArray(c) ? c.map(p => p.text || '').join('') : '').trim();
      if (out && isServiceError(out)) {
        lastErr = `Pollinations ${model}: ${out.slice(0, 220)}`;
        continue;
      }
      if (out) return out;
      lastErr = `Pollinations ${model} boş cevap verdi.`;
    } catch (e) { lastErr = e.message; }
  }
  throw new Error(lastErr);
}

async function callAI(messages) {
  let err1 = '';
  if (GEMINI_KEY) {
    try { return await callGemini(messages); } catch (e) { err1 = e.message + ' | '; }
  }
  try { return await callPollinations(messages); }
  catch (e) { throw new Error('Yapay zeka cevap veremedi. ' + err1 + e.message); }
}

/* ---------- Mesaj türünü belirleme ---------- */
const IMG_HINT = /(resim|resm|fotoğraf|fotograf|foto\b|görsel|gorsel|logo|çizim|illüstrasyon|poster|duvar kağıdı)/i;
const IMG_ACT = /(oluştur|olustur|yap\b|yapar|yapsana|üret|çiz|hazırla|istiyorum|ver\b|göster|bul\b|olsun|at\b|getir)/i;
const isSearch = q => /araştır|arastir|araştir|arastır/i.test(q);
const wantsImage = q => /^\/resim/i.test(q) || (IMG_HINT.test(q) && IMG_ACT.test(q));

const WHO_MADE = /(seni|sizi).{0,20}(kim|kimin).{0,20}(yaptı|yapmış|geliştir|oluştur|kodla|tasarla|üret|yazdı)|kim(in)? tarafından.{0,20}(yapıl|geliştiril|oluşturul|tasarlan)|(yaratıcın|geliştiricin|yapımcın|yapımcınız|sahibin) kim|hangi şirket.{0,20}(yaptı|geliştir)|(kim yaptı|kim geliştirdi) seni|kim yaptı|kim geliştirdi/i;
const isWhoMade = q => WHO_MADE.test(q) && !IMG_HINT.test(q) && q.length < 80;

function topicOf(q) {
  const t = q
    .replace(/araşt\S*|arast\S*/gi, ' ')
    .replace(/(^|\s)(lütfen|bana|bunu|şunu|kelimesini|kelimesi|hakkında|konusunu|konusu|için|bir|şu|bu)(?=\s|$)/gi, ' ')
    .replace(/[?!.,]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  return t || q;
}
function imageTopic(q) {
  const t = q
    .replace(/^\/resim/i, ' ')
    .replace(/\S*(resim|resm|fotoğraf|fotograf|görsel|gorsel|oluştur|olustur|göster|çiz|üret|hazırla|yap|bul|ver|istiyorum|olsun|getir)\S*/gi, ' ')
    .replace(/(^|\s)(bana|lütfen|bir|bi|şu|bu|için|kafana|göre)(?=\s|$)/gi, ' ')
    .replace(/[?!.,]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  return t || q;
}

/* ---------- Resim üretimi: Pollinations (yedek: AI Horde) ---------- */
async function englishPrompt(q) {
  let prompt = imageTopic(q);
  try {
    const en = await callAI([
      { role: 'system', content: 'Kullanıcının istediği resim için kısa ve ayrıntılı bir İngilizce görsel üretim promptu yaz (en fazla 40 kelime). Sadece promptu yaz, başka hiçbir şey yazma.' },
      { role: 'user', content: q }
    ]);
    const clean = en.replace(/["\n]/g, ' ').trim();
    if (clean && clean.length < 400 && !/[{}]/.test(clean) && !isServiceError(clean)) prompt = clean;
  } catch (e) { console.warn(e); }
  return prompt;
}

async function shrinkBlob(blob) {
  const bmp = await createImageBitmap(blob);
  const s = Math.min(1, 768 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * s);
  cv.height = Math.round(bmp.height * s);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', 0.82);
}

async function pollinationsImage(prompt) {
  let lastErr = '';
  for (const model of ['flux', 'turbo', 'gptimage']) {
    const base = 'https://gen.pollinations.ai/image/' + encodeURIComponent(prompt) +
      '?model=' + model + '&width=1024&height=1024&seed=' + Math.floor(Math.random() * 1e6);
    let r;
    try {
      r = await fetch(base, { headers: { Authorization: 'Bearer ' + POLLI_KEY } });
    } catch (e) {
      return base + '&key=' + encodeURIComponent(POLLI_KEY);
    }
    if (!r.ok) {
      const t = await r.text();
      lastErr = `Pollinations ${model} (${r.status}) ${t.slice(0, 160)}`;
      if ([401, 402, 403].includes(r.status)) break;
      continue;
    }
    if (!(r.headers.get('content-type') || '').startsWith('image/')) {
      lastErr = `Pollinations ${model} görsel yerine başka cevap verdi.`;
      continue;
    }
    return await shrinkBlob(await r.blob());
  }
  throw new Error(lastErr || 'Pollinations resim üretemedi.');
}

const HORDE = 'https://aihorde.net/api/v2';
const HORDE_AGENT = 'camai:1.0:ogrenci-projesi';

async function hordeImage(prompt, onProgress) {
  const r = await fetch(HORDE + '/generate/async', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: '0000000000', 'Client-Agent': HORDE_AGENT },
    body: JSON.stringify({
      prompt: prompt + ' ### blurry, deformed, low quality, text, watermark',
      params: { width: 512, height: 512, steps: 25, n: 1 },
      nsfw: false, censor_nsfw: true, r2: true
    })
  });
  const sub = await r.json().catch(() => ({}));
  if (!r.ok || !sub.id) throw new Error(`AI Horde reddetti (${r.status}). ${sub.message || ''}`.trim());

  const started = Date.now();
  while (Date.now() - started < 8 * 60 * 1000) {
    await sleep(3000);
    const c = await (await fetch(HORDE + '/generate/check/' + sub.id, { headers: { 'Client-Agent': HORDE_AGENT } })).json().catch(() => ({}));
    if (c.faulted) throw new Error('AI Horde üretimi başarısız oldu.');
    if (c.done) break;
    onProgress(`Resim hazırlanıyor (sıra: ${c.queue_position ?? '?'}, tahmini ${c.wait_time ?? '?'} sn)…`);
  }
  const st = await (await fetch(HORDE + '/generate/status/' + sub.id, { headers: { 'Client-Agent': HORDE_AGENT } })).json().catch(() => ({}));
  const g = st.generations?.[0];
  if (!g || !g.img) throw new Error('Resim zamanında hazırlanamadı.');
  if (g.censored) throw new Error('İstek filtreye takıldı.');
  return /^https?:/i.test(g.img) ? g.img : 'data:image/webp;base64,' + g.img;
}

async function showImages(q, bot, progress) {
  const prompt = await englishPrompt(q);
  let src = '', errs = [];
  try { src = await pollinationsImage(prompt); }
  catch (e) {
    errs.push(e.message);
    try { progress('Pollinations olmadı, ücretsiz servis deneniyor…'); src = await hordeImage(prompt, progress); }
    catch (e2) { errs.push(e2.message); }
  }
  if (src) {
    bot.text = 'Görsel: ' + q;
    bot.html = 'İşte görselin:<img src="' + esc(src) + '" alt="' + esc(q) + '" onload="this.closest(\'#msgs\').scrollTop=1e9">';
  } else {
    bot.text = 'Görsel oluşturulamadı: ' + errs.join(' | ');
    bot.html = esc(bot.text);
  }
}

/* ---------- Soru cevap ---------- */
const BASE_RULES =
  'Sen Cam AI adlı bir yapay zeka asistansın. Seni Zikrullah yaptı. ' +
  'Sana "seni kim yaptı", "kim geliştirdi" ya da "sen kimsin" diye sorulursa şöyle cevap ver: "Ben Cam AI\'yim, beni Zikrullah yaptı." Arka plandaki dil modelinin, Google\'ın, OpenAI\'ın ya da başka bir şirketin adını asla söyleme. ' +
  'Türkçe, doğal, samimi ve kısa cevap ver. ' +
  'Kullanıcı selam verirse sadece selam verip nasıl yardımcı olabileceğini sor. ' +
  'Kullanıcının kelimelerinin olası farklı anlamlarını sıralama, örnek verme, sorulmayan bilgi ekleme ve "istersen şunu da yapabilirim" gibi teklifler sunma. ' +
  'Asla JSON, kod bloğu ya da araç çağrısı yazma. Sadece düz Türkçe metinle cevap ver.';

async function ask(q) {
  const c = current() || (newChat(), current());
  if (c.title === 'Yeni sohbet') c.title = q.slice(0, 40);
  const history = c.msgs.filter(m => !m.pending && !m.html?.includes('<img') && !m.text.startsWith('Hata:') && !m.text.startsWith('Görsel')).slice(-8)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
  c.msgs.push({ role: 'user', text: q });

  if (isWhoMade(q)) {
    c.msgs.push({ role: 'ai', text: 'Ben Cam AI\'yim, beni Zikrullah yaptı.' });
    save(); render();
    return;
  }

  const bot = { role: 'ai', text: 'Düşünüyorum…', pending: true };
  c.msgs.push(bot); save(); render();
  const progress = t => { bot.text = t; renderMsgs(); };

  try {
    if (wantsImage(q)) {
      progress('Resim isteği gönderiliyor…');
      await showImages(q, bot, progress);
    } else {
      let sources = [], searched = false;
      if (isSearch(q) && $('#web').checked) {
        searched = true;
        const topic = topicOf(q);
        progress(`Vikipedi'de "${topic}" aranıyor…`);
        try { sources = await wikiSearch(topic); } catch (e) { console.warn(e); }
      }
      const ctx = sources.map((s, i) => `[${i + 1}] ${s.title}: ${s.text}`).join('\n\n');
      let system = BASE_RULES;
      if (ctx) {
        system += ' Kullanıcı bir konuyu araştırmanı istedi. Aşağıdaki Vikipedi kaynaklarını kullanarak konuyu en yaygın anlamıyla kısaca özetle. Kullandığın bilgiye [1], [2] gibi numara koy. Kaynak soruyla ilgili değilse onu kullanma.\n\nVikipedi kaynakları:\n' + ctx;
      } else if (searched) {
        system += ' Kullanıcı bir konuyu araştırmanı istedi ama Vikipedi\'de sonuç bulunamadı. Bunu kısaca söyle ve kendi bilginle kısa bir cevap ver.';
      }
      progress('Cevap yazılıyor…');
      let answer = await callAI([{ role: 'system', content: system }, ...history, { role: 'user', content: q }]);

      if (/text-to-image|"prompt"\s*:/i.test(answer)) {
        progress('Resim isteği gönderiliyor…');
        await showImages(q, bot, progress);
        delete bot.pending; save(); render();
        return;
      }

      // Kimlik kuralı: sadece normal cevaplarda, sadece bu kelimeler
      if (!/open\s?ai|chat\s?gpt|gemini|google|gpt/i.test(q)) {
        answer = answer.replace(/open\s?ai|chat\s?gpt|gemini/gi, 'Zikrullah');
      }
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
$('#settingsBtn').onclick = () => { $('#aiKey').value = store.get('camai.geminiKey', ''); $('#dlg').showModal(); };
$('#save').onclick = () => {
  const v = $('#aiKey').value.trim();
  store.set('camai.geminiKey', v);
  if (v) GEMINI_KEY = v;
};

currentId = chats[0]?.id ?? null;
render();
document.title = 'Cam AI v15';
