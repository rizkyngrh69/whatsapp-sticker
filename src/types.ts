import { Static, t } from 'elysia';

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

export const BotStatus = t.Union([
  t.Literal('connected'),
  t.Literal('disconnected'),
  t.Literal('initializing')
]);

// API Response
export const HealthResponseSchema = t.Object({
  status: t.Literal('healthy'),
  timestamp: t.String({ format: 'date-time' }),
  bot: BotStatus,
  uptime: t.Optional(t.Number()),
  memory: t.Optional(t.Object({
    rss: t.Number(),
    heapTotal: t.Number(),
    heapUsed: t.Number(),
    external: t.Number(),
  }))
});

export const QRSuccessResponseSchema = t.Object({
  qr: t.String(),
  message: t.String(),
  timestamp: t.String({ format: 'date-time' })
});

export const MessageResponseSchema = t.Object({
  message: t.String(),
  timestamp: t.String({ format: 'date-time' })
});

export const QRResponseSchema = t.Union([
  QRSuccessResponseSchema,
  MessageResponseSchema
]);

export const RestartSuccessResponseSchema = t.Object({
  message: t.String(),
  timestamp: t.String({ format: 'date-time' })
});

export const ErrorResponseSchema = t.Object({
  error: t.String(),
  message: t.Optional(t.String()),
  details: t.Optional(t.String()),
  timestamp: t.String({ format: 'date-time' })
});

export const RestartResponseSchema = t.Union([
  RestartSuccessResponseSchema,
  ErrorResponseSchema
]);

export type HealthResponse = Static<typeof HealthResponseSchema>;
export type QRResponse = Static<typeof QRResponseSchema>;
export type RestartResponse = Static<typeof RestartResponseSchema>;
export type ErrorResponse = Static<typeof ErrorResponseSchema>;
export type BotStatusType = Static<typeof BotStatus>;

export interface ProcessedMessage {
  id: string;
  from: string;
  type: 'image' | 'video' | 'text' | 'sticker';
  processed: boolean;
  timestamp: number;
}