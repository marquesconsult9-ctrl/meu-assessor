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
  status: 'DISCONNECTED', // 'DISCONNECTED' | 'GENERATING_QR' | 'SCAN_QR' | 'CONNECTING' | 'CONNECTED'
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

function hasSavedSession() {
  return fs.existsSync(path.join(AUTH_DIR, 'creds.json'));
}

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

// Extract text reliably across all WhatsApp message types
function extractMessageText(msg) {
  if (!msg || !msg.message) return '';
  const m = msg.message;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentWithCaptionMessage?.message?.documentMessage?.caption ||
    m.ephemeralMessage?.message?.conversation ||
    m.ephemeralMessage?.message?.extendedTextMessage?.text ||
    m.ephemeralMessage?.message?.imageMessage?.caption ||
    m.viewOnceMessage?.message?.conversation ||
    m.viewOnceMessage?.message?.extendedTextMessage?.text ||
    m.viewOnceMessageV2?.message?.conversation ||
    m.viewOnceMessageV2?.message?.extendedTextMessage?.text ||
    m.editedMessage?.message?.protocolMessage?.editedMessage?.conversation ||
    m.editedMessage?.message?.protocolMessage?.editedMessage?.extendedTextMessage?.text ||
    ''
  );
}

// Check if message is a self-chat (user texting themselves / "Você")
function isSelfChat(senderJid, sockUser) {
  if (!senderJid || !sockUser) return false;
  const userFull = sockUser.id || '';
  const userLid = sockUser.lid || '';

  if (senderJid === userFull || (userLid && senderJid === userLid)) return true;

  const cleanUser = userFull.split(':')[0].split('@')[0].replace(/\D/g, '');
  const cleanSender = senderJid.split(':')[0].split('@')[0].replace(/\D/g, '');

  if (cleanUser && cleanSender) {
    if (cleanUser === cleanSender) return true;

    // Brazilian 9th digit variation (55 + 2 DDD + 8 or 9 digits)
    if (cleanUser.startsWith('55') && cleanSender.startsWith('55')) {
      const uDdd = cleanUser.slice(2, 4);
      const sDdd = cleanSender.slice(2, 4);
      if (uDdd === sDdd) {
        const uRest = cleanUser.slice(4);
        const sRest = cleanSender.slice(4);
        if (uRest === sRest) return true;
        if (uRest.length === 9 && sRest.length === 8 && uRest.slice(1) === sRest) return true;
        if (sRest.length === 9 && uRest.length === 8 && sRest.slice(1) === uRest) return true;
      }
    }
  }

  if (userLid && senderJid.endsWith('@lid')) {
    const cleanLidUser = userLid.split(':')[0].split('@')[0];
    const cleanLidSender = senderJid.split(':')[0].split('@')[0];
    if (cleanLidUser === cleanLidSender) return true;
  }

  return false;
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
    printQRInTerminal: false,
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
        console.error('[WhatsApp Service] Erro ao gerar imagem do QR Code:', err);
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
        updateStatus('DISCONNECTED', { qrCodeDataUrl: null, connectedPhone: null, connectedName: null });
        console.log('[WhatsApp Service] Sessão desconectada/desvinculada pelo usuário.');
      } else if (shouldReconnect) {
        updateStatus('CONNECTING', { qrCodeDataUrl: null });
        console.log('[WhatsApp Service] Conexão fechada temporariamente. Reconectando em 4s...');
        setTimeout(() => connectToWhatsApp(onMessageCallback, onStatusCallback), 4000);
      } else {
        updateStatus('DISCONNECTED', { qrCodeDataUrl: null, connectedPhone: null, connectedName: null });
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

  // Listen to incoming messages
  sock.ev.on('messages.upsert', async (m) => {
    try {
      if (!m.messages || m.messages.length === 0) return;

      for (const msg of m.messages) {
        if (!msg || !msg.message) continue;

        const senderJid = msg.key.remoteJid || '';

        // 1. FILTER: Ignore groups, channels, newsletters, broadcasts and calls
        if (
          !senderJid ||
          senderJid.endsWith('@g.us') ||
          senderJid.endsWith('@broadcast') ||
          senderJid === 'status@broadcast' ||
          senderJid.endsWith('@newsletter') ||
          senderJid.endsWith('@call')
        ) {
          continue;
        }

        const msgId = msg.key.id;

        // 2. GUARD: Prevent re-processing identical message ID
        if (processedMessageIds.has(msgId)) continue;
        processedMessageIds.add(msgId);
        if (processedMessageIds.size > 1000) {
          const first = processedMessageIds.values().next().value;
          processedMessageIds.delete(first);
        }

        // 3. GUARD: If message was sent by the bot itself, NEVER process it!
        if (sentByBotMessageIds.has(msgId)) {
          continue;
        }

        // 4. Extract text
        const text = extractMessageText(msg);
        const trimmed = text.trim();
        if (!trimmed) continue;

        // 5. GUARD: Ignore bot's own responses
        if (
          trimmed.startsWith('📊 *Projeção') ||
          trimmed.startsWith('📋 *Resumo') ||
          trimmed.startsWith('💰 *Resumo') ||
          trimmed.startsWith('✅ *Compra') ||
          trimmed.startsWith('✅ *Despesa') ||
          trimmed.startsWith('💵 *Receita') ||
          trimmed.startsWith('👋 Olá! Sou o seu assessor') ||
          trimmed.startsWith('🎉 *Você não possui') ||
          trimmed.startsWith('⚠️ ')
        ) {
          continue;
        }

        // 6. GUARD: Self-chat vs external message
        const selfChat = isSelfChat(senderJid, sock.user);

        // If fromMe: only allow if it's self-chat ("Conversar consigo mesmo" / "Você")
        if (msg.key.fromMe && !selfChat) {
          continue; // User sent to another contact, ignore!
        }

        // 7. Determine destination to reply
        let replyDestination = senderJid;
        if (senderJid.endsWith('@lid') && sock.user?.id) {
          const phoneOnly = sock.user.id.split(':')[0];
          replyDestination = `${phoneOnly}@s.whatsapp.net`;
        }

        // 8. Process message through callback
        if (onMessageCallback) {
          const replyText = await onMessageCallback(trimmed, replyDestination, msg.key.fromMe);

          if (replyText && sock && isConnected) {
            try {
              const sent = await sock.sendMessage(replyDestination, { text: replyText });
              if (sent?.key?.id) {
                sentByBotMessageIds.add(sent.key.id);
                if (sentByBotMessageIds.size > 500) {
                  const first = sentByBotMessageIds.values().next().value;
                  sentByBotMessageIds.delete(first);
                }
              }
            } catch (sendErr) {
              console.error('[WhatsApp Service] Erro ao enviar resposta para', replyDestination, sendErr.message);
            }
          }
        }
      }
    } catch (err) {
      console.error('[WhatsApp Service] Erro no processamento de mensagem:', err);
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
  logoutWhatsApp,
  hasSavedSession
};
