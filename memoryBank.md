# Memory Bank

## 1. Product Context

### Purpose
- Bridge between Intercom and Telegram for notifications
- Monitor Intercom for new customer chat messages
- Send notifications to Telegram group
- Enable quick response awareness for customer service teams

### Problems Solved
- Response Time Optimization
- Platform Independence (Intercom notifications in Telegram)
- Customer Service Enhancement
- Reduced missed inquiries

### Functionality
- Intercom Integration (monitoring, message extraction)
- Telegram Integration (group messaging, formatting)
- Continuous background service operation
- Error handling and secure connections

## 2. Active Context

### Current Work
- Task: Webhook configuration and VPS deployment
- Previous state: Custom domain webhook endpoint
- Current state: Using webhook.site for reliable webhook handling

### Recent Changes
- Migrated from custom domain to webhook.site
- Deployed to VPS using PM2 process manager
- Enhanced Telegram Integration (forum groups support)
- Message tracking system with SQLite
- Enhanced user identification and webhook handling

### Next Steps
1. Monitor webhook.site integration:
   - Verify webhook event processing
   - Monitor message delivery reliability
   - Track system performance
2. VPS Optimization:
   - Fine-tune PM2 configuration
   - Implement monitoring
   - Setup automated backups
   - Configure system alerts

### Source of Truth
Current implementation uses:
- VPS hosting with PM2 process management
- SQLite for message tracking
- Webhook.site (https://webhook.site/023754cc-5544-4b3c-b37b-6ce48707912a) for Intercom integration
- Environment-based configuration

## 3. System Patterns

### Architecture
- Modular, event-driven design
- Clear separation of concerns
- Core components:
  1. Intercom Client Module
  2. Webhook Server Module
  3. Telegram Bot Module
  4. Message Store Module
  5. Main Application

### Technical Decisions
- Node.js & TypeScript
- SQLite for message tracking
- Environment variables for configuration
- PM2 for process management
- ESLint for code quality

### Design Patterns
- Dependency Injection
- Event-Driven Architecture
- Repository Pattern
- Factory Pattern
- Singleton Pattern

## 4. Technical Context

### Technologies Used
- Node.js (Latest stable)
- TypeScript
- PM2 Process Manager
- SQLite
- ESLint & Prettier
- dotenv

### Development Setup
- TypeScript configuration
- ESM modules
- Development scripts
- Linting and formatting rules
- PM2 ecosystem configuration

### Technical Constraints
1. API Limitations
   - Intercom API rate limits
   - Telegram API rate limits
   - Service outage handling

2. Security Requirements
   - Secure credential storage
   - No sensitive data in logs
   - Secure error handling
   - Minimal permissions

3. Performance Considerations
   - Efficient message polling
   - Connection pooling
   - Resource optimization
   - Process management and monitoring

## 5. Progress Status

### Completed Features
- Intercom webhook integration via webhook.site
- Telegram message delivery
- Message tracking system
- User identification
- Forum groups support
- VPS deployment with PM2
- Environment-based configuration

### Pending Tasks
1. Monitoring Setup:
   - System resource monitoring
   - Webhook reliability tracking
   - Error rate monitoring
   - Performance metrics collection

2. VPS Optimization:
   - Backup strategy
   - Alert system
   - Resource usage optimization
   - Security hardening

### Progress Metrics
- Core functionality complete
- Webhook.site integration successful
- VPS deployment complete
- PM2 process management configured
- Documentation updated

## 6. Logging Standards

### Logging Framework
- Winston logger
- JSON format
- Timestamps and metadata

### Log Levels
- DEBUG: Detailed debugging
- INFO: General operational
- WARN: Warning conditions
- ERROR: Error conditions

### Log Format
```json
{
  "timestamp": "ISO-8601",
  "level": "INFO|WARN|ERROR",
  "message": "Description",
  "metadata": {
    "type": "notification_type",
    "userId": "user_identifier",
    "additional": "context"
  }
}
```

### Best Practices
- Meaningful messages
- No sensitive data
- Consistent structure
- Comprehensive error context
- Performance consideration