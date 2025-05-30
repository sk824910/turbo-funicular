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

const { CONNECTIONS_TABLE_NAME, LOG_LEVEL, STATUS_QUEUE_URL } = process.env;
const logger = new Logger({ serviceName: 'websocketMessagingService', logLevel: LOG_LEVEL });
const tracer = new Tracer({ serviceName: 'websocketMessagingService' });
const metrics = new Metrics({ namespace: 'websocket-chat' });
const AWS = tracer.captureAWS(require('aws-sdk'));
const ddb = tracer.captureAWSClient(new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION }));
const SQS = tracer.captureAWSClient(new AWS.SQS());

class Lambda implements LambdaInterface {

    @tracer.captureLambdaHandler()
    public async handler(event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> {



        console.log('ondisconnect,', { event })
        logger.addContext(context);
        let response: APIGatewayProxyResult = { statusCode: 200, body: "OK" };

        const deleteParams = {
            TableName: CONNECTIONS_TABLE_NAME,
            Key: {
                connectionId: event.requestContext.connectionId
            }
        };

        try {
            let name;
            try {
                const token = event?.headers?.Cookie?.replace('id_token=', '')!;
                const decodedJwt = jwt.decode(token as string, { complete: true }) as any
                // console.log({ decodedJwt })
                name = decodedJwt?.payload?.name

            } catch (error) {
                console.log("Error decoding jwt! continuing with flow");
            }
            //Query connection table to check for userId]
            console.log('//Query connection table to check for userId')
            let connectionData = await ddb.query({
                TableName: CONNECTIONS_TABLE_NAME,
                KeyConditionExpression: "#connectionId = :id",
                ExpressionAttributeNames: {
                    "#connectionId": "connectionId"
                },
                ExpressionAttributeValues: {
                    ":id": event.requestContext.connectionId,
                },
            }).promise();

            logger.debug("Retrieved connection items: ", connectionData);

            // If connection is found, broadcase a status change event and delete the record
            console.log('// If connection is found, broadcase a status change event and delete the record')
            if (connectionData.Items.length > 0) {
                let statusChangeEvent = new StatusChangeEvent({
                    userId: connectionData.Items[0].userId,
                    currentStatus: Status.OFFLINE,
                    eventDate: new Date(),
                    name
                });
                logger.debug(`Broadcasting message details ${JSON.stringify(statusChangeEvent)}`);
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
                logger.debug(`Deleting connection details ${JSON.stringify(deleteParams)}`);
                await ddb.delete(deleteParams).promise();

                metrics.addMetric('closedConnection', MetricUnits.Count, 1);
            }
            metrics.publishStoredMetrics();
        } catch (error: any) {
            console.log('some error caught', { error })
            var body = error.stack || JSON.stringify(error, null, 2);
            response = { statusCode: 500, body: body };
        }
        console.log({ response })
        return response;
    }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;