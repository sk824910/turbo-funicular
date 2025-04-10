// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { APIGatewayProxyEvent, APIGatewayProxyResult, S3Event } from 'aws-lambda';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Logger } from '@aws-lambda-powertools/logger';
import { LambdaInterface } from '@aws-lambda-powertools/commons';
const { LOG_LEVEL } = process.env
const logger = new Logger({ serviceName: 'websocketMessagingService', logLevel: LOG_LEVEL });
const tracer = new Tracer({ serviceName: 'websocketMessagingService' });
const AWS = tracer.captureAWS(require('aws-sdk'));
const s3 = tracer.captureAWSClient(new AWS.S3({ apiVersion: '2006-03-01' }));
const simpleParser = require('mailparser').simpleParser;
const ddb = tracer.captureAWSClient(new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION }));


const METADATA_TABLE_NAME = process.env.METADATA_TABLE_NAME || ''

class Lambda implements LambdaInterface {
    @tracer.captureLambdaHandler()
    public async handler(event: S3Event, context: any): Promise<APIGatewayProxyResult> {

        let response = { statusCode: 200, body: "" };
        const bucket = event.Records[0].s3.bucket.name;
        const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
        const params = {
            Bucket: bucket,
            Key: key,
        };

        console.log("Checkpoint 1");

        let s3Objects

        const res = await s3.getObject(params).promise();
        // emailList.push(res)d
        const buff64 = Buffer.from(res?.Body, 'base64')
        const parsed = await simpleParser(buff64);

        const mapped = {
            attachments: parsed?.attachments,
            from: parsed?.from.value[0].name,
            email: parsed?.from.value[0].address,
            image: 'ionibowcher.png',
            title: parsed?.subject,
            message: parsed?.text,
            messageAsHtml: parsed?.textAsHtml,
            date: parsed?.date.toString(),
            important: false,
            starred: false,
            trash: false,
            spam: false,
            archived: false
        }


        console.log("Checkpoint 2");
        // console.log({ mapped, parsed })

        try {

            const skey = `${new Date(mapped.date).getTime()}`
            const params = {
                TableName: METADATA_TABLE_NAME,
                Item: {
                    pkey: `email`,
                    skey,
                    bucketKey: key,
                    ...mapped

                }
            };

            logger.debug(`Inserting metadata details ${JSON.stringify(params)}`);
            await ddb.put(params).promise();

            logger.debug(JSON.stringify(event));
            logger.debug('Post Channel executed successfully!');
        }
        catch (e: any) {
            response = { statusCode: 500, body: e.stack };
        }





        // Assuming you're using API Gateway
        // response.body = JSON.stringify({ message: 'No objects found in s3 bucket' })
        response.body = JSON.stringify(mapped)
        return response
    }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;