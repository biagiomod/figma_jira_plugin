import * as cdk from 'aws-cdk-lib'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import * as iam from 'aws-cdk-lib/aws-iam'
import { type Construct } from 'constructs'
import * as path from 'path'

/**
 * Main CDK stack for the figma-jira sync service.
 *
 * Resources created:
 *   - S3 bucket (private): thumbnail cache
 *   - Secrets Manager secret: all runtime secrets (Figma token, DB creds, API key, webhook passcode)
 *   - API Gateway (REST): api-handler + webhook-handler Lambdas
 *   - Lambda: api-handler (synchronous, user-facing)
 *   - Lambda: webhook-handler (Figma push events)
 *   - Lambda: polling-sync (EventBridge cron)
 *   - EventBridge rule: triggers polling-sync on schedule
 *
 * RDS (PostgreSQL): NOT provisioned here — use your existing RDS instance
 * or create one separately. Set the connection string in the Secrets Manager secret.
 *
 * TODO before deploying:
 *   1. Create (or reference) an RDS PostgreSQL instance in your VPC
 *   2. Place Lambdas in the same VPC/subnet as RDS
 *   3. Add VPC configuration to each Lambda (vpc, vpcSubnets, securityGroups)
 *   4. Set WEBHOOK_ENDPOINT_URL env var to the actual API Gateway invoke URL
 *   5. Populate the Secrets Manager secret with real values
 *   6. Configure POLLING_INTERVAL_MINUTES to your desired sync cadence
 */
