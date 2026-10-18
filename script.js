let chats = JSON.parse(localStorage.getItem('ai_chats')) || [];
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
        title: 'Yeni Sohbet',
        messages: [
            { sender: 'ai', text: 'Merhaba! Ben senin akıllı yapay zeka asistanınım. Kod yazabilir, soruları yanıtlayabilir veya "resim yap: [açıklama]" yazarsan görsel oluşturabilirim.' }
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
    historyContainer.innerHTML = '';
    chats.forEach(chat => {
        const div = document.createElement('div');
        div.className = `history-item ${chat.id === currentChatId ? 'active' : ''}`;
        div.textContent = chat.title;
        div.onclick = () => loadChat(chat.id);
        historyContainer.appendChild(div);
    });
}

// Bir Sohbete Tıklandığında Onu Yükleme
function loadChat(id) {
    currentChatId = id;
    renderHistory();
    renderMessages();
}

// Mesajları Ekrana Yazdırma
function renderMessages() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    const currentChat = chats.find(c => c.id === currentChatId);
    if (!currentChat) return;

    currentChat.messages.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${msg.sender}`;
        
        let contentHTML = `<div class="message-content">
            <div class="avatar">${msg.sender === 'user' ? 'Sen' : 'AI'}</div>
            <div class="text">${formatMessageText(msg.text)}</div>
        </div>`;
        
        if (msg.imageUrl) {
            contentHTML = `<div class="message-content">
                <div class="avatar">AI</div>
                <div class="text">${formatMessageText(msg.text)}<br><img src="${msg.imageUrl}" class="ai-image" alt="Üretilen Görsel"></div>
            </div>`;
        }

        msgDiv.innerHTML = contentHTML;
        chatMessages.appendChild(msgDiv);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Kod ve Satır Başlarını Biçimlendirme
function formatMessageText(text) {
    if (text.includes('```')) {
        return text.replace(/```([a-z]*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    }
    return text.replace(/\n/g, '<br>');
}

// Enter Tuşuna Basınca Mesaj Gönderme
function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// Mesaj Gönderme Mantığı
function sendMessage() {
    const input = document.getElementById('userInput');
    const text = input.value.trim();
    if (!text) return;

    const currentChat = chats.find(c => c.id === currentChatId);
    if (!currentChat) return;

    currentChat.messages.push({ sender: 'user', text: text });
    
    // Sohbet Başlığını İlk Mesaja Göre Değiştir
    if (currentChat.messages.length === 2) {
        currentChat.title = text.length > 20 ? text.substring(0, 20) + '...' : text;
    }

    input.value = '';
    saveChats();
    renderHistory();
    renderMessages();

    // Yapay Zekanın Akıllı Yanıt Üretmesi
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

// Yapay Zeka Cevap Motoru (Kod Yazma ve Resim Oluşturma)
function generateAIResponse(query) {
    const lower = query.toLowerCase();

    // Resim Yapma İsteği
    if (lower.includes('resim yap') || lower.includes('görsel oluştur') || lower.includes('çiz')) {
        const prompt = encodeURIComponent(query.replace(/resim yap|görsel oluştur|çiz/gi, '').trim() || 'futuristic robot');
        return {
            text: `İstediğin resmi hemen hazırladım:`,
            imageUrl: `[https://image.pollinations.ai/prompt/$](https://image.pollinations.ai/prompt/$){prompt}`
        };
    }

    // Kod Yazma İsteği
    if (lower.includes('kod') || lower.includes('html') || lower.includes('javascript') || lower.includes('css') || lower.includes('python')) {
        return {
            text: `İşte senin için yazdığım kod örneği:\n\n\`\`\`javascript\nfunction selamla() {\n    console.log("Merhaba, Yapay Zeka Kod Yazıyor!");\n}\nselamla();\n\`\`\``
        };
    }

    // Genel Akıllı Yanıtlar
    return {
        text: `"${query}" sorusunu çok iyi anladım! Sana bu konuda yardımcı olabilirim. Kod mu yazmamı istersin yoksa bir resim mi çizmemi istersin?`
    };
}

// Uygulamayı Başlat
init();
