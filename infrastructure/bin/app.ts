#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InternotiStack } from '../lib/internoti-stack';

const app = new cdk.App();

new InternotiStack(app, 'InternotiStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  },
  description: 'Infrastructure for Internoti - Intercom to Telegram notification bridge'
});