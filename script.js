let chats = [];
try {
    chats = JSON.parse(localStorage.getItem('ai_chats_v7')) || [];
    if (!Array.isArray(chats)) chats = [];
} catch (e) {
    chats = [];
}

let currentChatId = null;

// Sayfa yüklendiğinde çalışacak fonksiyon
function init() {
    renderHistory();
    if (chats.length === 0) {
        startNewChat();
    } else {
        loadChat(chats[0].id);
    }
}

// Yeni Sohbet Başlatma
function startNewChat() {
    currentChatId = Date.now();
    const newChat = {
        id: currentChatId,
        title: 'Yeni sohbet',
        messages: [
            { sender: 'ai', text: 'Merhaba! Ben süper akıllı Yapay Zeka asistanınızım. Bana ineklerin, kedilerin veya herhangi bir canlının ayak/kulak sayısını sorabilir, matematik yaptırabilir, kod yazdırabilir ve resim üretebilirsiniz! 🤖✨', imageUrl: null }
        ]
    };
    chats.unshift(newChat);
    saveChats();
    renderHistory();
    renderMessages();
}

// Sohbet Silme Fonksiyonu
function deleteChat(id, event) {
    event.stopPropagation();
    chats = chats.filter(chat => chat.id !== id);
    saveChats();
    
    if (chats.length === 0) {
        startNewChat();
    } else {
        if (currentChatId === id) {
            currentChatId = chats[0].id;
        }
        renderHistory();
        renderMessages();
    }
}

// Sohbetleri Tarayıcıya Kaydetme
function saveChats() {
    localStorage.setItem('ai_chats_v7', JSON.stringify(chats));
}

// Geçmiş Sohbetleri Ekrana Listeleme
function renderHistory() {
    const historyContainer = document.getElementById('chatHistory');
    if (!historyContainer) return;
    historyContainer.innerHTML = '';
    
    chats.forEach(chat => {
        const div = document.createElement('div');
        div.className = `history-item ${chat.id === currentChatId ? 'active' : ''}`;
        div.onclick = () => loadChat(chat.id);

        div.innerHTML = `
            <span class="history-title-text">${chat.title || 'Sohbet'}</span>
            <i class="fa-solid fa-trash delete-btn" title="Sohbeti Sil" onclick="deleteChat(${chat.id}, event)"></i>
        `;

        historyContainer.appendChild(div);
    });
}

// Sohbete Tıklandığında Yükleme
function loadChat(id) {
    currentChatId = id;
    renderHistory();
    renderMessages();
}

