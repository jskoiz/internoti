# Security Policy

## Sensitive Information Protection

### 🚫 Never Commit These Files
- `.env` files containing environment variables
- Database files (*.db, *.sqlite)
- Private keys or certificates
- AWS credentials
- Any files containing tokens or secrets

### ✅ Proper Handling of Secrets
1. **Environment Variables**
   - Always use `.env` for local development
   - Never commit `.env` files
   - Use AWS Parameter Store in production
   ```bash
   # Example .env structure (DO NOT COMMIT THIS!)
   INTERCOM_ACCESS_TOKEN=your_token_here
   TELEGRAM_BOT_TOKEN=your_token_here
   TELEGRAM_GROUP_ID=your_group_id_here
   ```

2. **AWS Secrets**
   - Store all secrets in AWS Systems Manager Parameter Store
   - Use IAM roles for EC2 access
   - Never hardcode AWS credentials
   - Never commit AWS credentials

3. **Database**
   - SQLite database files are ignored by git
   - Ensure backups don't contain sensitive data
   - Never commit database files

## Security Best Practices

### Repository Security
1. **Before Pushing to Remote**
   - Check for secrets in all files
   - Verify .gitignore is working
   - Run `git status` to check tracked files
   - Review `git diff` before commits

2. **If Secrets Are Accidentally Committed**
   - Immediately rotate all exposed credentials
   - Use `git filter-branch` to remove secrets from history
   - Force push changes (coordinate with team)

### AWS Security
1. **IAM Best Practices**
   - Use least-privilege permissions
   - Regularly rotate credentials
   - Enable MFA for AWS accounts
   - Review IAM roles regularly

2. **EC2 Security**
   - Use security groups with minimal access
   - Keep system updated
   - Monitor logs for suspicious activity
   - Use Systems Manager Session Manager instead of SSH

### Application Security
1. **Environment Configuration**
   - Use Parameter Store in production
   - Keep .env files local only
   - Validate environment variables on startup
   - Log configuration issues (without sensitive data)

2. **Runtime Security**
   - Sanitize all input data
   - Use HTTPS for API calls
   - Implement rate limiting
   - Handle errors securely (no stack traces in production)

## Security Checks

### Pre-Deployment Checklist
1. ✅ Verify .gitignore is properly configured
2. ✅ Check no secrets in committed files
3. ✅ Confirm AWS Parameter Store setup
4. ✅ Review security group rules
5. ✅ Validate IAM roles and permissions

### Regular Security Tasks
1. Review AWS CloudTrail logs
2. Monitor EC2 instance metrics
3. Update dependencies regularly
4. Rotate credentials periodically
5. Review security group rules

## Reporting Security Issues

If you discover any security issues:
1. Do not create a public GitHub issue
2. Document the issue privately
3. Contact the maintainers immediately
4. Keep the issue confidential until resolved

## Questions or Concerns?

For any security-related questions or concerns:
1. Review this security documentation
2. Check AWS security best practices
3. Consult with the team
4. When in doubt, ask before committing