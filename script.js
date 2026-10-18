let chats = [];
try {
    chats = JSON.parse(localStorage.getItem('ai_chats')) || [];
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
            { sender: 'ai', text: 'Merhaba! 👋 Nasılsın? Sana nasıl yardımcı olabilirim? 🌸' }
        ]
    };
    chats.unshift(newChat);
    saveChats();
    renderHistory();
    renderMessages();
}

// Sohbetleri Tarayıcıya Kaydetme
function saveChats() {
    localStorage.setItem('ai_chats', JSON.stringify(chats));
}

// Geçmiş Sohbetleri Ekrana Listeleme
function renderHistory() {
    const historyContainer = document.getElementById('chatHistory');
    if (!historyContainer) return;
    historyContainer.innerHTML = '';
    chats.forEach(chat => {
        const div = document.createElement('div');
        div.className = `history-item ${chat.id === currentChatId ? 'active' : ''}`;
        div.textContent = chat.title || 'Sohbet';
        div.onclick = () => loadChat(chat.id);
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

        if (msg.sender === 'user') {
            rowDiv.innerHTML = `<div class="user-bubble">${formatMessageText(msg.text)}</div>`;
        } else {
            let imgHTML = msg.imageUrl ? `<br><img src="${msg.imageUrl}" class="ai-image" alt="Oluşturulan Görsel">` : '';
            rowDiv.innerHTML = `
                <div class="ai-bubble">
                    ${formatMessageText(msg.text)}${imgHTML}
                    <div class="ai-actions">
                        <i class="fa-regular fa-copy" title="Kopyala"></i>
                        <i class="fa-solid fa-rotate-right" title="Yeniden Dene"></i>
                    </div>
                </div>
            `;
        }
        chatMessages.appendChild(rowDiv);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Güvenli Metin ve Kod Biçimlendirme
function formatMessageText(text) {
    if (typeof text !== 'string') {
        text = String(text || '');
    }
    if (text.includes('```')) {
        return text.replace(/```([a-z]*)\n([\s\S]*?)```/g, '<pre style="background:#1e1e1e; padding:12px; border-radius:8px; margin-top:8px; overflow-x:auto; color:#dcdcdc; font-family:monospace;"><code>$2</code></pre>');
    }
    return text.replace(/\n/g, '<br>');
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

    currentChat.messages.push({ sender: 'user', text: text });
    
    if (currentChat.messages.length === 2) {
        currentChat.title = text.length > 20 ? text.substring(0, 20) + '...' : text;
    }

    input.value = '';
    saveChats();
    renderHistory();
    renderMessages();

    // Yapay Zeka Yanıt Simülasyonu
    setTimeout(() => {
        let aiResponse = generateAIResponse(text);
        let imageUrl = null;

        if (aiResponse.imageUrl) {
            imageUrl = aiResponse.imageUrl;
            aiResponse = aiResponse.text;
        }

        currentChat.messages.push({ sender: 'ai', text: aiResponse, imageUrl: imageUrl });
        saveChats();
        renderMessages();
    }, 600);
}

// Yapay Zeka Cevap Motoru
function generateAIResponse(query) {
    const lower = query.toLowerCase();

    if (lower.includes('resim yap') || lower.includes('görsel oluştur') || lower.includes('çiz')) {
        const prompt = encodeURIComponent(query.replace(/resim yap|görsel oluştur|çiz/gi, '').trim() || 'futuristic city');
        return {
            text: `İstediğin görseli senin için oluşturdum:`,
            imageUrl: `[https://image.pollinations.ai/prompt/$](https://image.pollinations.ai/prompt/$){prompt}`
        };
    }

    if (lower.includes('kod') || lower.includes('html') || lower.includes('javascript') || lower.includes('css')) {
        return {
            text: `İşte isteğinle ilgili örnek kod:\n\n\`\`\`javascript\n// Proje Ödevi Kod Örneği\nconsole.log("Yapay zeka başarıyla çalışıyor!");\n\`\`\``
        };
    }

    return {
        text: `Harika bir soru! "${query}" konusunda sana memnuniyetle yardımcı olabilirim. Kod yazmamı veya görsel oluşturmamı ister misin?`
    };
}

// Başlat
init();