// Mesajları Ekrana Yazdırma
function renderMessages() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    chatMessages.innerHTML = '';
    const currentChat = chats.find(c => c.id === currentChatId);
    if (!currentChat) return;

    currentChat.messages.forEach(msg => {
        const rowDiv = document.createElement('div');
        rowDiv.className = `message-row ${msg.sender}`;

        let rawText = msg.text;
        if (rawText && typeof rawText === 'object') {
            rawText = rawText.text || JSON.stringify(rawText);
        }
        let textContent = formatMessageText(rawText);

        if (msg.sender === 'user') {
            rowDiv.innerHTML = `<div class="user-bubble">${textContent}</div>`;
        } else {
            let imgHTML = (msg.imageUrl && typeof msg.imageUrl === 'string') ? `<br><img src="${msg.imageUrl}" class="ai-image" alt="Oluşturulan Görsel">` : '';
            rowDiv.innerHTML = `
                <div class="ai-bubble">
                    ${textContent}${imgHTML}
                </div>
            `;
        }
        chatMessages.appendChild(rowDiv);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Metin Biçimlendirme
function formatMessageText(text) {
    if (text === null || text === undefined) return '';
    let str = String(text);
    if (str.includes('```')) {
        return str.replace(/```([a-z]*)\n([\s\S]*?)```/g, '<pre style="background:#1e1e1e; padding:12px; border-radius:8px; margin-top:8px; overflow-x:auto; color:#dcdcdc; font-family:monospace;"><code>$2</code></pre>');
    }
    return str.replace(/\n/g, '<br>');
}

// Enter Tuşu ile Gönderme
function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// Mesaj Gönderme Fonksiyonu
function sendMessage() {
    const input = document.getElementById('userInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    const currentChat = chats.find(c => c.id === currentChatId);
    if (!currentChat) return;

    currentChat.messages.push({ sender: 'user', text: text, imageUrl: null });
    
    if (currentChat.messages.length === 2) {
        currentChat.title = text.length > 18 ? text.substring(0, 18) + '...' : text;
    }

    input.value = '';
    saveChats();
    renderHistory();
    renderMessages();

    // Yapay Zeka Yanıt Simülasyonu
    setTimeout(() => {
        let aiResult = generateAIResponse(text);
        currentChat.messages.push({ sender: 'ai', text: aiResult.text, imageUrl: aiResult.imageUrl });
        saveChats();
        renderMessages();
    }, 400);
}

// Süper Akıllı Yanıt Motoru (Hayvanlar, Matematik, Kod, Resim)
function generateAIResponse(query) {
    const lower = query.toLowerCase();

    // 1. Hayvanların Ayak ve Kulak Bilgileri (İnek, kedi, köpek vb.)
    if (lower.includes('ayak') || lower.includes('kulak') || lower.includes('kaç tane') || lower.includes('kaç')) {
        if (lower.includes('inek')) {
            return { text: "İneklerin **4 ayağı** ve **2 kulağı** vardır. 🐄", imageUrl: null };
        }
        if (lower.includes('kedi')) {
            return { text: "Kedilerin **4 ayağı** ve **2 kulağı** vardır. 🐱", imageUrl: null };
        }
        if (lower.includes('köpek')) {
            return { text: "Köpeklerin **4 ayağı** ve **2 kulağı** vardır. 🐶", imageUrl: null };
        }
        if (lower.includes('at')) {
            return { text: "Atların **4 ayağı** ve **2 kulağı** vardır. 🐴", imageUrl: null };
        }
        if (lower.includes('kuş')) {
            return { text: "Kuşların **2 ayağı** vardır. Kulakları ise tüylerinin altında delik şeklindedir (dış kulak kepçeleri yoktur). 🐦", imageUrl: null };
        }
        if (lower.includes('örümcek')) {
            return { text: "Örümceklerin **8 ayağı** vardır ve kulakları yoktur, sesleri tüyleriyle hissederler. 🕷️", imageUrl: null };
        }
        if (lower.includes('karınca')) {
            return { text: "Karıncaların **6 ayağı** vardır ve kulakları yoktur. 🐜", imageUrl: null };
        }
        if (lower.includes('tavuk')) {
            return { text: "Tavukların **2 ayağı** ve **2 kulağı** (tüylerin altında delik şeklinde) vardır. 🐔", imageUrl: null };
        }
        if (lower.includes('insan') || lower.includes('adam') || lower.includes('çocuk')) {
            return { text: "İnsanların **2 ayağı** (bacağı) ve **2 kulağı** vardır. 👤", imageUrl: null };
        }
    }

    // 2. Güvenlik Filtresi (Yasadışı / Zararlı İçerik)
    const illegalKeywords = ['hack', 'virüs', 'patlayıcı', 'bomba', 'silah yapımı', 'saldırı', 'çalma', 'uyuşturucu', 'küfür', 'şiddet'];
    for (let word of illegalKeywords) {
        if (lower.includes(word)) {
            return {
                text: "⚠️ **Güvenlik Uyarısı:** Ben etik kurallara bağlı bir yapay zeka asistanıyım. Yasadışı veya zararlı konularda yanıt veremem.",
                imageUrl: null
            };
        }
    }

    // 3. Matematik Hesaplama Motoru (9x9, 50/2 vb.)
    let cleanMath = lower.replace(/x/g, '*').replace(/×/g, '*').replace(/[:]/g, '/');
    if (/[\d]+\s*[\+\-\*\/\\]\s*[\d]+/.test(cleanMath)) {
        try {
            let mathExpr = cleanMath.replace(/[^0-9+\-*/().]/g, '');
            let result = Function('"use strict";return (' + mathExpr + ')')();
            if (!isNaN(result)) {
                return {
                    text: `İşlemin sonucu: **${result}** 🧮`,
                    imageUrl: null
                };
            }
        } catch (e) {}
    }

    // 4. Görsel / Resim Oluşturma
    if (lower.includes('resim yap') || lower.includes('görsel oluştur') || lower.includes('çiz') || lower.includes('resmini çiz')) {
        const prompt = encodeURIComponent(query.replace(/resim yap|görsel oluştur|çiz|resmini çiz/gi, '').trim() || 'futuristic art');
        return {
            text: `İstediğin görseli senin için oluşturdum:`,
            imageUrl: `[https://image.pollinations.ai/prompt/$](https://image.pollinations.ai/prompt/$){prompt}`
        };
    }

    // 5. Kod Yazma İstekleri
    if (lower.includes('kod') || lower.includes('html') || lower.includes('css') || lower.includes('javascript') || lower.includes('python')) {
        return {
            text: `İstediğin programlama diliyle ilgili örnek kod bloğu:\n\n\`\`\`javascript\n// Örnek Kod\nconsole.log("Proje ödevi başarıyla çalışıyor!");\n\`\`\``,
            imageUrl: null
        };
    }

    // 6. Selamlaşma ve Hal Hatır
    if (lower === 'merhaba' || lower === 'selam' || lower === 'sa' || lower === 'günaydın') {
        return {
            text: "Aleykümselam! 👋 Bugün size hangi konuda yardımcı olabilirim?",
            imageUrl: null
        };
    }
    if (lower.includes('nasılsın') || lower.includes('nasıl gidiyor')) {
        return {
            text: "Teşekkür ederim, harika çalışıyorum! Sen nasılsın?",
            imageUrl: null
        };
    }
    if (lower.includes('kimsin') || lower.includes('adın ne')) {
        return {
            text: "Ben HTML, CSS ve JavaScript ile geliştirilmiş akıllı bir Yapay Zeka proje asistanıyım.",
            imageUrl: null
        };
    }

    // 7. Akıllı Genel Cevap (Genel sorular için doğrudan bilgi verir)
    return {
        text: `**"${query}"** hakkında bilmeniz gerekenler: Bu konu, bilimsel, teknik ve günlük hayatta sıkça karşılaşılan önemli bir başlıktır. Detaylı olarak incelendiğinde mantıksal temellere dayanır. Başka merak ettiğiniz bir soru var mı?`,
        imageUrl: null
    };
}

// Başlat
init();
