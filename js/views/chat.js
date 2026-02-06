/**
 * DiaMate AI Chat View - Production Server-Side Integration
 * NO API key UI - all AI calls go through server
 */
import { t, getLang, createToast } from '../utils.js';
import { 
    getPersonalizedGreeting, 
    getSmartSuggestions, 
    generateChatResponse, 
    saveConversation,
    getConversationHistory,
    clearConversationHistory,
    getEntitlement
} from '../ai-assistant.js';
import { navigateTo } from '../router.js';

let chatMessages = [];
let isTyping = false;
let entitlement = null;

/**
 * Initialize chat view
 */
export function initChat() {
    renderChatView();
    loadEntitlement();
}

async function loadEntitlement() {
    entitlement = await getEntitlement();
}

/**
 * Render chat view
 */
export function renderChatView() {
    const container = document.getElementById('chatScreen');
    if (!container) return;
    
    // Load conversation history
    const history = getConversationHistory(20);
    chatMessages = history.map(h => [
        { type: 'user', text: h.user, ts: h.ts },
        { type: 'bot', text: h.bot, ts: h.ts }
    ]).flat();
    
    // Add welcome message if no history
    if (chatMessages.length === 0) {
        const greeting = getPersonalizedGreeting();
        chatMessages.push({ type: 'bot', text: greeting, ts: Date.now() });
    }
    
    const suggestions = getSmartSuggestions();
    const lang = getLang();
    
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; height: calc(100vh - 180px); max-height: 600px;">
            <!-- Chat Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 16px 20px; border-radius: 24px 24px 0 0; color: white;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 44px; height: 44px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px;">🤖</div>
                        <div>
                            <div style="font-size: 16px; font-weight: 700;">DiaMate AI</div>
                            <div style="font-size: 12px; opacity: 0.9; display: flex; align-items: center; gap: 6px;">
                                <span style="width: 8px; height: 8px; background: #4CAF50; border-radius: 50%;"></span>
                                ${lang === 'en' ? 'Ready' : 'Hazır'}
                            </div>
                        </div>
                    </div>
                    <button id="clearChatBtn" title="${t('Sohbeti Temizle', 'Clear Chat')}" style="width: 36px; height: 36px; background: rgba(255,255,255,0.2); border: none; border-radius: 10px; color: white; font-size: 16px; cursor: pointer;">🗑️</button>
                </div>
            </div>
            
            <!-- Smart Suggestions -->
            ${suggestions.length > 0 ? `
                <div style="background: white; padding: 10px 16px; border-bottom: 1px solid var(--border);">
                    <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px;">
                        ${suggestions.map((s, i) => `
                            <button class="suggestion-chip" data-prompt="${escapeAttr(s.prompt)}" style="
                                flex-shrink: 0;
                                padding: 8px 14px;
                                background: ${s.type === 'warning' ? '#FFF3E0' : '#E3F2FD'};
                                border: 1px solid ${s.type === 'warning' ? '#FFB74D' : '#64B5F6'};
                                border-radius: 20px;
                                font-size: 12px;
                                font-weight: 600;
                                color: ${s.type === 'warning' ? '#E65100' : '#1565C0'};
                                cursor: pointer;
                                white-space: nowrap;
                            ">
                                ${s.icon} ${s.text.substring(0, 35)}${s.text.length > 35 ? '...' : ''}
                            </button>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <!-- Chat Messages -->
            <div id="chatMessages" style="flex: 1; overflow-y: auto; padding: 16px; background: var(--background);">
                ${renderMessages()}
            </div>
            
            <!-- Typing Indicator -->
            <div id="typingIndicator" style="display: none; padding: 8px 16px; background: var(--background);">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px;">🤖</div>
                    <div style="background: white; padding: 12px 16px; border-radius: 18px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                        <div class="typing-dots">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                    <span style="font-size: 12px; color: var(--text-secondary);">${t('AI düşünüyor...', 'AI is thinking...')}</span>
                </div>
            </div>
            
            <!-- Quick Actions -->
            <div style="background: white; padding: 10px 16px; border-top: 1px solid var(--border);">
                <div style="display: flex; gap: 6px; overflow-x: auto;">
                    <button class="quick-ask" data-msg="${t('Bugün nasılım?', 'How am I doing today?')}" style="flex-shrink: 0; padding: 6px 12px; background: var(--background); border: 1px solid var(--border); border-radius: 14px; font-size: 12px; cursor: pointer;">
                        📊 ${t('Durumum', 'Status')}
                    </button>
                    <button class="quick-ask" data-msg="${t('Yemek önerileri ver', 'Give me meal suggestions')}" style="flex-shrink: 0; padding: 6px 12px; background: var(--background); border: 1px solid var(--border); border-radius: 14px; font-size: 12px; cursor: pointer;">
                        🍽️ ${t('Yemek', 'Meals')}
                    </button>
                    <button class="quick-ask" data-msg="${t('Düşük şekerde ne yapmalıyım?', 'What should I do for low blood sugar?')}" style="flex-shrink: 0; padding: 6px 12px; background: var(--background); border: 1px solid var(--border); border-radius: 14px; font-size: 12px; cursor: pointer;">
                        🚨 ${t('Hipo', 'Hypo')}
                    </button>
                    <button class="quick-ask" data-msg="${t('Yüksek şekeri nasıl düşürürüm?', 'How do I lower high blood sugar?')}" style="flex-shrink: 0; padding: 6px 12px; background: var(--background); border: 1px solid var(--border); border-radius: 14px; font-size: 12px; cursor: pointer;">
                        📈 ${t('Hiper', 'Hyper')}
                    </button>
                    <button class="quick-ask" data-msg="${t('Egzersiz ve diyabet hakkında bilgi ver', 'Tell me about exercise and diabetes')}" style="flex-shrink: 0; padding: 6px 12px; background: var(--background); border: 1px solid var(--border); border-radius: 14px; font-size: 12px; cursor: pointer;">
                        🏃 ${t('Egzersiz', 'Exercise')}
                    </button>
                </div>
            </div>
            
            <!-- Input Area -->
            <div style="background: white; padding: 12px 16px 16px; border-radius: 0 0 24px 24px; box-shadow: 0 -2px 10px rgba(0,0,0,0.05);">
                <div style="display: flex; gap: 10px; align-items: center;">
                    <input type="text" id="chatInput" placeholder="${t('Mesajınızı yazın...', 'Type your message...')}" style="
                        flex: 1;
                        padding: 14px 18px;
                        border: 2px solid var(--border);
                        border-radius: 24px;
                        font-size: 15px;
                        outline: none;
                        transition: border-color 0.2s;
                    ">
                    <button id="sendBtn" style="
                        width: 48px;
                        height: 48px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        border: none;
                        border-radius: 50%;
                        color: white;
                        font-size: 20px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">➤</button>
                </div>
            </div>
        </div>
        
        <style>
            .typing-dots {
                display: flex;
                gap: 4px;
            }
            .typing-dots span {
                width: 8px;
                height: 8px;
                background: #667eea;
                border-radius: 50%;
                animation: bounce 1.4s infinite ease-in-out both;
            }
            .typing-dots span:nth-child(1) { animation-delay: -0.32s; }
            .typing-dots span:nth-child(2) { animation-delay: -0.16s; }
            @keyframes bounce {
                0%, 80%, 100% { transform: scale(0); }
                40% { transform: scale(1); }
            }
            #chatInput:focus {
                border-color: #667eea;
            }
        </style>
    `;
    
    wireChatEvents();
    scrollToBottom();
}

function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderMessages() {
    return chatMessages.map(msg => {
        if (msg.type === 'user') {
            return `
                <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
                    <div style="max-width: 85%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 16px; border-radius: 18px 18px 4px 18px; font-size: 14px; line-height: 1.5;">
                        ${escapeHtml(msg.text)}
                    </div>
                </div>
            `;
        } else {
            return `
                <div style="display: flex; gap: 10px; margin-bottom: 12px;">
                    <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;">🤖</div>
                    <div style="max-width: 85%; background: white; padding: 12px 16px; border-radius: 18px 18px 18px 4px; font-size: 14px; line-height: 1.6; box-shadow: 0 1px 2px rgba(0,0,0,0.1); white-space: pre-wrap;">
                        ${formatBotMessage(msg.text)}
                    </div>
                </div>
            `;
        }
    }).join('');
}

function formatBotMessage(text) {
    let formatted = escapeHtml(text)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
    
    // Convert dose calculator links
    formatted = formatted.replace(
        /\[([^\]]+)\]\(#dose\)/g,
        '<a href="#" onclick="window.navigateTo(\'dose\'); return false;" style="color: #667eea; font-weight: 600;">$1</a>'
    );
    
    return formatted;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function wireChatEvents() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    
    sendBtn?.addEventListener('click', sendMessage);
    
    input?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    document.querySelectorAll('.quick-ask').forEach(btn => {
        btn.addEventListener('click', () => {
            const msg = btn.dataset.msg;
            document.getElementById('chatInput').value = msg;
            sendMessage();
        });
    });
    
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const prompt = chip.dataset.prompt;
            document.getElementById('chatInput').value = prompt;
            sendMessage();
        });
    });
    
    document.getElementById('clearChatBtn')?.addEventListener('click', () => {
        if (confirm(t('Sohbet geçmişini silmek istediğinizden emin misiniz?', 'Are you sure you want to clear chat history?'))) {
            clearConversationHistory();
            chatMessages = [];
            const greeting = getPersonalizedGreeting();
            chatMessages.push({ type: 'bot', text: greeting, ts: Date.now() });
            updateMessages();
            createToast('success', t('Sohbet temizlendi', 'Chat cleared'));
        }
    });
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input?.value?.trim();
    
    if (!message || isTyping) return;
    
    chatMessages.push({ type: 'user', text: message, ts: Date.now() });
    input.value = '';
    
    updateMessages();
    scrollToBottom();
    showTyping();
    
    try {
        const response = await generateChatResponse(message);
        hideTyping();
        addBotMessage(response);
        saveConversation(message, response);
    } catch (error) {
        hideTyping();
        addBotMessage(t('Bir hata oluştu. Lütfen tekrar deneyin.', 'An error occurred. Please try again.'));
    }
}

function addBotMessage(text) {
    chatMessages.push({ type: 'bot', text, ts: Date.now() });
    updateMessages();
    scrollToBottom();
}

function updateMessages() {
    const container = document.getElementById('chatMessages');
    if (container) {
        container.innerHTML = renderMessages();
    }
}

function scrollToBottom() {
    const container = document.getElementById('chatMessages');
    if (container) {
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 50);
    }
}

function showTyping() {
    isTyping = true;
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.style.display = 'block';
    scrollToBottom();
}

function hideTyping() {
    isTyping = false;
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.style.display = 'none';
}

// Expose navigateTo globally for inline links
window.navigateTo = navigateTo;
