# Internoti AWS Infrastructure

This directory contains the AWS CDK infrastructure code for deploying Internoti to AWS EC2.

## Prerequisites

1. AWS CLI installed and configured with appropriate credentials
2. Node.js and npm installed
3. AWS CDK CLI installed (`npm install -g aws-cdk`)
4. Git repository set up with your Internoti code

## Security Setup

### 1. Environment Variables
Before deployment, store the following secrets in AWS Systems Manager Parameter Store:

```bash
# Store Intercom access token
aws ssm put-parameter \
    --name "/internoti/intercom-token" \
    --value "your-intercom-token" \
    --type "SecureString"

# Store Telegram bot token
aws ssm put-parameter \
    --name "/internoti/telegram-token" \
    --value "your-telegram-token" \
    --type "SecureString"

# Store Telegram group ID
aws ssm put-parameter \
    --name "/internoti/telegram-group-id" \
    --value "your-telegram-group-id" \
    --type "SecureString"
```

### 2. Repository Security
1. Ensure your repository does not contain any secrets:
   - Check .gitignore includes .env and other sensitive files
   - Use .env.example for environment variable templates
   - Never commit actual credentials
   - Review git history for any leaked secrets

2. If using a private repository:
   - Set up deployment keys if needed
   - Use HTTPS clone URL for better security

## Deployment Steps

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the TypeScript code:
   ```bash
   npm run build
   ```

3. Bootstrap CDK (first time only):
   ```bash
   cdk bootstrap
   ```

4. Deploy the stack with your repository URL:
   ```bash
   cdk deploy -c repositoryUrl=https://github.com/your-username/internoti.git
   ```

## Infrastructure Components

The deployment creates:

- EC2 instance (t3.micro) running Amazon Linux 2
- Security group for the instance
- IAM role with permissions to access Parameter Store
- User data script to set up Docker and the application

## Security Features

1. **Access Control**
   - Uses Systems Manager Session Manager (no SSH needed)
   - Minimal IAM permissions
   - Security group with restricted access

2. **Secret Management**
   - All secrets in Parameter Store
   - No hardcoded credentials
   - Secure environment configuration

3. **Network Security**
   - Default VPC used for simplicity
   - Only necessary outbound access
   - No inbound access required

## Monitoring

- EC2 instance metrics in CloudWatch
- System logs via CloudWatch agent
- Instance health checks

## Accessing the Instance

Connect using AWS Systems Manager Session Manager:

```bash
aws ssm start-session --target i-1234567890abcdef0
```

## Updating the Application

To deploy updates:

1. Push changes to your repository
2. Connect to the instance
3. Pull and rebuild:
   ```bash
   cd /home/ec2-user/internoti
   git pull
   docker build -t internoti .
   docker stop internoti
   docker rm internoti
   docker run -d --restart unless-stopped --name internoti internoti
   ```

## Cleanup

To remove all resources:

```bash
cdk destroy
```

## Security Notes

- All sensitive information is stored in AWS Systems Manager Parameter Store
- Instance runs in a security group with minimal access
- Uses IAM roles for secure access to AWS services
- No SSH key required (uses Session Manager)
- Docker container runs with minimal privileges

## Cost Optimization

The infrastructure uses:
- t3.micro instance (~$8-10/month)
- Default VPC (no additional cost)
- Systems Manager Parameter Store (free tier)

## Troubleshooting

1. **Deployment Issues**
   - Verify AWS credentials are configured
   - Check CDK bootstrap status
   - Verify repository URL is accessible

2. **Runtime Issues**
   - Check CloudWatch logs
   - Verify Parameter Store values
   - Check Docker container logs

3. **Security Issues**
   - Review security group rules
   - Check IAM role permissions
   - Verify secret access