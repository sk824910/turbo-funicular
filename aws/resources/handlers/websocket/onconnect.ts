// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics, MetricUnits } from '@aws-lambda-powertools/metrics';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as jwt from 'jsonwebtoken';
import { Status } from '../../models/status';
import { StatusChangeEvent } from '../../models/status-change-event';

function calculateTTL(durationInSeconds: number) {
    const currentTime = new Date().getTime(); // Current time in milliseconds
    const expirationTime = currentTime + durationInSeconds * 1000; // Add duration in milliseconds

    return expirationTime;
}



const { STATUS_QUEUE_URL, LOG_LEVEL, CONNECTIONS_TABLE_NAME } = process.env;
const logger = new Logger({ serviceName: 'websocketMessagingService', logLevel: LOG_LEVEL });
const tracer = new Tracer({ serviceName: 'websocketMessagingService' });
const metrics = new Metrics({ namespace: 'websocket-chat' });
const AWS = tracer.captureAWS(require('aws-sdk'));
const ddb = tracer.captureAWSClient(new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION }));
const SQS = tracer.captureAWSClient(new AWS.SQS());

class Lambda implements LambdaInterface {
    @tracer.captureLambdaHandler()
    public async handler(event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> {

        console.log('Onconnect,', { event })
        logger.addContext(context);
        logger.debug(JSON.stringify(event));
        logger.debug(JSON.stringify(context));
        let response: APIGatewayProxyResult = { statusCode: 200, body: "OK" };
        let authenticatedCustomerId = event.requestContext.authorizer?.customerId;

        // Example usage:
        const ttl = calculateTTL(900); // TTL of 1 hour (3600 seconds)
        const putParams = {
            TableName: CONNECTIONS_TABLE_NAME,
            Item: {
                connectionId: event.requestContext.connectionId,
                userId: authenticatedCustomerId,
                ttl
            }
        };
        let name;
        try {

            try {
                const token = event?.headers?.Cookie?.replace('id_token=', '')!;
                const decodedJwt = jwt.decode(token as string, { complete: true }) as any
                // console.log({ decodedJwt })
                name = decodedJwt?.payload?.name

            } catch (error) {
                console.log("Error decoding jwt! continuing with flow");
            }
            logger.debug(`Inserting connection details ${JSON.stringify(putParams)}`);
            await ddb.put(putParams).promise();

            metrics.addMetric('newConnection', MetricUnits.Count, 1);
            metrics.publishStoredMetrics();

            // Prepare status change event for broadcast
            console.log(
                '// Prepare status change event for broadcast\n', {
                userId: authenticatedCustomerId,
                currentStatus: Status.ONLINE,
                eventDate: new Date(),
                name
            })
            let statusChangeEvent = new StatusChangeEvent({
                userId: authenticatedCustomerId,
                currentStatus: Status.ONLINE,
                eventDate: new Date(),
                name
            });

            logger.debug("Putting status changed event in the SQS queue:", statusChangeEvent);
            // Put status change event to SQS queue
            let sqsResults = await SQS.sendMessage({
                QueueUrl: STATUS_QUEUE_URL,
                MessageBody: JSON.stringify(statusChangeEvent),
                MessageAttributes: {
                    Type: {
                        StringValue: 'StatusUpdate',
                        DataType: 'String',
                    },
                },
            }).promise();
            logger.debug("queue send result: ", sqsResults);
        } catch (error: any) {
            console.log('some error caught', { error })
            var body = error.stack || JSON.stringify(error, null, 2);
            response = { statusCode: 500, body: body };
        }

        return response;
    }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;