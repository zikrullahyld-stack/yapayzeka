let chats = [];
try {
    chats = JSON.parse(localStorage.getItem('ai_chats_v11')) || [];
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
            { sender: 'ai', text: 'Merhaba! Doğrudan internete bağlı gerçek bir Yapay Zeka asistanıyım. İnsanın kilosundan uzay bilimine kadar dilediğin her şeyi sorabilirsin! 🤖✨', imageUrl: null }
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
    localStorage.setItem('ai_chats_v11', JSON.stringify(chats));
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
async function sendMessage() {
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

    // İnternetten Canlı Yanıt Al
    try {
        let aiResult = await fetchLiveAIResponse(text);
        currentChat.messages.push({ sender: 'ai', text: aiResult.text, imageUrl: aiResult.imageUrl });
        saveChats();
        renderMessages();
    } catch (error) {
        currentChat.messages.push({ sender: 'ai', text: "Bağlantı hatası oluştu, lütfen tekrar deneyin.", imageUrl: null });
        saveChats();
        renderMessages();
    }
}

// Gerçek İnternet API Bağlantısı (Google / Edge / Yandex Gibi Canlı Veri Çeker)
async function fetchLiveAIResponse(query) {
    const lower = query.toLowerCase();

    // 1. Sıkı Güvenlik Filtresi (Yasadışı / Zararlı / Kötü İçerikler)
    const illegalKeywords = ['hack', 'virüs', 'patlayıcı', 'bomba', 'silah yapımı', 'saldırı', 'çalma', 'uyuşturucu', 'küfür', 'şiddet', 'intihar'];
    for (let word of illegalKeywords) {
        if (lower.includes(word)) {
            return {
                text: "⚠️ **Güvenlik Uyarısı:** Ben etik kurallara bağlı bir yapay zeka asistanıyım. Yasadışı, zararlı veya etik dışı konularda yanıt veremem.",
                imageUrl: null
            };
        }
    }

    // 2. Görsel / Resim İstekleri (Pollinations Image API)
    if (lower.includes('resim yap') || lower.includes('görsel oluştur') || lower.includes('çiz') || lower.includes('resmini çiz')) {
        const prompt = encodeURIComponent(query.replace(/resim yap|görsel oluştur|çiz|resmini çiz/gi, '').trim() || 'futuristic art');
        return {
            text: `İstediğin görseli internetten senin için oluşturdum:`,
            imageUrl: `[https://image.pollinations.ai/prompt/$](https://image.pollinations.ai/prompt/$){prompt}`
        };
    }

    // 3. Diğer TÜM Sorular İçin Doğrudan İnternetten Canlı Yanıt Al
    try {
        // Yapay zekaya Türkçe ve doğru yanıt vermesi için talimat ekleyerek internetten sorguluyoruz
        const enhancedQuery = `${query} (Bu soruyu Türkçe olarak, net, doğru, ayrıntılı ve açıklayıcı bir şekilde yanıtla)`;
        const response = await fetch(`[https://text.pollinations.ai/$](https://text.pollinations.ai/$){encodeURIComponent(enhancedQuery)}`);
        const aiText = await response.text();
        
        return {
            text: aiText || "Bu konuda internetten veri alınamadı.",
            imageUrl: null
        };
    } catch (err) {
        return {
            text: "İnternet bağlantısında bir sorun oluştu.",
            imageUrl: null
        };
    }
}

// Başlat
init();
