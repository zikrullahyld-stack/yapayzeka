const $ = s => document.querySelector(s);
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
};

const DEFAULTS = {
  aiKey: 'sk_eOyzlCZgbCODMrKDb8Vrtrcy7UDT8mmq',
  pixabayKey: '58156341-813AE128f4626ff9b23e2d30e',
  key: '',   // Google API anahtarı (isteğe bağlı, görsel aramayı Google'a da açar)
  cx: ''     // Google arama motoru kimliği (isteğe bağlı)
};

let chats = store.get('camai.chats', []);
let saved = store.get('camai.cfg', {});
let cfg = {
  aiKey: saved.aiKey || DEFAULTS.aiKey,
  pixabayKey: DEFAULTS.pixabayKey,
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
    box.innerHTML = '<div class="hello"><b>Merhaba!</b>Benimle sohbet edebilirsin. Bir konuyu Vikipedi\'den araştırmamı istersen mesajına "araştır" yaz. Görsel için "siyah pitbull resmi göster" yazabilirsin.</div>';
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

/* ---------- Yapay zeka (boş cevap gelirse başka model dener) ---------- */
async function callAI(messages) {
  const url = hasKey() ? 'https://gen.pollinations.ai/v1/chat/completions' : 'https://text.pollinations.ai/openai';
  const headers = { 'Content-Type': 'application/json' };
  if (hasKey()) headers.Authorization = 'Bearer ' + cfg.aiKey;

  let lastErr = '';
  for (const model of ['openai', 'gemini', 'openai-fast']) {
    try {
      const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ model, messages }) });
      const raw = await r.text();
      if (!r.ok) {
        lastErr = `(${r.status}) ${raw.slice(0, 150)}`;
        if ([401, 402, 403, 429].includes(r.status)) break;
        continue;
      }
      let d;
      try { d = JSON.parse(raw); } catch { lastErr = 'Geçersiz cevap geldi.'; continue; }
      const choice = d.choices?.[0];
      const c = choice?.message?.content;
      let out = typeof c === 'string' ? c : Array.isArray(c) ? c.map(p => p.text || '').join('') : '';
      out = (out || '').trim();
      if (out) return out;
      lastErr = `${model} boş cevap verdi (${choice?.finish_reason || 'sebep belirtilmedi'}).`;
    } catch (e) {
      lastErr = e.message;
    }
  }
  throw new Error('Yapay zeka cevap veremedi. ' + lastErr);
}

/* ---------- Mesaj türünü belirleme ---------- */
const IMG_HINT = /(resim|resm|fotoğraf|fotograf|foto\b|görsel|gorsel|logo|çizim|illüstrasyon|poster|duvar kağıdı)/i;
const IMG_ACT = /(oluştur|olustur|yap\b|yapar|yapsana|üret|çiz|hazırla|istiyorum|ver\b|göster|bul\b|olsun|at\b|getir)/i;
const isSearch = q => /araştır|arastir|araştir|arastır/i.test(q);
const wantsImage = q => /^\/resim/i.test(q) || (IMG_HINT.test(q) && IMG_ACT.test(q));

// "Seni kim yaptı" gibi sorular doğrudan cevaplanır
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

