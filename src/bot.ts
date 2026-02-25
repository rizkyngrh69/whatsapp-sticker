import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState, 
    downloadMediaMessage,
    WAMessage,
    getContentType
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { defaultConfig, type BotConfig, type StickerOptions } from './types';

export class WhatsAppStickerBot {
    private sock: ReturnType<typeof makeWASocket> | null = null;
    private currentQR = null as string | null;
    private connected = false;
    private readonly config: BotConfig;

    constructor(config: Partial<BotConfig> = {}) {
        this.config = { ...defaultConfig, ...config };
        this.initializeBot();
    }

    public isConnected() {
        return this.connected;
    }

    public getQRCode() {
        return this.currentQR;
    }

    public async restart() {
        if (this.sock) {
            this.sock.ws?.close();
        }
        this.connected = false;
        this.currentQR = null;
        await this.initializeBot();
    }

    private async initializeBot() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState(this.config.authPath);
            
            this.sock = makeWASocket({
                auth: state,
                logger: {
                    level: 'silent',
                    error: () => {},
                    warn: () => {},
                    info: () => {},
                    debug: () => {},
                    trace: () => {},
                    child: () => ({
                        level: 'silent',
                        error: () => {},
                        warn: () => {},
                        info: () => {},
                        debug: () => {},
                        trace: () => {}
                    })
                } as any,
                markOnlineOnConnect: false,
                syncFullHistory: false,
                generateHighQualityLinkPreview: false,
                shouldSyncHistoryMessage: () => false,
                shouldIgnoreJid: () => false,
                getMessage: async (key) => {
                    return undefined;
                }
            });

            this.sock.ev.on('connection.update', (update: any) => {
                const { connection, lastDisconnect, qr, isNewLogin, isOnline } = update;
                
                console.log('[Connection Update]', JSON.stringify({ connection, hasQR: !!qr, isNewLogin, isOnline }));
                
                if (qr && !this.connected) {
                    this.currentQR = qr;
                    this.displayQRCode(qr);
                } else if (connection === 'close') {
                    const errorCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                    const errorMessage = (lastDisconnect?.error as Boom)?.message || 'Unknown error';
                    
                    console.log(`[Connection Closed] Code: ${errorCode}, Reason: ${errorMessage}`);
                    
                    this.connected = false;
                    this.currentQR = null;
                    
                    const shouldReconnect = errorCode !== DisconnectReason.loggedOut;
                    if (shouldReconnect) {
                        setTimeout(() => {
                            this.initializeBot();
                        }, 10000);
                    }
                } else if (connection === 'open') {
                    this.connected = true;
                    this.currentQR = null;
                    console.log('WhatsApp connection established successfully');
                }
            });

