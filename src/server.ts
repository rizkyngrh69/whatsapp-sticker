import http from 'node:http';
import { WhatsAppStickerBot } from "./bot";

console.log('Starting WhatsApp Sticker Bot...');
let bot: WhatsAppStickerBot;

setTimeout(() => {
  console.log('Initializing WhatsApp Bot...');
  bot = new WhatsAppStickerBot();
}, 1000);

function json(res: http.ServerResponse, data: any, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function html(res: http.ServerResponse, body: string, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method || 'GET';

  try {
    // GET /
    if (method === 'GET' && path === '/') {
      return json(res, {
        message: "WhatsApp Sticker Bot is running!",
        timestamp: new Date().toISOString(),
        endpoints: ['/health', '/qr', '/qr/image', '/restart', '/config']
      });
    }

    // GET /health
    if (method === 'GET' && path === '/health') {
      return json(res, {
        status: "healthy",
        timestamp: new Date().toISOString(),
        bot: bot ? (bot.isConnected() ? "connected" : "disconnected") : "initializing",
        uptime: process.uptime(),
        memory: process.memoryUsage()
      });
    }

    // GET /qr
    if (method === 'GET' && path === '/qr') {
      const timestamp = new Date().toISOString();
      if (!bot) {
        return json(res, { message: "Bot is still initializing, please wait...", timestamp });
      }
      const qr = bot.getQRCode();
      if (qr) {
        return json(res, { qr, message: "Scan this QR code with WhatsApp. Or visit /qr/image for a scannable QR image.", timestamp });
      }
      return json(res, {
        message: bot.isConnected() ? "Bot is already connected" : "QR code not available yet. Refresh in a few seconds.",
        timestamp
      });
    }

    // GET /qr/image
    if (method === 'GET' && path === '/qr/image') {
      if (!bot) {
        return html(res, `<html><body style="font-family:sans-serif;text-align:center;padding:40px">
          <h2>Bot is still initializing...</h2>
          <p>Please refresh in a few seconds.</p>
          <script>setTimeout(()=>location.reload(),3000)</script>
        </body></html>`, 503);
      }

      if (bot.isConnected()) {
        return html(res, `<html><body style="font-family:sans-serif;text-align:center;padding:40px">
          <h2 style="color:green">✅ Bot is already connected!</h2>
        </body></html>`);
      }

      const qr = bot.getQRCode();
      if (!qr) {
        return html(res, `<html><body style="font-family:sans-serif;text-align:center;padding:40px">
          <h2>QR code not available yet</h2>
          <p>Please refresh in a few seconds.</p>
          <script>setTimeout(()=>location.reload(),3000)</script>
        </body></html>`, 404);
      }

      return html(res, `<html>
        <head><title>WhatsApp QR Code</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:40px;background:#f0f0f0">
          <h2>Scan QR Code with WhatsApp</h2>
          <div style="background:white;display:inline-block;padding:20px;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.1)">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}" alt="QR Code" width="300" height="300" />
          </div>
          <p style="color:#666;margin-top:16px">QR code expires quickly. Refresh if it doesn't work.</p>
          <script>setTimeout(()=>location.reload(),20000)</script>
        </body>
      </html>`);
    }

    // POST /restart
    if (method === 'POST' && path === '/restart') {
      const timestamp = new Date().toISOString();
      if (!bot) {
        return json(res, { error: "Bot not initialized yet", message: "Please wait for bot initialization", timestamp }, 503);
      }
      try {
        await bot.restart();
        return json(res, { message: "Bot restarted successfully", timestamp });
      } catch (error) {
        return json(res, {
          error: "Failed to restart bot",
          details: error instanceof Error ? error.message : String(error),
          timestamp
        }, 500);
      }
    }

    // GET /config
    if (method === 'GET' && path === '/config') {
      if (!bot) {
        return json(res, { error: "Bot not initialized yet", message: "Please wait for bot initialization" }, 503);
      }
      return json(res, {
        maxFileSize: "10MB",
        supportedFormats: ["image/jpeg", "image/png", "image/webp", "video/mp4"],
        features: ["image-to-sticker", "video-to-gif"],
        stickerSize: "512x512"
      });
    }

    // 404
    json(res, { error: "Not Found", message: `Cannot ${method} ${path}`, timestamp: new Date().toISOString() }, 404);

  } catch (error) {
    console.error('Server error:', error);
    json(res, {
      error: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

export { server };
export default server;