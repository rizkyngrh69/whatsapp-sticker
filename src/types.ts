export interface StickerOptions {
    quality?: number;
    background?: { r: number; g: number; b: number; alpha: number };
    size?: number;
}

export interface BotConfig {
    maxFileSize: number;
    supportedFormats: string[];
    stickerSize: number;
}

export const defaultConfig: BotConfig = {
    maxFileSize: 10 * 1024 * 1024,
    supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
    stickerSize: 512
};