            this.sock.ev.on('creds.update', saveCreds);
            this.sock.ev.on('messages.upsert', this.handleMessage.bind(this));
        } catch (error) {
            throw error;
        }
    }

    private async handleMessage(m: { messages: WAMessage[] }) {
        const message = m.messages[0];
        
        if (!message || message.key.fromMe || !message.message) return;

        const messageType = getContentType(message.message);
        
        if (messageType === 'imageMessage' || 
            (messageType === 'documentMessage' && message.message?.documentMessage?.mimetype?.startsWith('image/'))) {
            try {
                await this.convertToSticker(message);
            } catch (error) {
                await this.sock?.sendMessage(message.key.remoteJid!, {
                    text: 'Failed to process image. Please try another image format.'
                });
            }
        } else if (messageType === 'videoMessage' || 
                   (messageType === 'documentMessage' && message.message?.documentMessage?.mimetype?.startsWith('video/'))) {
            try {
                await this.convertVideoToGif(message);
            } catch (error) {
                console.error('Video conversion error:', error);
                const errorMessage = String(error);
                
                let userMessage = 'Failed to process video. Please try another video format.';
                if (errorMessage.includes('BAD_DECRYPT') || errorMessage.includes('cipher')) {
                    userMessage = 'Failed to decrypt video. This may be due to WhatsApp\'s security system. Please resend the video or try a different one.';
                }
                
                await this.sock?.sendMessage(message.key.remoteJid!, {
                    text: userMessage
                });
            }
        } else if (messageType === 'stickerMessage') {
            await this.handleStickerMessage(message);
        } else if (message.message?.conversation || message.message?.extendedTextMessage?.text) {
            const text = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').toLowerCase().trim();
            
            await this.handleTextCommand(text, message.key.remoteJid!);
        }
    }

    private async convertToSticker(message: WAMessage) {
        try {
            console.log('Starting sticker conversion...');
            const buffer = await downloadMediaMessage(
                message, 
                'buffer', 
                {},
                {
                    logger: {
                        level: 'silent',
                        error: () => {},
                        warn: () => {},
                        info: () => {},
                        debug: () => {},
                        trace: () => {},
                        child: () => ({
                            level: 'silent',
                            error: () => {},
                            warn: () => {},
                            info: () => {},
                            debug: () => {},
                            trace: () => {}
                        })
                    } as any,
                    reuploadRequest: this.sock!.updateMediaMessage.bind(this.sock)
                }
            );
            
            if (!buffer) {
                throw new Error('Could not download media');
            }

            console.log(`Downloaded buffer size: ${buffer.length} bytes`);

            if (buffer.length === 0) {
                throw new Error('Downloaded buffer is empty');
            }

            let metadata;
            try {
                metadata = await sharp(buffer).metadata();
                console.log('Image metadata:', { 
                    width: metadata.width, 
                    height: metadata.height, 
                    format: metadata.format,
                    size: buffer.length 
                });
            } catch (metadataError) {
                console.error('Failed to read image metadata:', metadataError);
                throw new Error('Invalid image format or corrupted file');
            }

            const { width = 0, height = 0 } = metadata;
            const size = Math.max(width, height);

            const stickerOptions: StickerOptions = {
                quality: this.config.stickerOptions?.quality || 90,
                background: { r: 0, g: 0, b: 0, alpha: 0 },
                size: this.config.stickerSize
            };

            let processedImage = sharp(buffer, {
                failOnError: false, 
                limitInputPixels: 268402689
            });
            
            // Always resize to sticker size for consistency
            processedImage = processedImage.resize(stickerOptions.size, stickerOptions.size, {
                fit: 'contain',
                background: stickerOptions.background
            });

            console.log('Processing image to WebP...');
            const processedBuffer = await processedImage
                .webp({ 
                    quality: stickerOptions.quality || 90, 
                    effort: 3,
                    nearLossless: false
                })
                .toBuffer();

            console.log(`Processed buffer size: ${processedBuffer.length} bytes`);

            if (this.sock && message.key.remoteJid) {
                console.log('Sending sticker...');
                await this.sock.sendMessage(message.key.remoteJid, { 
                    sticker: processedBuffer 
                });
                console.log('Sticker sent successfully');
            }

        } catch (error) {
            console.error('Error in convertToSticker:', error);
            
            if (this.sock && message.key.remoteJid) {
                await this.sock.sendMessage(message.key.remoteJid, { 
                    text: 'Failed to convert image to sticker. Please try with a different image.' 
                });
            }
            
            throw error;
        }
    }

    private async convertVideoToGif(message: WAMessage) {
        let retryCount = 0;
        const maxRetries = this.config.maxRetries;
        
        while (retryCount < maxRetries) {
            try {
                console.log(`Attempting video conversion (attempt ${retryCount + 1}/${maxRetries})...`);
                const buffer = await downloadMediaMessage(
                    message, 
                    'buffer', 
                    {},
                    {
                        logger: {
                            level: 'silent',
                            error: () => {},
                            warn: () => {},
                            info: () => {},
                            debug: () => {},
                            trace: () => {},
                            child: () => ({
                                level: 'silent',
                                error: () => {},
                                warn: () => {},
                                info: () => {},
                                debug: () => {},
                                trace: () => {}
                            })
                        } as any,
                        reuploadRequest: this.sock!.updateMediaMessage.bind(this.sock)
                    }
                );
                
                if (!buffer) {
                    throw new Error('Could not download video media');
                }

                console.log(`Downloaded video buffer size: ${buffer.length} bytes`);

                if (buffer.length === 0) {
                    throw new Error('Downloaded video buffer is empty');
                }

                if (this.sock && message.key.remoteJid) {
                    console.log('Sending video as GIF...');
                    await this.sock.sendMessage(message.key.remoteJid, {
                        video: buffer,
                        gifPlayback: true
                    });
                    console.log('Video GIF sent successfully');
                }

                return;
                
            } catch (error) {
                retryCount++;
                const errorMessage = String(error);
                console.error(`Video conversion attempt ${retryCount} failed:`, errorMessage);

                if (errorMessage.includes('BAD_DECRYPT') || errorMessage.includes('cipher')) {
                    console.log('BAD_DECRYPT error detected - likely LID system issue');
                }
                
                if (retryCount >= maxRetries) {
                    if (this.sock && message.key.remoteJid) {
                        await this.sock.sendMessage(message.key.remoteJid, { 
                            text: 'Failed to process video. This may be due to WhatsApp\'s new security system. Please try with a different video file or resend the same video.' 
                        });
                    }
                    throw new Error(`Video processing failed after all retry attempts: ${errorMessage}`);
                }
                
                const delay = Math.pow(2, retryCount) * this.config.retryDelay;
                console.log(`Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    private async handleTextCommand(text: string, jid: string) {
        if (text.includes('help')) {
            await this.sock?.sendMessage(jid, { text: 'Send images for stickers or videos for GIFs.' });
        } else if (text.includes('ping')) {
            await this.sock?.sendMessage(jid, { text: 'Active' });
        } else {
            await this.sock?.sendMessage(jid, { text: 'Send image or video' });
        }
    }

    private async handleStickerMessage(message: WAMessage) {
        await this.sock?.sendMessage(message.key.remoteJid!, { text: 'Send another image or video' });
    }

    private displayQRCode(qr: string): void {
        console.log('\n========== QR CODE ==========');
        console.log('Scan this QR code with WhatsApp:');
        console.log('Raw QR Data:', qr);
        console.log('Or visit /qr endpoint in your browser');
        console.log('=============================\n');

        try {
            qrcode.generate(qr, { small: true }, (code: string) => {
                console.log(code);
            });
        } catch (error) {
            console.error('Failed to render QR in terminal:', error);
        }
    }
}