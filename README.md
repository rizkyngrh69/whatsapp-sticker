# WhatsApp Sticker Bot

A TypeScript-based WhatsApp bot that automatically converts images sent by users into WhatsApp stickers.

## Features

- Image to Sticker Conversion: Automatically converts any image to WhatsApp sticker format
- Multiple Format Support: Supports JPG, PNG, WebP, and other common image formats
- Auto-Resize: Automatically resizes images to optimal sticker dimensions (512x512px)
- Easy Setup: Simple configuration using your personal phone number
- Real-time Processing: Instant conversion and response

## Prerequisites

Before running this bot, make sure you have:

- Node.js (version 16 or higher)
- npm or yarn package manager
- A WhatsApp account (personal phone number)
- Stable internet connection

## Installation

1. **Clone or download this project**
   ```bash
   git clone <your-repo-url>
   cd whatsapp-sticker-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

## Usage

### Starting the Bot

1. **Development mode** (with auto-reload):
   ```bash
   npm run dev
   ```

2. **Production mode**:
   ```bash
   npm start
   ```

### First-time Setup

1. Run the bot using one of the commands above
2. A QR code will appear in your terminal
3. Open WhatsApp on your phone
4. Go to **Settings > Linked Devices > Link a Device**
5. Scan the QR code with your phone
6. Wait for the connection confirmation

### Using the Bot

Once connected, the bot will:

1. **Automatically convert images**: Send any image to your WhatsApp and it will be converted to a sticker
2. **Respond to help**: Send "help" or "/start" to get usage instructions
3. **Handle multiple formats**: Works with photos, image files, and documents

## Project Structure

```
whatsapp-sticker-bot/
├── src/
│   ├── index.ts              # Main bot implementation
│   ├── sticker-processor.ts  # Image processing utilities
│   └── types.ts              # TypeScript type definitions
├── dist/                     # Compiled JavaScript files
├── auth_info_baileys/        # WhatsApp session data (auto-generated)
├── package.json              # Project dependencies and scripts
├── tsconfig.json             # TypeScript configuration
└── README.md                 # This file
```

## Available Scripts

- `npm run dev` - Start development server with auto-reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run the compiled JavaScript version
- `npm run clean` - Remove compiled files

## Configuration

The bot uses the following default settings (configurable in `src/types.ts`):

- **Max file size**: 10MB
- **Sticker dimensions**: 512x512 pixels
- **Supported formats**: JPEG, PNG, WebP
- **Image quality**: 90%

## Troubleshooting

### Common Issues

1. **QR Code not appearing**
   - Make sure you have a stable internet connection
   - Try restarting the bot
   - Clear the `auth_info_baileys` folder and reconnect

2. **"Cannot find module" errors**
   - Run `npm install` to ensure all dependencies are installed
   - Make sure you're using Node.js version 16 or higher

3. **Image processing fails**
   - Check if the image format is supported
   - Ensure the image file isn't corrupted
   - Verify the image size is under 10MB

4. **Bot disconnects frequently**
   - Check your internet connection
   - Make sure your phone stays connected to the internet
   - Avoid using WhatsApp Web simultaneously

### Getting Help

If you encounter issues:

1. Check the console output for error messages
2. Ensure all dependencies are properly installed
3. Verify your Node.js version is compatible
4. Try clearing the session data and reconnecting

## Security Notes

- Session Data: The `auth_info_baileys` folder contains sensitive session information
- Privacy: The bot only processes images sent directly to it
- Data Storage: Images are processed in memory and not stored permanently
- Access Control: Only you can control the bot through your linked WhatsApp account

## Development

### Adding New Features

The bot is structured to be easily extensible:

1. Image Processing: Modify `sticker-processor.ts` for custom image effects
2. Message Handling: Extend the message handler in `index.ts`
3. Configuration: Update `types.ts` for new settings

### Code Style

- Uses TypeScript for type safety
- Follows modern ES6+ practices
- Implements error handling and logging
- Modular architecture for maintainability

## Dependencies

### Core Dependencies
- `@whiskeysockets/baileys` - WhatsApp Web API
- `sharp` - High-performance image processing
- `qrcode-terminal` - QR code display in terminal

### Development Dependencies
- `typescript` - TypeScript compiler
- `ts-node` - TypeScript execution for development
- `@types/node` - Node.js type definitions

## Railway Deployment

Deploy your bot to Railway for 24/7 operation.

### Prerequisites
- Railway account
- GitHub repository

### Deployment Process

**IMPORTANT:** Railway environment blocks QR code authentication. You must authenticate locally first.

#### Step 1: Local Authentication
```bash
# Run bot locally to authenticate
npm run dev

# Scan QR code with WhatsApp mobile app
# After successful connection, press Ctrl+C
```

#### Step 2: Deploy to Railway
```bash
# Temporarily allow auth files in git
cp .gitignore.deploy .gitignore

# Add authenticated session files
git add auth_info_baileys/
git commit -m "Add WhatsApp auth session for Railway"
git push origin main

# Restore original gitignore
git checkout .gitignore
```

#### Step 3: Railway Setup
1. Go to [Railway](https://railway.app)
2. Create new project from GitHub repository
3. Railway will deploy with existing authentication
4. Bot will be online 24/7

### Important Notes
- Authentication must be done locally first
- Never share auth files publicly (use private repo)
- Bot will maintain connection on Railway
- Redeploy if authentication expires

## License

MIT License - feel free to use this project for personal or commercial purposes.

For more advanced features or custom modifications, feel free to explore the source code and adapt it to your needs.