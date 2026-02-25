export interface StickerOptions {
    quality?: number;
    background?: { r: number; g: number; b: number; alpha: number };
    size?: number;
}

export interface BotConfig {
    maxFileSize: number;
    supportedFormats: string[];
    stickerSize: number;
    authPath: string;
    logLevel: 'silent' | 'error' | 'warn' | 'info' | 'debug';
    maxRetries: number;
    retryDelay: number;
    stickerOptions: StickerOptions;
}

export const defaultConfig: BotConfig = {
    maxFileSize: 10 * 1024 * 1024,
    supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
    stickerSize: 512,
    authPath: 'auth_info_baileys',
    logLevel: 'silent',
    maxRetries: 3,
    retryDelay: 1000,
    stickerOptions: {
        quality: 90,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        size: 512
    }
};

export interface HealthResponse {
  status: 'healthy';
  timestamp: string;
  bot: 'connected' | 'disconnected' | 'initializing';
  uptime?: number;
  memory?: NodeJS.MemoryUsage;
}

export interface QRResponse {
  qr?: string;
  message: string;
  timestamp: string;
}

export interface RestartResponse {
  message?: string;
  error?: string;
  details?: string;
  timestamp: string;
}

export interface ErrorResponse {
  error: string;
  message?: string;
  details?: string;
  timestamp: string;
}

export interface ProcessedMessage {
  id: string;
  from: string;
  type: 'image' | 'video' | 'text' | 'sticker';
  processed: boolean;
  timestamp: number;
}