#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
import 'source-map-support/register';
import { FrontendStack } from '../lib/frontend-stack';
import { RestApiStack } from '../lib/rest-api-stack';

/* If you don't specify 'env', this stack will be environment-agnostic.
 * Account/Region-dependent features and context lookups will not work,
 * but a single synthesized template can be deployed anywhere. */

/* Uncomment the next line to specialize this stack for the AWS Account
 * and Region that are implied by the current CLI configuration. */
// env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION };

/* Uncomment the next line if you know exactly what Account and Region you
 * want to deploy the stack to. */
// env: { account: '123456789012', region: 'us-east-1' },
const myEnv = { env: { account: '041555789870', region: 'us-east-1' } };

/* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
const app = new cdk.App();

// CDK-NAG security checks
// Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

const LOG_LEVEL = 'ERROR';


const restApiStack = new RestApiStack(app, 'RestApiStack', {
  logLevel: LOG_LEVEL,
  env: myEnv.env
});

const frontendStack = new FrontendStack(
  app,
  "BrandywineWebServices-FrontendStack",
  {
    cognitoDomainPrefix: "BWS-frontend", // Cognito domain prefix needs to be unique globally. Please fill in your domain prefix.,
    env: myEnv.env,
  },
  "../dist/"
);


NagSuppressions.addStackSuppressions(frontendStack, [
  {
    id: "AwsSolutions-L1",
    reason:
      "LambdaBasicExecutionRole has access to create and append to any CW log groups. Although this is not ideal, it does not pose a security risk for the sample.",
  },
  {
    id: "AwsSolutions-S1",
    reason:
      "Bucket access logs are disabled by design. It would incur unnecessary cost. Only static SPA files are stored in the bucket.",
  },
  {
    id: "AwsSolutions-S2",
    reason: "The bucket has public access blocked. (wrong error message?). It is only accessible via Cloudfront.",
  },
  { id: "AwsSolutions-S10", reason: "SSL is enforced in a resource policy." },
  { id: "AwsSolutions-CFR7", reason: "SSL is enforced in a resource policy." },
]);
// CDK-NAG rule supressions

NagSuppressions.addStackSuppressions(restApiStack, [
  {
    id: 'AwsSolutions-L1',
    reason:
      'LambdaBasicExecutionRole has access to create and append to any CW log groups. Although this is not ideal, it does not pose a security risk for the sample.',
  },
  {
    id: 'AwsSolutions-S1',
    reason:
      'Bucket access logs are disabled by design. It would incur unnecessary cost. Only static SPA files are stored in the bucket.',
  },
  {
    id: 'AwsSolutions-S2',
    reason: 'The bucket has public access blocked. (wrong error message?). It is only accessible via Cloudfront.',
  },
  { id: 'AwsSolutions-S10', reason: 'SSL is enforced in a resource policy.' },
  { id: 'AwsSolutions-CFR7', reason: 'SSL is enforced in a resource policy.' },
]);

