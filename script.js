:root {
    --bg-dark: #000000;
    --bg-sidebar: #000000;
    --bg-input: #212121;
    --text-primary: #ececf1;
    --text-secondary: #b4b4b4;
    --user-bubble: #171717;
    --border-color: #2f2f2f;
    --accent-blue: #0000ff;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

body {
    display: flex;
    height: 100vh;
    background-color: var(--bg-dark);
    color: var(--text-primary);
    overflow: hidden;
}

/* Sol Menü (Sidebar) */
.sidebar {
    width: 260px;
    background-color: var(--bg-sidebar);
    display: flex;
    flex-direction: column;
    padding: 12px;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 4px;
    margin-bottom: 8px;
}

.brand {
    font-weight: 600;
    font-size: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.icon-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 16px;
}

.icon-btn:hover {
    color: var(--text-primary);
}

.nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    color: var(--text-primary);
    transition: background 0.2s;
    background: transparent;
    border: none;
    width: 100%;
    text-align: left;
}

.nav-item:hover {
    background: #171717;
}

.new-chat {
    margin-bottom: 10px;
}

.external-icon {
    margin-left: auto;
    font-size: 11px;
    color: var(--text-secondary);
}

.nav-menu {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.sidebar-history {
    flex: 1;
    overflow-y: auto;
    margin-top: 10px;
}

.history-item {
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 14px;
    color: var(--text-secondary);
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.history-item:hover, .history-item.active {
    background: #171717;
    color: var(--text-primary);
}

.sidebar-footer {
    margin-top: auto;
    padding-top: 15px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.promo-box {
    margin-bottom: 12px;
}

.promo-box strong {
    font-size: 13px;
    display: block;
    margin-bottom: 4px;
}

.promo-box p {
    font-size: 11px;
    color: var(--text-secondary);
    line-height: 1.4;
}

.login-btn-full {
    width: 100%;
    padding: 10px;
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    border-radius: 20px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
}

.login-btn-full:hover {
    background: #171717;
}

/* Ana İçerik */
.main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
    background: var(--bg-dark);
}

.top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
}

.model-selector {
    font-weight: 600;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
}

.auth-buttons {
    display: flex;
    gap: 10px;
}

.btn-login {
    background: #ffffff;
    color: #000000;
    border: none;
    padding: 8px 16px;
    border-radius: 20px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
}

.btn-signup {
    background: #212121;
    color: #ffffff;
    border: none;
    padding: 8px 16px;
    border-radius: 20px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
}

/* Sohbet Alanı */
.chat-container {
    flex: 1;
    overflow-y: auto;
    padding: 20px 15%;
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-bottom: 100px;
}

.message-row {
    display: flex;
    width: 100%;
}

.message-row.user {
    justify-content: flex-end;
}

.message-row.ai {
    justify-content: flex-start;
}

.user-bubble {
    background-color: #00008b;
    color: white;
    padding: 10px 18px;
    border-radius: 20px;
    max-width: 70%;
    font-size: 15px;
}

.ai-bubble {
    color: var(--text-primary);
    max-width: 85%;
    font-size: 15px;
    line-height: 1.6;
}

.ai-actions {
    display: flex;
    gap: 10px;
    margin-top: 8px;
    color: var(--text-secondary);
    font-size: 14px;
}

.ai-actions i {
    cursor: pointer;
}

.ai-actions i:hover {
    color: var(--text-primary);
}

/* Giriş Kutusu */
.input-wrapper {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 760px;
    padding: 0 20px;
}

.input-box {
    background-color: var(--bg-input);
    border-radius: 26px;
    display: flex;
    align-items: center;
    padding: 10px 16px;
    gap: 12px;
}

.input-box textarea {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 16px;
    resize: none;
    max-height: 150px;
}

.input-action-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 16px;
    cursor: pointer;
}

.send-btn {
    background: #676767;
    border: none;
    color: #000000;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}

.ai-image {
    max-width: 100%;
    border-radius: 12px;
    margin-top: 10px;
}
