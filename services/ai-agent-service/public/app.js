// Client script for Leo AI Agent UI matching original Leo interface & instant speed
let chatHistory = [];
let clientSnapshot = null;

const chatContainer = document.getElementById('chatContainer');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');
const themeSelector = document.getElementById('theme-selector');

lucide.createIcons();

function showToast(msg) {
  toastMsg.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

function appendMessage(role, content) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role === 'user' ? 'user-message' : 'ai-message'}`;
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content glass-panel';
  
  if (role === 'ai') {
    contentDiv.innerHTML = marked.parse(content);
  } else {
    contentDiv.textContent = content;
  }
  
  msgDiv.appendChild(contentDiv);
  chatContainer.appendChild(msgDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return msgDiv;
}

function showTypingIndicator() {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message ai-message typing-indicator-container';
  msgDiv.id = 'typingIndicator';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content glass-panel typing-indicator';
  contentDiv.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
  
  msgDiv.appendChild(contentDiv);
  chatContainer.appendChild(msgDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function hideTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) indicator.remove();
}

// --- Theme Selector ---
const savedTheme = localStorage.getItem('leo_theme') || 'default';
function applyTheme(theme) {
  document.body.classList.remove('theme-light', 'theme-alt-dark');
  if (theme !== 'default') {
    document.body.classList.add(`theme-${theme}`);
  }
  localStorage.setItem('leo_theme', theme);
  if (themeSelector) themeSelector.value = theme;
}
applyTheme(savedTheme);

if (themeSelector) {
  themeSelector.addEventListener('change', (e) => {
    applyTheme(e.target.value);
  });
}

// Clear History
clearHistoryBtn.addEventListener('click', () => {
  chatHistory = [];
  chatContainer.innerHTML = '<div class="message ai-message"><div class="message-content glass-panel">History cleared. How can I help you today?</div></div>';
  showToast('Chat history cleared');
});

// Pre-warm snapshot on page load for instant zero-latency chip clicks
async function prewarmClientSnapshot() {
  try {
    const res = await fetch('/api/v1/quick-status');
    if (res.ok) {
      clientSnapshot = await res.json();
    }
  } catch (e) {}
}

// Send query to microservice backend
async function sendUserMessage(messageText) {
  if (!messageText || !messageText.trim()) return;
  const userText = messageText.trim();
  
  appendMessage('user', userText);
  chatHistory.push({ role: 'user', content: userText });
  chatInput.value = '';
  showTypingIndicator();

  try {
    const res = await fetch('/api/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userText,
        history: chatHistory
      })
    });

    const data = await res.json();
    hideTypingIndicator();

    const reply = data.response || "Received empty response from microservices.";
    appendMessage('ai', reply);
    chatHistory.push({ role: 'model', content: reply });
  } catch (err) {
    hideTypingIndicator();
    appendMessage('ai', `⚠️ Connection error: ${err.message}. Ensure microservices are running!`);
  }
}

// Form submit
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  sendUserMessage(chatInput.value);
});

// Quick chips click
const quickChipsContainer = document.getElementById('quickChipsContainer');
if (quickChipsContainer) {
  quickChipsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-btn');
    if (!btn) return;
    const query = btn.getAttribute('data-query');
    if (!query) return;
    sendUserMessage(query);
  });
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  prewarmClientSnapshot();
});