/* ---------- Görsel arama: Pixabay -> Google (anahtar girildiyse) -> Vikimedia ---------- */
function imageTopic(q) {
  const t = q
    .replace(/^\/resim/i, ' ')
    .replace(/\S*(resim|resm|fotoğraf|fotograf|görsel|gorsel|oluştur|olustur|göster|çiz|üret|hazırla|yap|bul|ver|istiyorum|olsun|getir)\S*/gi, ' ')
    .replace(/(^|\s)(bana|lütfen|bir|bi|şu|bu|için|kafana|göre)(?=\s|$)/gi, ' ')
    .replace(/[?!.,]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  return t || q;
}

async function pixabaySearch(query) {
  const url = 'https://pixabay.com/api/?key=' + encodeURIComponent(cfg.pixabayKey) +
    '&q=' + encodeURIComponent(query.slice(0, 100)) +
    '&image_type=all&safesearch=true&per_page=6&order=popular';
  const r = await fetch(url);
  if (!r.ok) throw new Error('Pixabay ' + r.status);
  const d = await r.json();
  return (d.hits || []).slice(0, 4).map(h => ({ img: h.webformatURL, link: h.pageURL, alt: h.tags || query }));
}

async function googleImageSearch(query) {
  if (!cfg.key || !cfg.cx) return [];
  const url = 'https://www.googleapis.com/customsearch/v1?key=' + encodeURIComponent(cfg.key) +
    '&cx=' + encodeURIComponent(cfg.cx) + '&searchType=image&num=4&safe=active&q=' + encodeURIComponent(query);
  const r = await fetch(url);
  if (!r.ok) throw new Error('Google ' + r.status);
  const d = await r.json();
  return (d.items || []).slice(0, 4).map(i => ({
    img: i.image?.thumbnailLink || i.link,
    link: i.image?.contextLink || i.link,
    alt: i.title || query
  }));
}

async function commonsSearch(query) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6' +
    '&gsrlimit=8&prop=imageinfo&iiprop=url&iiurlwidth=640&format=json&origin=*&gsrsearch=' + encodeURIComponent(query);
  const r = await fetch(url);
  if (!r.ok) throw new Error('Vikimedia ' + r.status);
  const d = await r.json();
  return Object.values(d.query?.pages || {})
    .map(p => p.imageinfo?.[0])
    .filter(i => i && /\.(jpe?g|png)$/i.test(i.url || ''))
    .slice(0, 4)
    .map(i => ({ img: i.thumburl || i.url, link: i.descriptionurl, alt: query }));
}

