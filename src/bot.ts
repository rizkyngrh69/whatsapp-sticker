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
        console.log('Initializing WhatsApp connection...');
        
        try {
            const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
            
            console.log('Auth state loaded:', {
                hasCreds: !!state.creds,
                isRegistered: state.creds?.registered,
                hasKeys: !!state.keys && Object.keys(state.keys).length > 0
            });

            console.log('Creating WhatsApp socket with Baileys 7.0.0...');
            
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
                
                console.log('Connection update:', { 
                    connection, 
                    hasQr: !!qr, 
                    qrLength: qr?.length || 0,
                    hasError: !!lastDisconnect,
                    isNewLogin,
                    isOnline,
                    timestamp: new Date().toISOString()
                });
                
                if (qr) {
                    console.log('QR CODE GENERATED! Length:', qr.length);
                    console.log('QR Preview:', qr.substring(0, 50) + '...');
                    this.currentQR = qr;
                    this.displayQRCode(qr);
                } else if (connection === 'connecting') {
                    console.log('Connecting to WhatsApp Web...');
                } else if (connection === 'close') {
                    const errorCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                    const errorMessage = lastDisconnect?.error?.message;
                    
                    console.log('Connection closed');
                    console.log('Error details:', {
                        code: errorCode,
                        message: errorMessage,
                        shouldReconnect: errorCode !== DisconnectReason.loggedOut
                    });
                    
                    this.connected = false;
                    this.currentQR = null;
                    
                    if (errorCode === 405) {
                        console.log('Error 405: This might be a network/firewall issue');
                        console.log('Try running with a VPN or check your network settings');
                    }
                    
                    const shouldReconnect = errorCode !== DisconnectReason.loggedOut;
                    if (shouldReconnect) {
                        console.log('Reconnecting in 10s...');
                        setTimeout(() => {
                            this.initializeBot();
                        }, 10000);
                    } else {
                        console.log('Bot stopped (logged out)');
                    }
                } else if (connection === 'open') {
                    console.log('Bot connected and ready!');
                    this.connected = true;
                    this.currentQR = null;
                }
            });

            this.sock.ev.on('creds.update', saveCreds);
            this.sock.ev.on('messages.upsert', this.handleMessage.bind(this));
        } catch (error) {
            console.error('Failed to initialize auth state:', error);
            throw error;
        }
    }

    private async handleMessage(m: any): Promise<void> {
        const message = m.messages[0];
        
        if (!message || message.key.fromMe) return;

        const messageType = Object.keys(message.message || {})[0];
        const isImage = messageType === 'imageMessage';
        const isVideo = messageType === 'videoMessage';
        const isDocument = messageType === 'documentMessage' && 
            (message.message?.documentMessage?.mimetype?.startsWith('image/') ||
             message.message?.documentMessage?.mimetype?.startsWith('video/'));
        const isSticker = messageType === 'stickerMessage';

        if (isImage || (isDocument && message.message?.documentMessage?.mimetype?.startsWith('image/'))) {
            try {
                await this.convertToSticker(message);
            } catch (error) {
                console.error('Image processing failed:', error);
                await this.sock.sendMessage(message.key.remoteJid!, {
                    text: 'Maaf, saya tidak bisa memproses gambar tersebut. Silakan coba kirim gambar lain dalam format JPG, PNG, atau WebP.'
                });
            }
        } else if (isVideo || (isDocument && message.message?.documentMessage?.mimetype?.startsWith('video/'))) {
            try {
                await this.convertVideoToGif(message);
            } catch (error) {
                console.error('Video processing failed:', error);
                await this.sock.sendMessage(message.key.remoteJid!, {
                    text: 'Maaf, saya tidak bisa memproses video tersebut. Silakan coba kirim video lain dalam format MP4, MOV, atau AVI.'
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
            console.log(`Processing ${metadata.format} image: ${metadata.width}x${metadata.height}`);

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

            const processingTime = Date.now() - startTime;
            console.log(`Image processed in ${processingTime}ms, output size: ${(processedBuffer.length / 1024).toFixed(1)}KB`);

            await this.sock.sendMessage(message.key.remoteJid!, { 
                sticker: processedBuffer 
            });

        } catch (error) {
            console.error('Sticker conversion error:', error);
            throw error;
        }
    }

    private async convertVideoToGif(message: WAMessage): Promise<void> {
        try {
            await this.sock.sendMessage(message.key.remoteJid!, {
                text: 'Video ke GIF converter sedang dalam pengembangan. Saat ini hanya mendukung gambar ke stiker.'
            });
        } catch (error) {
            console.error('Video conversion error:', error);
            throw error;
        }
    }

    private async handleTextCommand(text: string, jid: string): Promise<void> {
        if (text.includes('help') || text.includes('bantuan')) {
            const helpMessage = `
BOT STIKER WHATSAPP

Cara menggunakan:
• Kirim gambar untuk mengubahnya menjadi stiker
• Mendukung format JPG, PNG, WebP untuk gambar
• Mendukung format MP4, MOV, AVI untuk video
• Otomatis mengubah ukuran ke 512x512px (optimal untuk WhatsApp)
• Kualitas terjaga dengan kompresi WebP

Perintah yang tersedia:
• "help" atau "bantuan" - Menampilkan pesan ini
• "info" - Informasi tentang bot
• "ping" - Cek status bot

Kirim gambar sekarang untuk membuat stiker!
            `;

            await this.sock.sendMessage(jid, { text: helpMessage.trim() });
        } else if (text.includes('info')) {
            await this.sock.sendMessage(jid, {
                text: 'Bot Stiker WhatsApp v2.0\nDibuat dengan Baileys & Sharp\nMendukung konversi gambar ke stiker berkualitas tinggi'
            });
        } else if (text.includes('ping')) {
            await this.sock.sendMessage(jid, { text: 'Pong! Bot aktif dan siap mengkonversi gambar Anda.' });
        } else {
            const responses = [
                "Halo! Kirim gambar untuk saya ubah jadi stiker ya!",
                "Hai! Saya bisa mengubah gambar menjadi stiker. Kirim gambar sekarang!",
                "Hi! Mau buat stiker? Kirim aja gambarnya!"
            ];
            
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            await this.sock.sendMessage(jid, { text: randomResponse });
        }
    }

    private async handleStickerMessage(message: WAMessage): Promise<void> {
        const responses = [
            "Stiker bagus! Ingin saya buatkan lagi? Kirim gambar saja!",
            "Stiker keren! Kirim gambar dan saya akan buatkan stiker untuk Anda!",
            "Pilihan stiker yang bagus! Saya bisa membantu Anda membuat yang custom juga!"
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        await this.sock.sendMessage(message.key.remoteJid!, { text: randomResponse });
    }

    private displayQRCode(qr: string): void {
        const isProduction = process.env.NODE_ENV === 'production';
        
        console.log('\n' + '='.repeat(60));
        console.log('QR CODE FOR WHATSAPP AUTHENTICATION');
        console.log('='.repeat(60));
        console.log('Steps to connect:');
        console.log('1. Open WhatsApp on your phone');
        console.log('2. Go to Settings > Linked Devices');
        console.log('3. Tap "Link a Device"');
        console.log('4. Scan the QR code below');
        console.log('='.repeat(60));
        
        if (isProduction) {
            console.log('RENDER DEPLOYMENT - QR CODE GENERATION');
            console.log('');
            try {
                console.log('ASCII QR CODE (scan directly from logs):');
                qrcode.generate(qr, { small: true });
            } catch (error) {
                console.log('ASCII QR generation failed, showing raw data...');
            }
            console.log('');
            console.log('RAW QR DATA (use online generator if ASCII fails):');
            console.log(qr);
            console.log('');
            console.log('Online QR Generator: https://www.qr-code-generator.com/');
            console.log('1. Copy the raw QR data above');
            console.log('2. Paste it into the online generator');
            console.log('3. Generate QR image');
            console.log('4. Scan with WhatsApp mobile app');
        } else {
            try {
                qrcode.generate(qr, { small: true });
                console.log('');
                console.log('Raw QR Data: ' + qr);
            } catch (error) {
                console.error('Failed to generate terminal QR:', error);
                console.log('Raw QR Data: ' + qr);
            }
        }
        
        console.log('='.repeat(60) + '\n');
    }
}