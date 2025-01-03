#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InternotiStack } from '../lib/internoti-stack';

const app = new cdk.App();

// Get repository URL from context or fail with a helpful message
const repositoryUrl = app.node.tryGetContext('repositoryUrl');
if (!repositoryUrl) {
  throw new Error(
    'Repository URL must be provided via context. Use: cdk deploy -c repositoryUrl=<your-repo-url>'
  );
}

new InternotiStack(app, 'InternotiStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-west-2'
  },
  description: 'Infrastructure for Internoti - Intercom to Telegram notification bridge',
  repositoryUrl
});