export class SyncServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // -----------------------------------------------------------------------
    // S3 — private thumbnail bucket
    // -----------------------------------------------------------------------

    const thumbnailBucket = new s3.Bucket(this, 'ThumbnailBucket', {
      bucketName: `figma-jira-thumbnails-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          // Clean up thumbnails for deleted links after 90 days
          // TODO: Replace with a more targeted cleanup (by S3 key prefix when link is deleted)
          expiration: cdk.Duration.days(90),
          prefix: 'thumbnails/',
        },
      ],
    })

    // -----------------------------------------------------------------------
    // Secrets Manager — single secret for all runtime credentials
    // -----------------------------------------------------------------------

    const secret = new secretsmanager.Secret(this, 'SyncServiceSecret', {
      secretName: 'figma-jira/sync-service',
      description: 'Runtime secrets for figma-jira sync service',
      // Secret value must be set manually after deployment:
      // {
      //   "figmaServiceToken": "...",
      //   "dbConnectionString": "postgres://...",
      //   "syncServiceApiKey": "...",
      //   "figmaWebhookPasscode": "..."
      // }
    })

    // -----------------------------------------------------------------------
    // Common Lambda configuration
    // -----------------------------------------------------------------------

    const lambdaDir = path.join(__dirname, '..', '..', 'src')

    const commonEnv: Record<string, string> = {
      SECRETS_MANAGER_SECRET_NAME: secret.secretName,
      THUMBNAIL_BUCKET_NAME: thumbnailBucket.bucketName,
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      // WEBHOOK_ENDPOINT_URL: set this to the WebhookUrl CDK output value after first deploy.
      // Steps: 1) deploy, 2) copy WebhookUrl output, 3) set this value, 4) redeploy.
      // The api-handler and polling-sync use this to register Figma webhooks.
      WEBHOOK_ENDPOINT_URL: '',
    }

    const commonLambdaProps: Partial<nodejs.NodejsFunctionProps> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      bundling: {
        format: nodejs.OutputFormat.ESM,
        target: 'node20',
        externalModules: ['pg-native'],
      },
      // TODO: Add VPC configuration once RDS is provisioned
      // vpc: yourVpc,
      // vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    }

    // -----------------------------------------------------------------------
    // Lambda: api-handler
    // -----------------------------------------------------------------------

    const apiHandlerFn = new nodejs.NodejsFunction(this, 'ApiHandler', {
      ...commonLambdaProps,
      entry: path.join(lambdaDir, 'handlers', 'api-handler.ts'),
      handler: 'handler',
      functionName: 'figma-jira-api-handler',
      description: 'Figma-Jira: synchronous REST operations (link CRUD, parse, signed URLs)',
      environment: commonEnv,
    })

    thumbnailBucket.grantReadWrite(apiHandlerFn)
    secret.grantRead(apiHandlerFn)

    // -----------------------------------------------------------------------
    // Lambda: webhook-handler
    // -----------------------------------------------------------------------

    const webhookHandlerFn = new nodejs.NodejsFunction(this, 'WebhookHandler', {
      ...commonLambdaProps,
      entry: path.join(lambdaDir, 'handlers', 'webhook-handler.ts'),
      handler: 'handler',
      functionName: 'figma-jira-webhook-handler',
      description: 'Figma-Jira: Figma webhook event intake',
      environment: commonEnv,
    })

    thumbnailBucket.grantReadWrite(webhookHandlerFn)
    secret.grantRead(webhookHandlerFn)

    // -----------------------------------------------------------------------
    // Lambda: polling-sync (EventBridge cron)
    // -----------------------------------------------------------------------

    const pollingSyncFn = new nodejs.NodejsFunction(this, 'PollingSync', {
      ...commonLambdaProps,
      entry: path.join(lambdaDir, 'handlers', 'polling-sync.ts'),
      handler: 'handler',
      functionName: 'figma-jira-polling-sync',
      description: 'Figma-Jira: periodic sync sweep and webhook deregistration',
      timeout: cdk.Duration.minutes(10),  // Longer timeout for batch processing
      environment: {
        ...commonEnv,
        POLLING_INTERVAL_MINUTES: '30',
      },
    })

    thumbnailBucket.grantReadWrite(pollingSyncFn)
    secret.grantRead(pollingSyncFn)

    // EventBridge rule — triggers polling-sync every 30 minutes
    const pollingRule = new events.Rule(this, 'PollingSchedule', {
      ruleName: 'figma-jira-polling-schedule',
      description: 'Trigger figma-jira polling-sync Lambda every 30 minutes',
      schedule: events.Schedule.rate(cdk.Duration.minutes(30)),
    })
    pollingRule.addTarget(new targets.LambdaFunction(pollingSyncFn))

    // -----------------------------------------------------------------------
    // API Gateway
    // -----------------------------------------------------------------------

    const api = new apigateway.RestApi(this, 'SyncServiceApi', {
      restApiName: 'figma-jira-sync-service',
      description: 'Figma for Jira DC — sync service REST API',
      deployOptions: {
        stageName: 'v1',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: false,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: undefined,  // No CORS — Jira plugin proxies all calls
    })

    // API key for Jira plugin → sync service trust
    const apiKey = new apigateway.ApiKey(this, 'JiraPluginApiKey', {
      apiKeyName: 'figma-jira-plugin-key',
      description: 'API key for Jira DC plugin to sync service communication',
    })

    const usagePlan = new apigateway.UsagePlan(this, 'UsagePlan', {
      name: 'figma-jira-usage-plan',
      apiStages: [{ api, stage: api.deploymentStage }],
    })
    usagePlan.addApiKey(apiKey)

    const apiHandlerIntegration = new apigateway.LambdaIntegration(apiHandlerFn)
    const webhookIntegration = new apigateway.LambdaIntegration(webhookHandlerFn)

    // POST /links/parse
    const linksResource = api.root.addResource('links')
    const parseResource = linksResource.addResource('parse')
    parseResource.addMethod('POST', apiHandlerIntegration, { apiKeyRequired: true })

    // /issues/{issueKey}/links
    const issuesResource = api.root.addResource('issues')
    const issueKeyResource = issuesResource.addResource('{issueKey}')
    const issueLinksResource = issueKeyResource.addResource('links')

    issueLinksResource.addMethod('GET', apiHandlerIntegration, { apiKeyRequired: true })
    issueLinksResource.addMethod('POST', apiHandlerIntegration, { apiKeyRequired: true })

    // /issues/{issueKey}/links/{linkId}
    const linkIdResource = issueLinksResource.addResource('{linkId}')
    linkIdResource.addMethod('DELETE', apiHandlerIntegration, { apiKeyRequired: true })

    // /issues/{issueKey}/links/{linkId}/status
    const statusResource = linkIdResource.addResource('status')
    statusResource.addMethod('PATCH', apiHandlerIntegration, { apiKeyRequired: true })

    // /issues/{issueKey}/links/{linkId}/sync
    const syncResource = linkIdResource.addResource('sync')
    syncResource.addMethod('POST', apiHandlerIntegration, { apiKeyRequired: true })

    // POST /webhooks/figma — NO API key requirement (Figma servers call this)
    const webhooksResource = api.root.addResource('webhooks')
    const figmaWebhookResource = webhooksResource.addResource('figma')
    figmaWebhookResource.addMethod('POST', webhookIntegration, { apiKeyRequired: false })

    // -----------------------------------------------------------------------
    // Stack outputs
    // -----------------------------------------------------------------------

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'API Gateway invoke URL — configure this in Jira plugin admin settings',
    })

    new cdk.CfnOutput(this, 'WebhookUrl', {
      value: `${api.url}webhooks/figma`,
      description: 'Figma webhook endpoint — register this in Figma webhook settings',
    })

    new cdk.CfnOutput(this, 'ThumbnailBucketName', {
      value: thumbnailBucket.bucketName,
      description: 'S3 bucket for cached thumbnails',
    })

    new cdk.CfnOutput(this, 'SecretArn', {
      value: secret.secretArn,
      description: 'Secrets Manager ARN — populate with runtime credentials before deploying',
    })

    new cdk.CfnOutput(this, 'ApiKeyId', {
      value: apiKey.keyId,
      description: 'API key ID — retrieve value from AWS console for Jira plugin config',
    })
  }
}
