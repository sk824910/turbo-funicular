// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { ListScheduleGroupsCommand, ListScheduleGroupsCommandInput, SchedulerClient } from "@aws-sdk/client-scheduler";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
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

const { LOG_LEVEL, EVENT_TABLE } = process.env;
const logger = new Logger({ serviceName: 'websocketMessagingService', logLevel: LOG_LEVEL });
const tracer = new Tracer({ serviceName: 'websocketMessagingService' });
const AWS = tracer.captureAWS(require('aws-sdk'));
const ddb = tracer.captureAWSClient(new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION }));
const cognito = tracer.captureAWSClient(new AWS.CognitoIdentityServiceProvider());

class Lambda implements LambdaInterface {
  @tracer.captureLambdaHandler()
  public async handler(event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> {



    const groupParams: ListScheduleGroupsCommandInput = {

    }
    let res;
    try {
      const groupCommand = new ListScheduleGroupsCommand(groupParams);
      res = await client.send(groupCommand);
      console.log('Data received:', { res });

    } catch (error) {
      console.error('Error getting data:', error);
      return {
        statusCode: 500,
        body: JSON.stringify('Error creating group'),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(res?.ScheduleGroups),
    };




  }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;