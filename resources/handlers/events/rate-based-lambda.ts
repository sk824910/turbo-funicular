// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { SchedulerClient } from "@aws-sdk/client-scheduler";
import { APIGatewayProxyResult } from 'aws-lambda';
import { getUnixTime } from 'date-fns';
const client = new SchedulerClient({ region: 'us-east-1' }); // Change to your preferred region

const taskTypes = [
    { "taskType": "Anticipated Fill Date", "taskId": "AFD" },
    { "taskType": "Anticipated Shipping Date", "taskId": "ASD" },
    { "taskType": "Clinic Notes", "taskId": "CN" },
    { "taskType": "Client Communication", "taskId": "CC" },
    { "taskType": "Medication List Verification", "taskId": "MLV" },
    { "taskType": "Monthly Refill Reminder", "taskId": "MRR" },
    { "taskType": "New Prescription", "taskId": "NP" },
    { "taskType": "Other", "taskId": "OT" },
    { "taskType": "Patient Care Plan", "taskId": "PCP" },
    { "taskType": "Quarterly Form", "taskId": "QF" }
]

const { LOG_LEVEL } = process.env;
const logger = new Logger({ serviceName: 'websocketMessagingService', logLevel: LOG_LEVEL });
const tracer = new Tracer({ serviceName: 'websocketMessagingService' });
const AWS = tracer.captureAWS(require('aws-sdk'));
const ddb = tracer.captureAWSClient(new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION }));
const cognito = tracer.captureAWSClient(new AWS.CognitoIdentityServiceProvider());

class Lambda implements LambdaInterface {
    @tracer.captureLambdaHandler()
    public async handler(event: any, context: any): Promise<APIGatewayProxyResult> {

        let response: APIGatewayProxyResult = { statusCode: 200, body: "OK" };
        logger.addContext(context);
        logger.info('HELLO\n', { event })

        console.log(event.event)

        const currentDate = getUnixTime(new Date())
        
        return {
            statusCode: 200,
            body: JSON.stringify('Schedules created successfully'),
        };

    }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;