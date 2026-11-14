const $ = s => document.querySelector(s);
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
};

const GEMINI_KEY = 'AQ.Ab8RN6KJ-SsdwBgm-6vaa_rvowi9RWsxLKOHOIHyGzxIu9eyNg';

let chats = store.get('camai.chats', []);
let currentId = null;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const save = () => store.set('camai.chats', chats);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const current = () => chats.find(c => c.id === currentId);
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
    box.innerHTML = '<div class="hello"><b>Merhaba!</b>Benimle sohbet edebilirsin. Bir konuyu Vikipedi\'den araştırmamı istersen mesajına "araştır" yaz. Görsel için "siyah pitbull resmi oluştur" yazabilirsin.</div>';
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

/* ---------- Yapay zeka: Gemini ---------- */
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models/';
const geminiHeaders = () => ({ 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY });

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

async function callAI(messages) {
  let lastErr = '';
  for (const model of ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.1-flash']) {
    try {
      const r = await fetch(GEMINI + model + ':generateContent', {
        method: 'POST', headers: geminiHeaders(), body: JSON.stringify(toGemini(messages))
      });
      const raw = await r.text();
      if (!r.ok) {
        lastErr = `${model} (${r.status}) ${raw.slice(0, 200)}`;
        if ([401, 403, 429].includes(r.status)) break;
        continue;
      }
      const d = JSON.parse(raw);
      const out = (d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
      if (out) return out;
      lastErr = `${model} boş cevap verdi (${d.candidates?.[0]?.finishReason || d.promptFeedback?.blockReason || 'sebep belirtilmedi'}).`;
    } catch (e) { lastErr = e.message; }
  }
  throw new Error('Yapay zeka cevap veremedi. ' + lastErr);
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

/* ---------- Görsel üretimi (Gemini) ---------- */
async function shrink(blob) {
  const bmp = await createImageBitmap(blob);
  const s = Math.min(1, 768 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * s);
  cv.height = Math.round(bmp.height * s);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', 0.82);
}

async function geminiImage(q) {
  const prompt = 'Create an image: ' + imageTopic(q);
  let lastErr = '';
  for (const model of ['gemini-3.1-flash-image', 'gemini-2.5-flash-image', 'gemini-3.1-flash-lite-image']) {
    try {
      const r = await fetch(GEMINI + model + ':generateContent', {
        method: 'POST', headers: geminiHeaders(),
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
        })
      });
      const raw = await r.text();
      if (!r.ok) { lastErr = `${model} (${r.status}) ${raw.slice(0, 200)}`; continue; }
      const d = JSON.parse(raw);
      const part = (d.candidates?.[0]?.content?.parts || []).find(p => p.inlineData || p.inline_data);
      const inl = part && (part.inlineData || part.inline_data);
      if (!inl) { lastErr = `${model} görsel döndürmedi.`; continue; }
      const mime = inl.mimeType || inl.mime_type || 'image/png';
      const blob = await (await fetch(`data:${mime};base64,${inl.data}`)).blob();
      return await shrink(blob);
    } catch (e) { lastErr = e.message; }
  }
  throw new Error(lastErr || 'Görsel üretilemedi.');
}

async function showImages(q, bot) {
  try {
    const src = await geminiImage(q);
    bot.text = 'Görsel: ' + q;
    bot.html = 'İşte görselin:<img src="' + esc(src) + '" alt="' + esc(q) + '" ' +
      'onload="this.closest(\'#msgs\').scrollTop=1e9">';
  } catch (e) {
    const gLink = 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(imageTopic(q));
    bot.text = 'Görsel oluşturulamadı: ' + e.message;
    bot.html = esc(bot.text) + '<br><a href="' + esc(gLink) + '" target="_blank" rel="noopener">Google Görseller\'de aç</a>';
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

  try {
    if (wantsImage(q)) {
      bot.text = 'Görsel oluşturuluyor, 10-20 saniye sürebilir…'; renderMsgs();
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

      if (/text-to-image|"prompt"\s*:/i.test(answer)) {
        bot.text = 'Görsel oluşturuluyor…'; renderMsgs();
        await showImages(q, bot);
        delete bot.pending; save(); render();
        return;
      }

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
$('#settingsBtn').onclick = () => $('#dlg').showModal();

currentId = chats[0]?.id ?? null;
render();
document.title = 'Cam AI v10';
