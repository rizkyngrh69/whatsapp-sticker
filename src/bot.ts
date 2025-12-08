import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState, 
    downloadMediaMessage,
    WAMessage
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

export class WhatsAppStickerBot {
    private sock: any;
    private currentQR: string | null = null;
    private connected: boolean = false;

    constructor() {
        this.initializeBot();
    }

    public isConnected(): boolean {
        return this.connected;
    }

    public getQRCode(): string | null {
        return this.currentQR;
    }

    public async restart(): Promise<void> {
        if (this.sock) {
            this.sock.ws?.close();
        }
        this.connected = false;
        this.currentQR = null;
        await this.initializeBot();
    }

    private async initializeBot(): Promise<void> {
        try {
            const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
            
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
                generateHighQualityLinkPreview: false
            });

            this.sock.ev.on('connection.update', (update: any) => {
                const { connection, lastDisconnect, qr, isNewLogin, isOnline } = update;
                
                if (qr) {
                    this.currentQR = qr;
                    this.displayQRCode(qr);
                } else if (connection === 'close') {
                    const errorCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                    
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
                }
            });

            this.sock.ev.on('creds.update', saveCreds);
            this.sock.ev.on('messages.upsert', this.handleMessage.bind(this));
        } catch (error) {
            throw error;
        }
    }

    private async handleMessage(m: any): Promise<void> {
        const message = m.messages[0];
        
        if (!message || message.key.fromMe) return;

        const messageType = Object.keys(message.message || {})[0];
        const isImage = messageType === 'imageMessage';
        const isVideo = messageType === 'videoMessage';
        const isGif = messageType === 'videoMessage' && message.message?.videoMessage?.gifPlayback;
        const isDocument = messageType === 'documentMessage' && 
            (message.message?.documentMessage?.mimetype?.startsWith('image/') ||
             message.message?.documentMessage?.mimetype?.startsWith('video/'));
        const isSticker = messageType === 'stickerMessage';

        if (isImage || (isDocument && message.message?.documentMessage?.mimetype?.startsWith('image/'))) {
            try {
                await this.convertToSticker(message);
            } catch (error) {
                await this.sock.sendMessage(message.key.remoteJid!, {
                    text: 'Failed to process image. Please try another image format.'
                });
            }
        } else if (isVideo || isGif || (isDocument && message.message?.documentMessage?.mimetype?.startsWith('video/'))) {
            try {
                await this.convertVideoToGif(message);
            } catch (error) {
                await this.sock.sendMessage(message.key.remoteJid!, {
                    text: 'Failed to process video. Please try another video format.'
                });
            }
        } else if (isSticker) {
            await this.handleStickerMessage(message);
        } else if (message.message?.conversation || message.message?.extendedTextMessage?.text) {
            const text = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').toLowerCase().trim();
            
            await this.handleTextCommand(text, message.key.remoteJid!);
        }
    }

    private async convertToSticker(message: WAMessage): Promise<void> {
        const startTime = Date.now();
        
        try {
            const buffer = await downloadMediaMessage(message, 'buffer', {});
            
            if (!buffer) {
                throw new Error('Could not download media');
            }

            const metadata = await sharp(buffer).metadata();

            let processedImage = sharp(buffer);
            
            const { width = 0, height = 0 } = metadata;
            const size = Math.max(width, height);

            if (size > 1024) {
                processedImage = processedImage.resize(512, 512, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                });
            } else if (size < 512) {
                processedImage = processedImage.resize(512, 512, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                });
            }

            const processedBuffer = await processedImage
                .webp({ quality: 90, effort: 3 })
                .toBuffer();

            await this.sock.sendMessage(message.key.remoteJid!, { 
                sticker: processedBuffer 
            });

        } catch (error) {
            throw error;
        }
    }

    private async convertVideoToGif(message: WAMessage): Promise<void> {
        const startTime = Date.now();
        
        try {
            const buffer = await downloadMediaMessage(message, 'buffer', {});
            
            if (!buffer) {
                throw new Error('Could not download media');
            }

            await this.sock.sendMessage(message.key.remoteJid!, {
                video: buffer,
                gifPlayback: true,
                ptv: false
            });

        } catch (error) {
            throw error;
        }
    }

    private async handleTextCommand(text: string, jid: string): Promise<void> {
        if (text.includes('help')) {
            await this.sock.sendMessage(jid, { text: 'Send images for stickers or videos for GIFs.' });
        } else if (text.includes('ping')) {
            await this.sock.sendMessage(jid, { text: 'Active' });
        } else {
            await this.sock.sendMessage(jid, { text: 'Send image or video' });
        }
    }

    private async handleStickerMessage(message: WAMessage): Promise<void> {
        await this.sock.sendMessage(message.key.remoteJid!, { text: 'Send another image or video' });
    }

    private displayQRCode(qr: string): void {
        const isProduction = process.env.NODE_ENV === 'production';
        
        if (isProduction) {
            try {
                qrcode.generate(qr, { small: true });
            } catch (error) {}
            console.log(qr);
        } else {
            try {
                qrcode.generate(qr, { small: true });
                console.log('Raw QR Data: ' + qr);
            } catch (error) {
                console.log('Raw QR Data: ' + qr);
            }
        }
    }
}