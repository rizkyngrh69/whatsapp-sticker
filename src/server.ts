import { Elysia } from "elysia";
import { WhatsAppStickerBot } from "./bot";
import { 
  HealthResponseSchema,
  QRResponseSchema, 
  RestartResponseSchema,
  ErrorResponseSchema,
  type HealthResponse,
  type QRResponse,
  type RestartResponse,
  type ErrorResponse
} from "./types";

console.log('Starting WhatsApp Sticker Bot with Elysia...');
let bot: WhatsAppStickerBot;

setTimeout(() => {
  console.log('Initializing WhatsApp Bot...');
  bot = new WhatsAppStickerBot();
}, 1000);

const app = new Elysia()
  .onError(({ error, code, set }) => {
    console.error(`Server error [${code}]:`, error);
    
    const errorResponse = {
      error: String(code || 'INTERNAL_SERVER_ERROR'),
      message: (error as any)?.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    };
    
    switch (code) {
      case 'NOT_FOUND':
        set.status = 404;
        break;
      case 'VALIDATION':
        set.status = 400;
        break;
      case 'PARSE':
        set.status = 400;
        break;
      default:
        set.status = 500;
    }
    
    return errorResponse;
  })
  .get("/", () => ({
    message: "WhatsApp Sticker Bot is running!",
    timestamp: new Date().toISOString(),
    endpoints: ['/health', '/qr', '/restart', '/config']
  }))
  .get("/health", (): HealthResponse => ({ 
    status: "healthy" as const, 
    timestamp: new Date().toISOString(),
    bot: bot ? (bot.isConnected() ? "connected" as const : "disconnected" as const) : "initializing" as const,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  }), {
    response: HealthResponseSchema,
    detail: {
      tags: ['Health'],
      summary: 'Get bot health status',
      description: 'Returns the current health status of the WhatsApp bot'
    }
  })
  .get("/qr", (): QRResponse => {
    const timestamp = new Date().toISOString();
    
    if (!bot) {
      return { 
        message: "Bot is still initializing, please wait...",
        timestamp
      };
    }
    
    const qr = bot.getQRCode();
    if (qr) {
      return { 
        qr,
        message: "Scan this QR code with WhatsApp",
        timestamp
      };
    }
    return { 
      message: bot.isConnected() ? "Bot is already connected" : "QR code not available yet",
      timestamp
    };
  }, {
    response: QRResponseSchema,
    detail: {
      tags: ['QR Code'],
      summary: 'Get QR code for WhatsApp connection',
      description: 'Returns the QR code that needs to be scanned with WhatsApp'
    }
  })
  .post("/restart", async (): Promise<RestartResponse> => {
    const timestamp = new Date().toISOString();
    
    if (!bot) {
      return { 
        error: "Bot not initialized yet",
        message: "Please wait for bot initialization",
        timestamp
      };
    }
    
    try {
      await bot.restart();
      return { 
        message: "Bot restarted successfully", 
        timestamp 
      };
    } catch (error) {
      return { 
        error: "Failed to restart bot",
        details: error instanceof Error ? error.message : String(error),
        timestamp
      };
    }
  }, {
    response: RestartResponseSchema,
    detail: {
      tags: ['Bot Control'],
      summary: 'Restart the WhatsApp bot',
      description: 'Restarts the WhatsApp bot connection and re-initializes the session'
    }
  })
  .get("/config", () => {
    if (!bot) {
      return {
        error: "Bot not initialized yet",
        message: "Please wait for bot initialization"
      };
    }
    
    return {
      maxFileSize: "10MB",
      supportedFormats: ["image/jpeg", "image/png", "image/webp", "video/mp4"],
      features: ["image-to-sticker", "video-to-gif"],
      stickerSize: "512x512"
    };
  }, {
    detail: {
      tags: ['Configuration'],
      summary: 'Get bot configuration',
      description: 'Returns the current bot configuration and supported features'
    }
  })
  .listen(process.env.PORT || 3000);

console.log(`Elysia server is running on http://localhost:${app.server?.port || 3000}`);

export { app };
export default app;