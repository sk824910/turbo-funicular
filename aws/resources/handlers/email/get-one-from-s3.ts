// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { APIGatewayProxyResult } from 'aws-lambda';
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
        // var params = {
        //     Bucket: EMAIL_BUCKET,
        //     Key: body.Key
        // }

        const S3Params = {
            Bucket: EMAIL_BUCKET,
            Delimiter: '/',
            Prefix: body.Key,
        };

        console.log("Checkpoint 1", { S3Params });

        let s3Objects

        try {
            s3Objects = await s3.listObjectsV2(S3Params).promise();
            console.log(s3Objects)
        } catch (e) {
            console.log(e)
        }



        console.log("Checkpoint 2");
        const attachmentList = []
        if (s3Objects?.Contents) {
            const regex = /\/(.*)/;
            for (const attachment of s3Objects?.Contents) {



                const file = {
                    FileName: attachment.Key.match(regex)[1],
                    Key: `https://${EMAIL_BUCKET}.s3.amazonaws.com/${attachment.Key}`,
                    // SignedUrl: null
                    fileSize: attachment.Size, 
                    date: attachment.LastModified
                }




                // Get signed URL from S3
                const presignedParams = {
                    Bucket: EMAIL_BUCKET,
                    Key: attachment.Key,
                    Expires: 600,
                }

                console.log('Params: ', presignedParams)
                let SignedUrl

                try {
                    SignedUrl = await s3.getSignedUrlPromise('getObject', presignedParams)
                } catch (err) {
                    console.log(err)
                }

                if (SignedUrl) {
                    file.Key = SignedUrl
                }
                attachmentList.push(file)

                console.log({ file })
                // const res = await s3.getObject(keyParams).promise();
                // emailList.push(res)d
                // const buff64 = Buffer.from(res?.Body, 'base64')
                // const parsed = await simpleParser(buff64);
                // const data = parsed?.headerLines[0]?.line;
                // attachmentList.push(data)
            }
        }





        response.body = JSON.stringify(attachmentList) || JSON.stringify({ message: 'No objects found in s3 bucket' })
        return response

    }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;