async function searchImages(q) {
  let query = imageTopic(q);
  try {
    const en = await callAI([
      { role: 'system', content: 'Kullanıcının istediği görseli stok fotoğraf sitesinde aramak için 1-3 kelimelik İngilizce bir arama ifadesi yaz. Sadece ifadeyi yaz, başka hiçbir şey yazma.' },
      { role: 'user', content: q }
    ]);
    const clean = en.replace(/["\n.]/g, ' ').trim();
    if (clean && clean.length <= 60 && !/[{}]/.test(clean)) query = clean;
  } catch (e) { console.warn(e); }

  const providers = [
    ['Pixabay', pixabaySearch],
    ['Google', googleImageSearch],
    ['Vikimedia Commons', commonsSearch]
  ];
  for (const [name, fn] of providers) {
    try {
      const hits = await fn(query);
      if (hits.length) return { query, hits, source: name };
    } catch (e) { console.warn(name, e); }
  }
  return { query, hits: [], source: '' };
}

async function showImages(q, bot) {
  const { query, hits, source } = await searchImages(q);
  const gLink = 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(query);
  if (!hits.length) {
    bot.text = `"${query}" için uygun görsel bulamadım.`;
    bot.html = `"${esc(query)}" için uygun görsel bulamadım. <a href="${esc(gLink)}" target="_blank" rel="noopener">Google Görseller'de aç</a>`;
    return;
  }
  bot.text = `Görsel arama: ${query}`;
  bot.html = 'İşte "' + esc(query) + '" için bulduğum görseller:' +
    '<div class="gallery">' +
    hits.map(h => `<a href="${esc(h.link)}" target="_blank" rel="noopener"><img src="${esc(h.img)}" alt="${esc(h.alt)}" loading="lazy"></a>`).join('') +
    '</div><div class="credit">Kaynak: ' + esc(source) + ' · <a href="' + esc(gLink) + '" target="_blank" rel="noopener">Google Görseller\'de daha fazla</a></div>';
}

/* ---------- Soru cevap ---------- */
const BASE_RULES =
  'Sen Cam AI adlı bir yapay zeka asistansın. Seni Zikrullah yaptı. ' +
  'Sana "seni kim yaptı", "kim geliştirdi" ya da "sen kimsin" diye sorulursa şöyle cevap ver: "Ben Cam AI\'yim, beni Zikrullah yaptı." Arka plandaki dil modelinin ya da şirketin adını asla söyleme. ' +
  'Türkçe, doğal, samimi ve kısa cevap ver. ' +
  'Kullanıcı selam verirse sadece selam verip nasıl yardımcı olabileceğini sor. ' +
  'Kullanıcının kelimelerinin olası farklı anlamlarını sıralama, örnek verme, sorulmayan bilgi ekleme ve "istersen şunu da yapabilirim" gibi teklifler sunma. ' +
  'Asla JSON, kod bloğu ya da araç çağrısı yazma. Sadece düz Türkçe metinle cevap ver.';

async function ask(q) {
  const c = current() || (newChat(), current());
  if (c.title === 'Yeni sohbet') c.title = q.slice(0, 40);
  const history = c.msgs.filter(m => !m.pending && !m.html?.includes('<img') && !m.text.startsWith('Hata:')).slice(-8)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
  c.msgs.push({ role: 'user', text: q });

  if (isWhoMade(q)) {
    c.msgs.push({ role: 'ai', text: 'Ben Cam AI\'yim, beni Zikrullah yaptı.' });
    save(); render();
    return;
  }

  const bot = { role: 'ai', text: 'Düşünüyorum…', pending: true };
  c.msgs.push(bot); save(); render();

  try {
    if (wantsImage(q)) {
      bot.text = 'Görseller aranıyor…'; renderMsgs();
      await showImages(q, bot);
    } else {
      let sources = [], searched = false;
      if (isSearch(q) && $('#web').checked) {
        searched = true;
        const topic = topicOf(q);
        bot.text = `Vikipedi'de "${topic}" aranıyor…`; renderMsgs();
        try { sources = await wikiSearch(topic); } catch (e) { console.warn(e); }
      }
      const ctx = sources.map((s, i) => `[${i + 1}] ${s.title}: ${s.text}`).join('\n\n');
      let system = BASE_RULES;
      if (ctx) {
        system += ' Kullanıcı bir konuyu araştırmanı istedi. Aşağıdaki Vikipedi kaynaklarını kullanarak konuyu en yaygın anlamıyla kısaca özetle. Kullandığın bilgiye [1], [2] gibi numara koy. Kaynak soruyla ilgili değilse onu kullanma.\n\nVikipedi kaynakları:\n' + ctx;
      } else if (searched) {
        system += ' Kullanıcı bir konuyu araştırmanı istedi ama Vikipedi\'de sonuç bulunamadı. Bunu kısaca söyle ve kendi bilginle kısa bir cevap ver.';
      }
      bot.text = 'Cevap yazılıyor…'; renderMsgs();
      let answer = await callAI([{ role: 'system', content: system }, ...history, { role: 'user', content: q }]);

      // Yapay zeka yine de sahte resim komutu yazarsa, görsel aramaya çevir
      if (/text-to-image|"prompt"\s*:/i.test(answer)) {
        bot.text = 'Görseller aranıyor…'; renderMsgs();
        await showImages(q, bot);
        delete bot.pending; save(); render();
        return;
      }

      if (!/open\s?ai|chat\s?gpt|gpt/i.test(q)) {
        answer = answer.replace(/open\s?ai|chat\s?gpt/gi, 'Zikrullah');
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
$('#settingsBtn').onclick = () => {
  $('#aiKey').value = cfg.aiKey || ''; $('#key').value = cfg.key || ''; $('#cx').value = cfg.cx || '';
  $('#dlg').showModal();
};
$('#save').onclick = () => {
  cfg = { ...cfg, aiKey: $('#aiKey').value.trim(), key: $('#key').value.trim(), cx: $('#cx').value.trim() };
  store.set('camai.cfg', { aiKey: cfg.aiKey, key: cfg.key, cx: cfg.cx });
};

currentId = chats[0]?.id ?? null;
render();
document.title = 'Cam AI v7';
