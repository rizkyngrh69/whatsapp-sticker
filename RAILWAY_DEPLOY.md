# WhatsApp Sticker Bot - Railway Deployment

This project is configured for deployment on Railway.

## Features Added:
- Comprehensive help system with multiple commands
- Interactive command handling
- Better error messages and user feedback
- Status monitoring and bot information
- Processing time tracking
- Enhanced image processing with quality optimization
- Multiple greeting responses
- Sticker creation tips and guidelines

## Available Commands:
- `/start` or `start` - Welcome message and quick guide
- `/help` or `help` - Complete help guide  
- `/commands` or `commands` - List all available commands
- `/info` or `info` - Bot information and features
- `/status` or `status` - Check bot operational status
- `/tips` or `tips` - Image optimization tips
- `ping` - Test bot responsiveness
- `hello`/`hi`/`hey` - Greeting messages
- `thanks`/`thank` - Appreciation responses

## Deployment Instructions:

### 1. Railway Setup
1. Create account at [Railway.app](https://railway.app)
2. Connect your GitHub repository
3. Deploy from the repository

### 2. First Time Setup
1. Check Railway logs for QR code
2. Scan QR code with your WhatsApp
3. Bot will stay connected permanently

### 3. Environment Variables (Optional)
- `PORT` - Automatically set by Railway
- `NODE_ENV` - Set to 'production'

### 4. Persistence
The bot uses file-based authentication storage that persists between deployments on Railway's persistent disk.

## Local Development:
```bash
npm install
npm run dev
```

## Production Build:
```bash
npm run build
npm start
```