# AWS Setup Guide for Internoti

## 1. AWS Account Setup

If you don't have an AWS account:
1. Go to [AWS Console](https://aws.amazon.com/)
2. Click "Create an AWS Account"
3. Follow the signup process

## 2. Create an IAM User

1. Go to [IAM Console](https://console.aws.amazon.com/iam)
2. Click "Users" → "Add user"
3. Set up the user:
   - Username: `internoti-deployer`
   - Access type: ✓ Programmatic access
4. For permissions, attach these policies:
   - `AWSCloudFormationFullAccess`
   - `AmazonEC2FullAccess`
   - `AmazonSSMFullAccess`
   - `IAMFullAccess`
5. After creation, you'll get:
   - Access Key ID
   - Secret Access Key
   ⚠️ Save these immediately - you won't see the secret key again!

## 3. Configure AWS CLI

1. Install AWS CLI if not installed:
   ```bash
   # macOS (using Homebrew)
   brew install awscli

   # Windows (using official installer)
   # Download from: https://aws.amazon.com/cli/
   ```

2. Configure AWS CLI:
   ```bash
   aws configure
   ```
   Enter:
   - AWS Access Key ID: (from step 2)
   - AWS Secret Access Key: (from step 2)
   - Default region: us-west-2 (or your preferred region)
   - Default output format: json

## 4. Required Information

Save this information - you'll need it for deployment:

```
AWS Account ID: _____________ (12-digit number)
Region: __________________ (e.g., us-west-2)
Access Key ID: _____________ (from IAM user creation)
Secret Access Key: _________ (from IAM user creation)
```

## 5. Bootstrap CDK (First Time Only)

Once you have the credentials configured:

```bash
cd infrastructure
cdk bootstrap aws://<ACCOUNT-ID>/<REGION>
```

Example:
```bash
cdk bootstrap aws://123456789012/us-west-2
```

## 6. Verify Setup

Test your configuration:
```bash
# Should list your AWS account info
aws sts get-caller-identity

# Should show no errors
aws cloudformation describe-stacks
```

## Next Steps

Once you have all this information and verified the setup:

1. Store your secrets in Parameter Store:
   ```bash
   aws ssm put-parameter \
       --name "/internoti/intercom-token" \
       --value "your-intercom-token" \
       --type "SecureString"

   aws ssm put-parameter \
       --name "/internoti/telegram-token" \
       --value "your-telegram-token" \
       --type "SecureString"

   aws ssm put-parameter \
       --name "/internoti/telegram-group-id" \
       --value "your-telegram-group-id" \
       --type "SecureString"
   ```

2. Deploy the infrastructure:
   ```bash
   cd infrastructure
   cdk deploy -c repositoryUrl=https://github.com/your-username/internoti.git
   ```

## Common Issues

1. **"Unable to locate credentials"**
   - Run `aws configure` again
   - Check `~/.aws/credentials` exists

2. **"User is not authorized to perform action"**
   - Verify IAM user has correct policies
   - Check you're using correct AWS account

3. **"CDK bootstrap is required"**
   - Run the bootstrap command from step 5

4. **Region issues**
   - Ensure you're using the same region in:
     * AWS CLI configuration
     * CDK deployment
     * Parameter Store commands