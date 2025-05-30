


// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Logger } from '@aws-lambda-powertools/logger';
import { LambdaInterface } from '@aws-lambda-powertools/commons';
const { LOG_LEVEL } = process.env
const logger = new Logger({ serviceName: 'websocketMessagingService', logLevel: LOG_LEVEL });
const tracer = new Tracer({ serviceName: 'websocketMessagingService' });
const AWS = tracer.captureAWS(require('aws-sdk'));
const s3 = tracer.captureAWSClient(new AWS.S3({ signatureVersion: 'v4'}));
const simpleParser = require('mailparser').simpleParser;

const EMAIL_BUCKET = process.env.EMAIL_BUCKET || '';

// Change this value to adjust the signed URL's expiration
const URL_EXPIRATION_SECONDS = 300


class Lambda implements LambdaInterface {
    @tracer.captureLambdaHandler()
    public async handler(event: any, context: any): Promise<APIGatewayProxyResult> {

        let response: APIGatewayProxyResult = { statusCode: 200, body: "" };

        if (!event.body) {
            return { statusCode: 400, body: 'invalid request, you are missing the parameter body' };
        }
        const body = typeof event.body == 'object' ? event.body : JSON.parse(event.body);

        logger.addContext(context);

        const Key = body.Key
        const ContentType = body.ContentType

        // Get signed URL from S3
        const s3Params = {
            Bucket: EMAIL_BUCKET,
            Key,
            Expires: URL_EXPIRATION_SECONDS,
            ContentType

            // This ACL makes the uploaded object publicly readable. You must also uncomment
            // the extra permission for the Lambda function in the SAM template.

            // ACL: 'public-read'
        }

        console.log('Params: ', s3Params)
        const uploadURL = await s3.getSignedUrlPromise('putObject', s3Params)

        response.body = JSON.stringify({
            uploadURL: uploadURL,
            Key
        })
        return response

    }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;