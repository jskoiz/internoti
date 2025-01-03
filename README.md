# Internoti

A Node.js-based notification bridge that connects Intercom customer chat messages to Telegram groups, enabling immediate team awareness of customer inquiries. Built with TypeScript and running as a containerized service on AWS.

## Core Features

- Intercom webhook processing with duplicate detection
- Message queue system with rate limiting and retries
- SQLite-based message tracking and deduplication
- Secure credential management via AWS Parameter Store
- Containerized deployment with Docker
- Infrastructure as Code using AWS CDK

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
- AWS CLI configured with appropriate permissions
- AWS CDK CLI (`npm install -g aws-cdk`)

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
- `INTERCOM_TOKEN`: Your Intercom access token
- `TELEGRAM_TOKEN`: Your Telegram bot token
- `TELEGRAM_GROUP_ID`: Target Telegram group ID

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
  --env-file .env \
  internoti
```

## AWS Deployment

1. Configure AWS Parameters:
```bash
aws ssm put-parameter --name "/internoti/intercom-token" --type "SecureString" --value "your-token"
aws ssm put-parameter --name "/internoti/telegram-token" --type "SecureString" --value "your-token"
aws ssm put-parameter --name "/internoti/telegram-group-id" --type "SecureString" --value "your-group-id"
```

2. Deploy infrastructure:
```bash
cd infrastructure
npm install
cdk deploy
```

See [AWS_SETUP.md](AWS_SETUP.md) for detailed AWS configuration steps.

## Maintenance

### Logs
- CloudWatch Logs for production monitoring
- Docker container logs: `docker logs internoti`
- Local development logs in `logs/` directory

### Database
SQLite database is stored in the container at `/app/data/messages.db`
- Backup: `docker cp internoti:/app/data/messages.db ./backup.db`
- Cleanup old records: Automatic based on retention policy

### Monitoring
- CloudWatch basic monitoring enabled
- Instance health checks via AWS EC2
- API rate limit monitoring for both Intercom and Telegram

## Security

- All credentials stored in AWS Parameter Store
- No direct SSH access - use AWS Systems Manager Session Manager
- Security group restrictions for EC2 instance
- IAM roles with minimal required permissions

## Technical Considerations

- Running on t3.micro EC2 instance (~$8-10/month)
- Uses ES Modules (ESM) - imports must use `.js` extension
- Automatic container restart on failure
- Rate limiting for both Intercom and Telegram APIs
- Message deduplication via SQLite
