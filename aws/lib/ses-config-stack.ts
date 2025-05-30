/* eslint-disable no-new */
import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { AnyPrincipal, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import {
    HostedZoneAttributes, IHostedZone
} from 'aws-cdk-lib/aws-route53';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { join } from 'path';


interface SesConfigStackProps extends StackProps {
    sesAttr?: {
        emailList: string[],
        notifList: string[],
        sendDeliveryNotifications: boolean,
    },
    domainAttr?: HostedZoneAttributes,
}

/**
 * Configures SES domain and verified email addresses.
 * A Route53 Domain in the same Account is required.
 *
 * @param {Construct} scope
 * @param {string} id
 * @param {StackProps=} props
 */
export class SesConfigStack extends Stack {
    zone: IHostedZone;

    constructor(scope: Construct, id: string, props: SesConfigStackProps) {
        super(scope, id, props);

        console.log('Stack Name: ', this.stackName);

        const sharedLambdaProps: NodejsFunctionProps = {
            bundling: {
                externalModules: [
                ],
                nodeModules: [
                    '@aws-lambda-powertools/logger',
                    '@aws-lambda-powertools/tracer',
                    'aws-jwt-verify'
                ],
            },
            depsLockFilePath: join(__dirname, '../resources/', 'package-lock.json'),
            environment: {
            },
            runtime: Runtime.NODEJS_LATEST,
            memorySize: 256
        }










        // {
        //     "Sid": "AllowSESPuts",
        //     "Effect": "Allow",
        //     "Principal": {
        //         "Service": "ses.amazonaws.com"
        //     },
        //     "Action": "s3:PutObject",
        //     "Resource": "arn:aws:s3:::BUCKEN_NAME/*",
        //     "Condition": {
        //      "StringEquals": {
        //             "aws:Referer": "YOUR ID"
        //          }
        //     }
        // }

        // Admin Email bucket
        const adminEmailBucket = new s3.Bucket(this, 'AdminEmailBucket', {
            publicReadAccess: false,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: RemovalPolicy.RETAIN, // NOT recommended for production use
            autoDeleteObjects: false, // NOT recommended for production use
            
        });
        adminEmailBucket.addToResourcePolicy(new PolicyStatement({
            effect: Effect.DENY,
            principals: [
                new AnyPrincipal(),
            ],
            actions: [
                "s3:*"
            ],
            resources: [adminEmailBucket.bucketArn],
            conditions: {
                "Bool": { "aws:SecureTransport": "false" },
            },
        }));
        adminEmailBucket.addToResourcePolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            principals: [
                new AnyPrincipal(),
            ],
            actions: [
                "s3:*"
            ],
            resources: [adminEmailBucket.bucketArn],
        }));




        const forwardEmailToS3Lambda = new NodejsFunction(this, 'forwardEmailToS3Function', {
            entry: join(__dirname, `/../resources/handlers/email/`, 'forward-to-s3.ts'),
            ...sharedLambdaProps,
        });

        forwardEmailToS3Lambda.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["s3:*"],
                resources: [adminEmailBucket.bucketArn],
            })
        );

     
    }
}