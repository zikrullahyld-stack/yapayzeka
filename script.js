let chats = [];
try {
    chats = JSON.parse(localStorage.getItem('ai_chats_v4')) || [];
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
            { sender: 'ai', text: 'Merhaba! Ben sana yardımcı olmak için tasarlanmış bir Yapay Zeka asistanıyım. Bana soru sorabilir, kod yazdırabilir veya resim yaptırabilirsin! 🤖✨', imageUrl: null }
        ]
    };
    chats.unshift(newChat);
    saveChats();
    renderHistory();
    renderMessages();
}

// Sohbet Silme Fonksiyonu
function deleteChat(id, event) {
    event.stopPropagation(); // Sohbet yükleme tetiklenmesini engeller
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
    localStorage.setItem('ai_chats_v4', JSON.stringify(chats));
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
    }, 500);
}

// Akıllı ve Güvenli Cevap Motoru
function generateAIResponse(query) {
    const lower = query.toLowerCase();

    // 1. Kötü / Yasadışı İçi̇erik Kontrolü (Güvenlik Filtresi)
    const illegalKeywords = ['hack', 'virüs', 'patlayıcı', 'bomba', 'silah yapımı', 'saldırı', 'çalma', 'uyuşturucu', 'küfür', 'şiddet', 'zarar ver'];
    for (let word of illegalKeywords) {
        if (lower.includes(word)) {
            return {
                text: "⚠️ **Güvenlik Uyarısı:** Ben etik kurallara bağlı bir yapay zeka asistanıyım. Yasadışı, zararlı veya güvenliği tehdit eden konularda yanıt veremem. Lütfen başka bir konuda soru sorun.",
                imageUrl: null
            };
        }
    }

    // 2. Resim / Görsel Oluşturma
    if (lower.includes('resim yap') || lower.includes('görsel oluştur') || lower.includes('çiz') || lower.includes('resmini çiz')) {
        const prompt = encodeURIComponent(query.replace(/resim yap|görsel oluştur|çiz|resmini çiz/gi, '').trim() || 'beautiful landscape');
        return {
            text: `İstediğin görseli senin için tasarladım:`,
            imageUrl: `[https://image.pollinations.ai/prompt/$](https://image.pollinations.ai/prompt/$){prompt}`
        };
    }

    // 3. Kod Yazma İstekleri
    if (lower.includes('kod') || lower.includes('html') || lower.includes('css') || lower.includes('javascript') || lower.includes('python')) {
        return {
            text: `İstediğin konuyla ilgili örnek kod bloğu aşağıdadır:\n\n\`\`\`javascript\n// Yapay Zeka Kod Örneği\nfunction selamla(isim) {\n    return "Merhaba " + isim + ", web sitemize hoş geldin!";\n}\n\nconsole.log(selamla("Kullanıcı"));\n\`\`\``,
            imageUrl: null
        };
    }

    // 4. Selamlaşma ve Tanışma
    if (lower.includes('merhaba') || lower.includes('selam') || lower.includes('sa') || lower.includes('günaydın')) {
        return {
            text: "Merhaba! 👋 Size nasıl yardımcı olabilirim? Herhangi bir soru sorabilir, kod isteyebilir veya resim çizdirebilirsiniz.",
            imageUrl: null
        };
    }

    // 5. Hal Hatır Sorma
    if (lower.includes('nasılsın') || lower.includes('nasıl gidiyor')) {
        return {
            text: "Ben bir yapay zeka olduğum için duygularım yok ama harika çalışıyorum! Siz nasılsınız?",
            imageUrl: null
        };
    }

    // 6. Kimsin / Sen Nesin?
    if (lower.includes('sen kimsin') || lower.includes('adın ne') || lower.includes('kim yaptı')) {
        return {
            text: "Ben HTML, CSS ve JavaScript teknolojileri kullanılarak geliştirilmiş akıllı bir Yapay Zeka asistanıyım.",
            imageUrl: null
        };
    }

    // 7. Bilim ve Genel Kültür
    if (lower.includes('nedir') || lower.includes('ne demek') || lower.includes('nasıl çalışır') || lower.includes('bilgi')) {
        return {
            text: `"${query}" konusu hakkında detaylı bilgi: Bu konu bilimsel ve teknik açıdan oldukça önemlidir. Sistemlerin düzenli çalışmasını sağlar ve modern teknolojide geniş bir kullanım alanına sahiptir.`,
            imageUrl: null
        };
    }

    // Genel Cevap Motoru
    return {
        text: `"${query}" hakkında harika bir soru! Bu konuda size yardımcı olabilirim. Daha detaylı açıklama yapmamı veya bununla ilgili bir kod/görsel üretmemi ister misiniz?`,
        imageUrl: null
    };
}

// Başlat
init();
