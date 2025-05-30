// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Logger } from '@aws-lambda-powertools/logger';
import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { Metrics } from '@aws-lambda-powertools/metrics';
import { Channel } from '../../models/channel'
const { LOG_LEVEL, METADATA_TABLE_NAME } = process.env;
const logger = new Logger({ serviceName: 'websocketMessagingService', logLevel: LOG_LEVEL });
const tracer = new Tracer({ serviceName: 'websocketMessagingService' });
const AWS = tracer.captureAWS(require('aws-sdk'));
const ddb = tracer.captureAWSClient(new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION }));

class Lambda implements LambdaInterface {
    @tracer.captureLambdaHandler()
    public async handler(event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> {

        let response: APIGatewayProxyResult = { statusCode: 200, body: "" };

        logger.addContext(context);
        let result
        try {
            var params = {
                KeyConditionExpression: '#pkey = :pkey',
                ExpressionAttributeNames: {
                    "#pkey": "pkey"
                },
                ExpressionAttributeValues: {
                    ':pkey': 'email',
                },
                TableName: METADATA_TABLE_NAME,
                Limit: 100
            };
            result = await ddb.query(params).promise()
            console.log(JSON.stringify(result))
        } catch (error) {
            console.error(error);
        }

        const data = result.Items.map((item: any, id: number) => { return { id, ...item  } })
        response.body = JSON.stringify(data);
        return response;
    }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;