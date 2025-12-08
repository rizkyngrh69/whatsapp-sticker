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

class WhatsAppStickerBot {
    private sock: any;

    constructor() {
        this.initializeBot();
    }

    private async initializeBot(): Promise<void> {
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
            connectTimeoutMs: 60_000,
            defaultQueryTimeoutMs: 60_000,
            keepAliveIntervalMs: 30_000,
            markOnlineOnConnect: false,
            syncFullHistory: false,
            generateHighQualityLinkPreview: true,
            retryRequestDelayMs: 1_000,
            maxMsgRetryCount: 5
        });

        this.sock.ev.on('connection.update', (update: any) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (connection) console.log('Connection:', connection);
            
            if (qr) {
                this.displayQRCode(qr);
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                
                console.log('Connection lost:', lastDisconnect?.error?.message || 'Unknown');
                
                if (shouldReconnect) {
                    console.log('Reconnecting in 10s...');
                    setTimeout(() => {
                        this.initializeBot();
                    }, 10000);
                } else {
                    console.log('Bot stopped.');
                }
            } else if (connection === 'open') {
                console.log('Bot connected and ready!');
            }
        });

        this.sock.ev.on('creds.update', saveCreds);
        this.sock.ev.on('messages.upsert', this.handleMessage.bind(this));
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

            if (metadata.width && metadata.height) {
                const size = Math.max(metadata.width, metadata.height);
                if (size > 1024) {
                    processedImage = processedImage.resize(512, 512, {
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    });
                } else {
                    processedImage = processedImage.resize(512, 512, {
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    });
                }
            }

            const stickerBuffer = await processedImage
                .webp({ quality: 90, effort: 6 })
                .toBuffer();

            await this.sock.sendMessage(message.key.remoteJid!, {
                sticker: stickerBuffer
            });

            const processingTime = Date.now() - startTime;
            console.log(`Sticker sent successfully! Processing time: ${processingTime}ms`);



        } catch (error) {
            console.error('Error converting to sticker:', error);
            
            let errorMessage = 'Failed to create sticker. ';
            
            if (error instanceof Error) {
                if (error.message.includes('Input file is missing')) {
                    errorMessage += 'Could not download the image. Please try again.';
                } else if (error.message.includes('Input buffer contains unsupported image format')) {
                    errorMessage += 'Unsupported image format. Please send JPG, PNG, or WebP images.';
                } else {
                    errorMessage += 'Please try with a different image.';
                }
            } else {
                errorMessage += 'Unknown error occurred.';
            }
            
            errorMessage += '\n\nTip: Type "tips" for image guidelines.';
            
            await this.sock.sendMessage(message.key.remoteJid!, {
                text: errorMessage
            });
            
            throw error;
        }
    }

    private async convertVideoToGif(message: WAMessage): Promise<void> {
        const startTime = Date.now();
        
        try {
            const buffer = await downloadMediaMessage(message, 'buffer', {});
            
            if (!buffer) {
                throw new Error('Could not download video');
            }

            console.log('Converting video to GIF...');
            
            await this.sock.sendMessage(message.key.remoteJid!, {
                video: buffer,
                gifPlayback: true,
                ptv: false
            });

            const processingTime = Date.now() - startTime;
            console.log(`GIF sent successfully! Processing time: ${processingTime}ms`);

        } catch (error) {
            console.error('Error converting video to GIF:', error);
            
            let errorMessage = 'Failed to create GIF. ';
            
            if (error instanceof Error) {
                if (error.message.includes('Could not download')) {
                    errorMessage += 'Could not download the video. Please try again.';
                } else {
                    errorMessage += 'Please try with a different video.';
                }
            } else {
                errorMessage += 'Unknown error occurred.';
            }
            
            await this.sock.sendMessage(message.key.remoteJid!, {
                text: errorMessage
            });
            
            throw error;
        }
    }

    private async handleTextCommand(text: string, jid: string): Promise<void> {
        switch (text) {
            case '/start':
            case 'start':
            case 'mulai':
                await this.sendWelcomeMessage(jid);
                break;
            case '/help':
            case 'help':
            case 'bantuan':
                await this.sendHelpMessage(jid);
                break;
            case '/commands':
            case 'commands':
            case 'perintah':
                await this.sendCommandsList(jid);
                break;
            case '/info':
            case 'info':
                await this.sendBotInfo(jid);
                break;
            case '/status':
            case 'status':
                await this.sendBotStatus(jid);
                break;
            case '/tips':
            case 'tips':
                await this.sendStickerTips(jid);
                break;
            case 'ping':
                await this.sock.sendMessage(jid, { text: 'Pong! Bot sedang berjalan.' });
                break;
            default:
                if (text.includes('hello') || text.includes('hi') || text.includes('hey') || text.includes('halo') || text.includes('hai')) {
                    await this.sendGreeting(jid);
                } else if (text.includes('thank') || text.includes('thanks') || text.includes('terima kasih') || text.includes('makasih')) {
                    await this.sendThankYou(jid);
                }
                break;
        }
    }

    private async sendWelcomeMessage(jid: string): Promise<void> {
        const welcomeText = `Kirim gambar untuk membuat stiker.`;
        
        await this.sock.sendMessage(jid, { text: welcomeText });
    }

    private async sendHelpMessage(jid: string): Promise<void> {
        const helpText = `*WhatsApp Sticker Bot - Panduan Bantuan*

*Fungsi Utama:*
• Kirim gambar apa saja dan saya akan mengubahnya menjadi stiker
• Kirim video dan saya akan mengubahnya menjadi GIF
• Mendukung format JPG, PNG, WebP untuk gambar
• Mendukung format MP4, MOV, AVI untuk video
• Otomatis mengubah ukuran ke 512x512px (optimal untuk WhatsApp)

*Cara Menggunakan:*
1. Kirim foto dari galeri Anda
2. Kirim file gambar sebagai dokumen
3. Kirim video untuk membuat GIF
4. Forward gambar/video dari chat lain

*Perintah:*
• Ketik 'perintah' - Lihat semua perintah yang tersedia
• Ketik 'tips' - Dapatkan tips membuat stiker
• Ketik 'info' - Informasi bot
• Ketik 'status' - Cek status bot
• Ketik 'ping' - Test respon bot

*Butuh bantuan?* Ketik 'bantuan' kapan saja!`;

        await this.sock.sendMessage(jid, { text: helpText });
    }

    private async sendCommandsList(jid: string): Promise<void> {
        const commandsText = `*Perintah Yang Tersedia:*

*/start* atau *mulai* - Pesan selamat datang dan panduan cepat
*/help* atau *bantuan* - Panduan bantuan lengkap
*/commands* atau *perintah* - Daftar perintah ini
*/info* - Informasi dan fitur bot
*/status* - Cek status operasional bot
*/tips* - Tips optimasi gambar dan video
*ping* - Test responsivitas bot

*Aksi Cepat:*
• Kirim 'hai' atau 'halo' untuk salam
• Kirim 'terima kasih' untuk menunjukkan apresiasi

*Fitur Utama:*
• Kirim gambar untuk mengubahnya menjadi stiker!
• Kirim video untuk mengubahnya menjadi GIF!

Tidak perlu perintah untuk konversi - otomatis!`;

        await this.sock.sendMessage(jid, { text: commandsText });
    }

    private async sendBotInfo(jid: string): Promise<void> {
        const infoText = `*Informasi WhatsApp Sticker Bot*

*Fitur:*
• Konversi gambar ke stiker secara instan
• Konversi video ke GIF secara otomatis
• Dukungan berbagai format gambar (JPG, PNG, WebP)
• Dukungan berbagai format video (MP4, MOV, AVI)
• Optimasi gambar dan video otomatis
• Output berkualitas tinggi
• Tanpa batas ukuran file (wajar)
• Bekerja dengan foto, video, dan dokumen
• Tersedia 24/7

*Detail Teknis:*
• Resolusi stiker: 512x512px (dioptimalkan untuk WhatsApp)
• Format stiker: WebP (kompresi terbaik)
• Format GIF: MP4 dengan gifPlayback
• Kualitas: Tinggi (90% kualitas dipertahankan)
• Pemrosesan: Server-side dengan Sharp

*Versi:* 1.0.1
*Dibangun dengan:* TypeScript + Baileys
*Didukung oleh:* Node.js + Sharp Image Processing`;

        await this.sock.sendMessage(jid, { text: infoText });
    }

    private async sendBotStatus(jid: string): Promise<void> {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        
        const statusText = `*Laporan Status Bot*

*Status:* Online dan Beroperasi
*Uptime:* ${hours}j ${minutes}m ${seconds}d
*Memori:* ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB digunakan
*Koneksi:* Stabil
*WhatsApp:* Terhubung
*Pemrosesan Gambar:* Siap
*Pemrosesan Video:* Siap

*Performa:*
• Rata-rata waktu respon: <5 detik
• Tingkat keberhasilan: 99%+
• Format gambar: JPG, PNG, WebP
• Format video: MP4, MOV, AVI

Bot siap mengubah gambar dan video Anda!`;

        await this.sock.sendMessage(jid, { text: statusText });
    }

    private async sendStickerTips(jid: string): Promise<void> {
        const tipsText = `*Tips Membuat Stiker & GIF*

*Tips Stiker (Gambar):*
• Gunakan gambar persegi (rasio 1:1)
• Letakkan subjek di tengah
• Minimal resolusi 512x512px
• Hapus latar belakang yang ramai
• Kontras tinggi lebih baik

*Tips GIF (Video):*
• Video pendek (3-10 detik) lebih baik
• Gerakan yang jelas dan menarik
• Hindari video yang terlalu panjang
• Kualitas video yang baik
• Ukuran file tidak terlalu besar

*Panduan Umum:*
• Subjek yang jelas dan fokus
• Pencahayaan yang baik
• Hindari teks (sulit dibaca saat kecil)
• Komposisi sederhana lebih baik

*Yang Bekerja dengan Baik:*
• Wajah dan ekspresi
• Objek sederhana
• Logo dan ikon
• Karakter kartun
• Meme dan reaksi
• Gerakan lucu (untuk GIF)

*Hindari:*
• Latar belakang yang sangat ramai
• Terlalu banyak teks
• Gambar/video yang sangat gelap
• Foto/video yang blur
• Scene yang kompleks

Kirim gambar atau video dan saya akan mengoptimasinya!`;

        await this.sock.sendMessage(jid, { text: tipsText });
    }

    private async sendGreeting(jid: string): Promise<void> {
        const greetings = [
            "Halo! Kirim gambar dan saya akan mengubahnya menjadi stiker!",
            "Hai! Siap membuat stiker yang keren?",
            "Hei! Saya asisten pembuat stiker Anda. Kirim gambar apa saja!",
            "Halo! Kirim gambar di sini dan lihat keajaibannya!"
        ];
        
        const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
        await this.sock.sendMessage(jid, { text: randomGreeting });
    }

    private async sendThankYou(jid: string): Promise<void> {
        const responses = [
            "Sama-sama! Senang bisa membantu dengan stiker Anda!",
            "Dengan senang hati! Kirim lebih banyak gambar kapan saja!",
            "Senang bisa membantu! Terus buat stiker yang keren!",
            "Sama-sama! Saya di sini kapan pun Anda butuh stiker!"
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        await this.sock.sendMessage(jid, { text: randomResponse });
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

console.log('Starting WhatsApp Sticker Bot...');
new WhatsAppStickerBot();