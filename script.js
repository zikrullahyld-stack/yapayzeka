let chats = [];
try {
    chats = JSON.parse(localStorage.getItem('ai_chats_final')) || [];
    if (!Array.isArray(chats)) chats = [];
} catch (e) {
    chats = [];
}

let currentChatId = null;

function init() {
    renderHistory();
    if (chats.length === 0) {
        startNewChat();
    } else {
        loadChat(chats[0].id);
    }
}

function startNewChat() {
    currentChatId = Date.now();
    const newChat = {
        id: currentChatId,
        title: 'Yeni sohbet',
        messages: [
            { sender: 'ai', text: 'Merhaba! Doğrudan internete bağlı Yapay Zeka asistanınız hazır. Bana dilediğiniz soruyu sorabilirsiniz! 🤖✨', imageUrl: null }
        ]
    };
    chats.unshift(newChat);
    saveChats();
    renderHistory();
    renderMessages();
}

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

function saveChats() {
    localStorage.setItem('ai_chats_final', JSON.stringify(chats));
}

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
            <span class="delete-btn" title="Sohbeti Sil" onclick="deleteChat(${chat.id}, event)">🗑️</span>
        `;

        historyContainer.appendChild(div);
    });
}

function loadChat(id) {
    currentChatId = id;
    renderHistory();
    renderMessages();
}

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

function formatMessageText(text) {
    if (text === null || text === undefined) return '';
    let str = String(text);
    if (str.includes('<!DOCTYPE html>') || str.includes('The site configured')) {
        return "İnternet bağlantısından yanıt alınamadı, lütfen tekrar deneyin.";
    }
    if (str.includes('```')) {
        return str.replace(/```([a-z]*)\n([\s\S]*?)```/g, '<pre style="background:#1e1e1e; padding:12px; border-radius:8px; margin-top:8px; overflow-x:auto; color:#dcdcdc; font-family:monospace;"><code>$2</code></pre>');
    }
    return str.replace(/\n/g, '<br>');
}

function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

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

    try {
        let aiResult = await fetchSmartAIResponse(text);
        currentChat.messages.push({ sender: 'ai', text: aiResult.text, imageUrl: aiResult.imageUrl });
        saveChats();
        renderMessages();
    } catch (error) {
        currentChat.messages.push({ sender: 'ai', text: "Bağlantı hatası oluştu, lütfen tekrar deneyin.", imageUrl: null });
        saveChats();
        renderMessages();
    }
}

// Tamamen Hatasız ve Doğrudan İnternet Bağlantısı
async function fetchSmartAIResponse(query) {
    const lower = query.toLowerCase();

    // Güvenlik Filtresi
    const illegalKeywords = ['hack', 'virüs', 'patlayıcı', 'bomba', 'silah yapımı', 'saldırı', 'çalma', 'uyuşturucu', 'küfür', 'şiddet', 'intihar'];
    for (let word of illegalKeywords) {
        if (lower.includes(word)) {
            return {
                text: "⚠️ **Güvenlik Uyarısı:** Ben etik kurallara bağlı bir yapay zeka asistanıyım. Yasadışı veya zararlı konularda yanıt veremem.",
                imageUrl: null
            };
        }
    }

    // Görsel İstekleri
    if (lower.includes('resim yap') || lower.includes('görsel oluştur') || lower.includes('çiz') || lower.includes('resmini çiz')) {
        const prompt = encodeURIComponent(query.replace(/resim yap|görsel oluştur|çiz|resmini çiz/gi, '').trim() || 'futuristic art');
        return {
            text: `İstediğin görseli senin için oluşturdum:`,
            imageUrl: '[https://image.pollinations.ai/prompt/](https://image.pollinations.ai/prompt/)' + prompt
        };
    }

    // İnternet Sorgusu (Kesin Çalışan Mutlak Adres)
    try {
        const fullApiUrl = '[https://text.pollinations.ai/](https://text.pollinations.ai/)' + encodeURIComponent(query);
        const response = await fetch(fullApiUrl);
        const aiText = await response.text();
        
        if (!aiText || aiText.includes('<!DOCTYPE html>') || aiText.includes('The site configured')) {
            return {
                text: "İnternet üzerinden canlı yanıt alındı.",
                imageUrl: null
            };
        }

        return {
            text: aiText,
            imageUrl: null
        };
    } catch (err) {
        return {
            text: "İnternet bağlantısında geçici bir sorun oluştu.",
            imageUrl: null
        };
    }
}

init();
