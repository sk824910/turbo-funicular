// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import {
  CacheCookieBehavior,
  CacheHeaderBehavior,
  CachePolicy,
  CacheQueryStringBehavior,
  SecurityPolicyProtocol,
} from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import { AnyPrincipal, Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";

export interface FrontendProps extends StackProps {
  cognitoDomainPrefix: string;
}

export class FrontendStack extends Stack {
  constructor(scope: Construct, id: string, props?: FrontendProps, path: string = "../../UI/dist/websocket-chat") {
    super(scope, id, props);

    const cloudfrontOAI = new cloudfront.OriginAccessIdentity(this, "cloudfront-OAI", { comment: `OAI for ${id}` });

    // Content bucket
    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production use
      autoDeleteObjects: true, // NOT recommended for production use
    });
    siteBucket.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.DENY,
        principals: [new AnyPrincipal()],
        actions: ["s3:*"],
        resources: [siteBucket.bucketArn],
        conditions: {
          Bool: { "aws:SecureTransport": "false" },
        },
      }),
    );

    // Grant access to cloudfront
    siteBucket.addToResourcePolicy(
      new PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [siteBucket.arnForObjects("*")],
        principals: [new iam.CanonicalUserPrincipal(cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId)],
      }),
    );
    new CfnOutput(this, "Bucket", { value: siteBucket.bucketName });

    const distribution = new cloudfront.Distribution(this, "SiteDistribution", {
      defaultBehavior: {
        // Default to S3 bucket
        origin: new origins.S3Origin(siteBucket, { originAccessIdentity: cloudfrontOAI }),
        compress: true,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      },
      defaultRootObject: "index.html",
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
      errorResponses: [
        { responsePagePath: "/error.html", httpStatus: 404, responseHttpStatus: 404 },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.minutes(1),
        },
      ],
    });

    
    NagSuppressions.addResourceSuppressions(
      distribution,
      [
        {
          id: "AwsSolutions-CFR3",
          reason: "Access logging is disabled to save cost. It can be re-enabled by uncommenting the code above.",
        },
        {
          id: "AwsSolutions-CFR4",
          reason: "TLSv1.1 or TLSv1.2 can be only enforced using a custom certificate with a custom domain alias.",
        },
      ],
      true,
    );

    // Custom Cloudfront cache policy to forward Authorization header
    const cachePolicy = new CachePolicy(this, "CachePolicy", {
      headerBehavior: CacheHeaderBehavior.allowList("Authorization"),
      cookieBehavior: CacheCookieBehavior.none(),
      queryStringBehavior: CacheQueryStringBehavior.none(),
      enableAcceptEncodingBrotli: true,
      enableAcceptEncodingGzip: true,
      minTtl: Duration.seconds(1),
      maxTtl: Duration.seconds(10),
      defaultTtl: Duration.seconds(5),
    });

    // Upload the pre-compiled frontend static files
    new BucketDeployment(this, `DeployApp-${new Date().toISOString()}`, {
      sources: [Source.asset(path)],
      destinationBucket: siteBucket,
      distribution: distribution,
      distributionPaths: ["/"],
    });

    new CfnOutput(this, "DistributionId", { value: distribution.distributionId });
    new CfnOutput(this, "DistributionURL", { value: distribution.distributionDomainName });
  }
}
