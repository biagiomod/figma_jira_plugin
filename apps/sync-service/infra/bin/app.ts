#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { SyncServiceStack } from '../lib/sync-service-stack'

const app = new cdk.App()

new SyncServiceStack(app, 'FigmaJiraSyncService', {
  env: {
    account: process.env['CDK_DEFAULT_ACCOUNT'],
    region: process.env['CDK_DEFAULT_REGION'] ?? 'us-east-1',
  },
  description: 'Figma for Jira DC — internal sync service (Lambda + RDS + S3)',
})
