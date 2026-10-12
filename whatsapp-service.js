// ==========================================================================
// WHATSAPP BAILEYS CONNECTION SERVICE (QR CODE SCAN & MESSAGE HANDLER)
// ==========================================================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const AUTH_DIR = path.join(__dirname, 'data', 'auth_info_baileys');

if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

let sock = null;
let isConnected = false;
let connectionState = {
  status: 'DISCONNECTED', // 'DISCONNECTED' | 'GENERATING_QR' | 'SCAN_QR' | 'CONNECTED'
  qrCodeDataUrl: null,
  connectedPhone: null,
  connectedName: null,
  lastUpdated: new Date().toISOString()
};

let onMessageCallback = null;
let onStatusCallback = null;

// Anti-Loop & Anti-Spam Guards
const sentByBotMessageIds = new Set();
const processedMessageIds = new Set();
let lastReplyTimestamp = 0;

function updateStatus(newStatus, extra = {}) {
  connectionState = {
    ...connectionState,
    ...extra,
    status: newStatus,
    lastUpdated: new Date().toISOString()
  };
  if (onStatusCallback) {
    onStatusCallback(connectionState);
  }
}

async function connectToWhatsApp(onMessage, onStatus) {
  if (onMessage) onMessageCallback = onMessage;
  if (onStatus) onStatusCallback = onStatus;

  updateStatus('GENERATING_QR');

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }), // Silent logs
    printQRInTerminal: true,
    auth: state,
    browser: ['Meu Assessor Financeiro', 'Chrome', '1.0.0'],
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        const qrDataUrl = await QRCode.toDataURL(qr, {
          margin: 2,
          width: 280,
          color: { dark: '#000000', light: '#ffffff' }
        });
        updateStatus('SCAN_QR', { qrCodeDataUrl: qrDataUrl });
      } catch (err) {
        console.error('Error generating QR Code image:', err);
      }
    }

    if (connection === 'close') {
      isConnected = false;
      const isLoggedOut = (lastDisconnect?.error)?.output?.statusCode === DisconnectReason.loggedOut;
      const shouldReconnect = !isLoggedOut;

      if (isLoggedOut) {
        try {
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        } catch (e) {}
        updateStatus('DISCONNECTED', { qrCodeDataUrl: null, connectedPhone: null });
      } else if (shouldReconnect) {
        updateStatus('CONNECTING', { qrCodeDataUrl: null });
        setTimeout(() => connectToWhatsApp(onMessageCallback, onStatusCallback), 4000);
      } else {
        updateStatus('DISCONNECTED', { qrCodeDataUrl: null, connectedPhone: null });
      }
    } else if (connection === 'open') {
      if (!isConnected) {
        isConnected = true;
        const user = sock.user;
        const phone = user ? user.id.split(':')[0] : 'Conectado';
        updateStatus('CONNECTED', {
          qrCodeDataUrl: null,
          connectedPhone: phone,
          connectedName: user?.name || 'Usuário WhatsApp'
        });
        console.log(`[WhatsApp Service] Conectado com sucesso ao número: ${phone}`);
      }
    }
  });

  // Listen to incoming messages with strict loop protection
  sock.ev.on('messages.upsert', async (m) => {
    try {
      if (!m.messages || m.messages.length === 0) return;

      for (const msg of m.messages) {
        if (!msg || !msg.message) continue;
        if (msg.key.remoteJid === 'status@broadcast') continue;

        const msgId = msg.key.id;

        // GUARD 1: Prevent re-processing identical message ID
        if (processedMessageIds.has(msgId)) continue;
        processedMessageIds.add(msgId);
        if (processedMessageIds.size > 1000) {
          const first = processedMessageIds.values().next().value;
          processedMessageIds.delete(first);
        }

        // GUARD 2: If message was sent by the bot itself, NEVER process it!
        if (sentByBotMessageIds.has(msgId)) {
          continue;
        }

        // Extract text
        const text = msg.message.conversation ||
                     msg.message.extendedTextMessage?.text ||
                     msg.message.imageMessage?.caption ||
                     msg.message.videoMessage?.caption || '';

        const trimmed = text.trim();
        if (!trimmed) continue;

        // GUARD 3: If message starts with any of the bot's own response markers, IGNORE IMMEDIATELY
        if (
          trimmed.startsWith('📊 *Projeção') ||
          trimmed.startsWith('📋 *Resumo') ||
          trimmed.startsWith('💰 *Resumo') ||
          trimmed.startsWith('✅ *Compra') ||
          trimmed.startsWith('✅ *Despesa') ||
          trimmed.startsWith('💵 *Receita') ||
          trimmed.startsWith('👋 Olá! Sou o seu assessor') ||
          trimmed.startsWith('🎉 *Você não possui')
        ) {
          continue;
        }

        // GUARD 4: Distinguish user messages from bot messages in self-chat
        const myPhone = sock.user?.id ? sock.user.id.split(':')[0] : '';
        const senderJid = msg.key.remoteJid;
        const senderPhone = senderJid ? senderJid.split('@')[0].split(':')[0] : '';
        const isChatWithSelf = (myPhone && senderPhone && myPhone === senderPhone);

        // If message is fromMe: only allow if user is chatting with themselves AND it's not a bot echo
        if (msg.key.fromMe && !isChatWithSelf) {
          continue; // User sent to another contact, ignore!
        }

        // GUARD 5: Rate limit / Debounce (minimum 1.5 seconds between processing)
        const now = Date.now();
        if (now - lastReplyTimestamp < 1500) {
          continue;
        }

        // Process message through callback
        if (onMessageCallback) {
          lastReplyTimestamp = Date.now();
          const replyText = await onMessageCallback(trimmed, senderJid, msg.key.fromMe);

          if (replyText && sock) {
            const sent = await sock.sendMessage(senderJid, { text: replyText });
            if (sent?.key?.id) {
              sentByBotMessageIds.add(sent.key.id);
              if (sentByBotMessageIds.size > 500) {
                const first = sentByBotMessageIds.values().next().value;
                sentByBotMessageIds.delete(first);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error processing WhatsApp message:', err);
    }
  });
}

function getWhatsAppStatus() {
  return connectionState;
}

async function logoutWhatsApp() {
  try {
    isConnected = false;
    if (sock) {
      await sock.logout();
      sock = null;
    }
  } catch (e) {}
  try {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  } catch (e) {}
  updateStatus('DISCONNECTED', { qrCodeDataUrl: null, connectedPhone: null, connectedName: null });
}

module.exports = {
  connectToWhatsApp,
  getWhatsAppStatus,
  logoutWhatsApp
};
