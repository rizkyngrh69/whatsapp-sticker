import { Elysia } from "elysia";
import { WhatsAppStickerBot } from "./bot";

console.log('Starting WhatsApp Sticker Bot with Elysia...');
let bot: WhatsAppStickerBot;

setTimeout(() => {
  console.log('Initializing WhatsApp Bot...');
  bot = new WhatsAppStickerBot();
}, 1000);

const app = new Elysia()
  .get("/", () => "WhatsApp Sticker Bot is running!")
  .get("/health", () => ({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    bot: bot ? (bot.isConnected() ? "connected" : "disconnected") : "initializing"
  }))
  .get("/qr", () => {
    if (!bot) {
      return { 
        message: "Bot is still initializing, please wait..."
      };
    }
    
    const qr = bot.getQRCode();
    if (qr) {
      return { 
        qr,
        message: "Scan this QR code with WhatsApp"
      };
    }
    return { 
      message: bot.isConnected() ? "Bot is already connected" : "QR code not available yet"
    };
  })
  .post("/restart", async () => {
    if (!bot) {
      return { 
        error: "Bot not initialized yet",
        message: "Please wait for bot initialization"
      };
    }
    
    try {
      await bot.restart();
      return { message: "Bot restarted successfully" };
    } catch (error) {
      return { 
        error: "Failed to restart bot",
        details: error instanceof Error ? error.message : String(error)
      };
    }
  })
  .listen(process.env.PORT || 3000);

console.log(`Elysia server is running on http://localhost:${app.server?.port || 3000}`);

export { app };
export default app;