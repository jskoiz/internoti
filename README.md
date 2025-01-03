# Internoti

A notification bridge between Intercom and Telegram. This service monitors Intercom for new customer chat messages and forwards them to a specified Telegram group.

## Features

- Monitors Intercom for new customer messages
- Sends formatted notifications to a Telegram group
- Configurable polling interval
- Comprehensive error handling and logging
- TypeScript-based for type safety

## Prerequisites

- Node.js (Latest LTS version)
- npm or yarn
- Intercom Access Token
- Telegram Bot Token
- Telegram Group ID

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd internoti
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following content:
```env
INTERCOM_ACCESS_TOKEN=your_intercom_token
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_GROUP_ID=your_telegram_group_id
LOG_LEVEL=info
INTERCOM_POLL_INTERVAL=30000
```

## Development

Start the development server with auto-reload:
```bash
npm run dev
```

## Building

Build the TypeScript code:
```bash
npm run build
```

## Production

Start the production server:
```bash
npm start
```

## Scripts

- `npm run build` - Build the TypeScript code
- `npm start` - Start the production server
- `npm run dev` - Start development server with auto-reload
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Project Structure

```
src/
├── bot/
│   └── telegramBot.ts    # Telegram bot implementation
├── intercom/
│   └── intercomClient.ts # Intercom client implementation
├── utils/
│   └── logger.ts         # Logging utility
└── index.ts              # Application entry point
```

## Error Handling

The application includes comprehensive error handling:
- Validation of environment variables
- API error handling for both Intercom and Telegram
- Graceful shutdown handling
- Detailed error logging

## Logging

Logs are written to:
- Console (all levels)
- error.log (error level)
- combined.log (all levels)

## License

ISC