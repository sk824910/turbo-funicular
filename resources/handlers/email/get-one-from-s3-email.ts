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
const s3 = tracer.captureAWSClient(new AWS.S3({ apiVersion: '2006-03-01' }));
const simpleParser = require('mailparser').simpleParser;

const EMAIL_BUCKET = process.env.EMAIL_BUCKET || '';

class Lambda implements LambdaInterface {
    @tracer.captureLambdaHandler()
    public async handler(event: any, context: any): Promise<APIGatewayProxyResult> {

        let response: APIGatewayProxyResult = { statusCode: 200, body: "" };

        if (!event.body) {
            return { statusCode: 400, body: 'invalid request, you are missing the parameter body' };
        }
        const body = typeof event.body == 'object' ? event.body : JSON.parse(event.body);

        logger.addContext(context);
        // console.log('getting email from S3\n this is the event!!!! \n', { event })
        var params = {
            Bucket: EMAIL_BUCKET,
            Key: body.Key
        }

        console.log("Checkpoint 1");

        let s3Objects

        try {
            s3Objects = await s3.getObject(params).promise();
            console.log(s3Objects)
        } catch (e) {
            console.log(e)
        }


        console.log("Checkpoint 2");
        let buff64, buffAscii
        let data = s3Objects?.Body;

        console.log({ data })

        buff64 = Buffer.from(data, 'base64')
        let parsed = await simpleParser(buff64);

        console.log("Checkpoint 3\n\n", (buff64?.toString()))
        console.log(parsed)
        // Assuming you're using API Gateway
        const mapped = {
            attachments: parsed?.attachments,
            from: parsed?.from.value[0].name,
            email: parsed?.from.value[0].address,
            image: 'ionibowcher.png',
            title: parsed?.subject,
            message: parsed?.text,
            messageAsHtml: parsed?.textAsHtml,
            date: parsed?.date,
            important: false,
            starred: false,
            trash: false,
            spam: false,
            archived: false
        }
        response.body = JSON.stringify({ parsed, mapped }) || JSON.stringify({ message: 'No objects found in s3 bucket' })
        return response

    }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;