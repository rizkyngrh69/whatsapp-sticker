import sharp from 'sharp';
import { StickerOptions, defaultConfig } from './types';

export class StickerProcessor {
    static async processImage(
        buffer: Buffer, 
        options: StickerOptions = {}
    ): Promise<Buffer> {
        const {
            quality = 90,
            background = { r: 0, g: 0, b: 0, alpha: 0 },
            size = defaultConfig.stickerSize
        } = options;

        try {
            const processedImage = await sharp(buffer)
                .resize(size, size, {
                    fit: 'contain',
                    background: background
                })
                .webp({ quality })
                .toBuffer();

            return processedImage;
        } catch (error) {
            throw new Error(`Failed to process image: ${error}`);
        }
    }

    static validateImageBuffer(buffer: Buffer): boolean {
        if (!buffer || buffer.length === 0) {
            return false;
        }
        if (buffer.length > defaultConfig.maxFileSize) {
            throw new Error('File size too large');
        }
        return true;
    }

    static async getImageMetadata(buffer: Buffer): Promise<sharp.Metadata> {
        try {
            return await sharp(buffer).metadata();
        } catch (error) {
            throw new Error('Invalid image format');
        }
    }
}