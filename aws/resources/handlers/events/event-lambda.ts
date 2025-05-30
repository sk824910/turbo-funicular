// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { CreateScheduleCommand, CreateScheduleCommandInput, CreateScheduleGroupCommand, CreateScheduleGroupCommandInput, SchedulerClient } from "@aws-sdk/client-scheduler";
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

    let response: APIGatewayProxyResult = { statusCode: 200, body: "OK" };
    logger.addContext(context);

    const body = JSON.parse(event.body!);
    const GroupName = body.groupName;
    const name = body.name;
    const creationDate = body.CreationDate;

    const lambdaArn = process.env.RATE_LAMBDA_ARN!;
    const roleArn = process.env.ROLE_ARN!;

    let eventInputKv: any = {}

    //check for valid task types, if exist then create the unix timestamp equiv
    // taskTypes.map((taskType) => {
    //   //unix time is creationDate + tasktype days (1,2,3 etc)
    //   const unixTime: Date = addDays(body?.CreationDate, body[`${taskType.taskId}-delta`])
    //   const iso = addHours(unixTime, 5).toISOString()
    //   console.log(unixTime, unixTime.toISOString())
    //   body[`${taskType.taskId}`] !== undefined ? body[`${taskType.taskId}_ms`] = unixTime.toISOString() : null
    //   eventInputKv[`${taskType.taskId}`] = body[`${taskType.taskId}`] !== undefined ? iso.slice(0, iso.length - 5) : null

    //   console.log('checking if ms value created --- ', body[`${taskType.taskId}_ms`])
    // })

    taskTypes.map(({ taskId, taskType }) => {
      if (body[`${taskId}`]) {
        console.log('task in payload, creating event schedule')
        eventInputKv[`${taskId}`] = body[`${taskId}`]
      }
      else {
        console.log('task not in payload')
      }
    })

    const groupParams: CreateScheduleGroupCommandInput = {
      Name: GroupName,
    };


    try {
      const groupCommand = new CreateScheduleGroupCommand(groupParams);
      const result1 = await client.send(groupCommand);
      console.log('Group created:', result1);

    } catch (error) {
      console.error('Error creating group:', error);
      // return {
      //   statusCode: 500,
      //   body: JSON.stringify('Error creating group'),
      // };
    }

    console.log('building param list')
    const paramList: any[] = []

    Object.entries(eventInputKv).map(([key, value]) => {
      if (value) {
        const StartDate = new Date(body[`${key}-startDate`]) || null
        console.log({ key, value, StartDate })
        const param: CreateScheduleCommandInput = {
          FlexibleTimeWindow: {
            Mode: 'OFF'
          },
          GroupName,
          Name: `${name}-${key}`,
          ScheduleExpression: `rate(${value} days)`, // Adjust the schedule as needed
          Target: {
            Arn: lambdaArn,
            RoleArn: roleArn,
            Input: JSON.stringify({ StartDate }), // Your custom input
          }
        };

        paramList.push(param)
      }
    })

    // const params1: CreateScheduleCommandInput = {
    //   FlexibleTimeWindow: {
    //     Mode: 'OFF'
    //   },
    //   GroupName,
    //   Name: name,
    //   ScheduleExpression: 'rate(1 day)', // Adjust the schedule as needed
    //   Target: {
    //     Arn: lambdaArn,
    //     RoleArn: roleArn,
    //     Input: JSON.stringify({ ...eventInputKv }), // Your custom input
    //   }
    // };

    console.log({ paramList })

    const errorList: any = []
    for (let i = 0; i < paramList.length; i++) {
      try {
        const command1 = new CreateScheduleCommand(paramList[i]);
        const result1 = await client.send(command1);
        // console.log('Schedule1 created:', result1);

        console.log(paramList[i].Name, ' --- event created successfully')

        const eventDynamoParams = {
          TableName: 'ClientTasks',
          Item: {
            PatientId: GroupName,
            TaskId: `${GroupName}-${name}`,
            Data: { ...paramList[i] },
            Raw: { ...body }
          }
        };

        console.log(eventDynamoParams)

        logger.debug(`Inserting event details ${JSON.stringify(eventDynamoParams)}`);
        await ddb.put(eventDynamoParams).promise();

        logger.debug(JSON.stringify(event));

        //   const command2 = new CreateScheduleCommand(params2);
        //   const result2 = await client.send(command2);
        //   console.log('Schedule2 created:', result2);


      } catch (error) {
        console.error('Error creating schedules:', error);
        errorList.push({ name: paramList[i].Name, error })

      }
    }
    // await paramList.map(async (paramList) => {
    //   try {
    //     const command1 = new CreateScheduleCommand(paramList);
    //     const result1 = await client.send(command1);
    //     // console.log('Schedule1 created:', result1);

    //     console.log(paramList.Name, ' --- event created successfully')

    //     const eventDynamoParams = {
    //       TableName: 'PatientTasks',
    //       Item: {
    //         PatientId: GroupName,
    //         TaskId: `${GroupName}-${name}`,
    //         Data: { ...paramList },
    //         Raw: { ...body }
    //       }
    //     };

    //     console.log(eventDynamoParams)

    //     logger.debug(`Inserting event details ${JSON.stringify(eventDynamoParams)}`);
    //     await ddb.put(eventDynamoParams).promise();

    //     logger.debug(JSON.stringify(event));

    //     //   const command2 = new CreateScheduleCommand(params2);
    //     //   const result2 = await client.send(command2);
    //     //   console.log('Schedule2 created:', result2);


    //   } catch (error) {
    //     console.error('Error creating schedules:', error);
    //     errorList.push({ name: paramList.Name, error })

    //   }
    // })

    if (errorList?.length > 0) {
      return {
        statusCode: 500,
        body: JSON.stringify(`Error creating schedules - ${errorList}`),
      };
    } else {
      return {
        statusCode: 200,
        body: JSON.stringify('Schedules created successfully'),
      };
    }


  }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;