# Internoti

A Node.js-based notification bridge that connects Intercom customer chat messages to Telegram groups, enabling immediate team awareness of customer inquiries. Built with TypeScript and running as a containerized service.

## Core Features

- Intercom webhook processing with duplicate detection
- Message queue system with rate limiting and retries
- SQLite-based message tracking and deduplication
- Environment-based configuration
- Containerized deployment with Docker
- Support for both regular and forum Telegram groups

## Architecture

```
src/
├── bot/              # Telegram bot and queue management
├── config/           # Environment and configuration
├── db/               # SQLite message store
├── intercom/         # Intercom client and webhook handling
├── types/           # TypeScript type definitions
├── utils/           # Shared utilities
└── webhook/         # Webhook server implementation
```

## Prerequisites

- Node.js (Latest LTS)
- Docker
- A VPS with Docker installed

## Local Development Setup

1. Clone the repository:
```bash
git clone [repository-url]
cd internoti
```

2. Install dependencies:
```bash
npm install
```

3. Create a local `.env` file:
```bash
cp .env.example .env
# Edit .env with your credentials
```

Required environment variables:
- `INTERCOM_ACCESS_TOKEN`: Your Intercom access token
- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
- `TELEGRAM_GROUP_ID`: Target Telegram group ID
- `WEBHOOK_SECRET`: Secret for webhook validation
- `NODE_ENV`: Set to 'production' in production
- `LOG_LEVEL`: Logging level (error, warn, info, debug)

Optional environment variables:
- `TELEGRAM_TOPIC_ID`: Topic ID for forum groups
- `WEBHOOK_URL`: Webhook URL (for development)
- `WEBHOOK_PORT`: Port for webhook server (default: 3000)

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm run start
```

### Docker Build & Run
```bash
docker build -t internoti .
docker run -d --name internoti \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  internoti
```

## VPS Deployment

### Manual Deployment

1. Set up your VPS:
   - Install Docker
   - Configure firewall to allow port 3000
   - Set up SSL/TLS termination (recommended)

2. Create production environment file:
```bash
# On your VPS
mkdir -p /opt/internoti
nano /opt/internoti/.env
# Add your production environment variables
```

3. Pull and run the container:
```bash
docker pull your-registry/internoti:latest
docker run -d \
  --name internoti \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file /opt/internoti/.env \
  your-registry/internoti:latest
```

### GitHub Actions Deployment

The project includes automated deployment via GitHub Actions. To set it up:

1. Add the following secrets to your GitHub repository:
   - `VPS_HOST`: Your VPS hostname/IP
   - `VPS_USERNAME`: SSH username
   - `VPS_SSH_KEY`: SSH private key
   - `INTERCOM_ACCESS_TOKEN`: Intercom access token
   - `TELEGRAM_BOT_TOKEN`: Telegram bot token
   - `TELEGRAM_GROUP_ID`: Telegram group ID
   - `WEBHOOK_SECRET`: Webhook secret

2. Push to main branch to trigger deployment

## FAQ

What I Do:
• Forward Intercom messages to Telegram

## Maintenance

### Logs
- Docker container logs: `docker logs internoti`
- Local development logs in `logs/` directory

### Database
SQLite database is stored in the container at `/app/data/messages.db`
- Backup: `docker cp internoti:/app/data/messages.db ./backup.db`
- Cleanup old records: Automatic based on retention policy

### Monitoring
- Container health monitoring
- API rate limit monitoring for both Intercom and Telegram

## Security

- Environment variables for sensitive configuration
- No hardcoded credentials
- Webhook validation
- Regular security updates
- SSL/TLS termination recommended

## Technical Considerations

- Uses ES Modules (ESM) - imports must use `.js` extension
- Automatic container restart on failure
- Rate limiting for both Intercom and Telegram APIs
- Message deduplication via SQLite
- Stateless application design
- Data persistence through Docker volumes (optional)## Test Deployment
## Test Deployment 2
