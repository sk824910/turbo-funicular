// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { GetScheduleCommand, SchedulerClient, UpdateScheduleCommand } from "@aws-sdk/client-scheduler";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { addDays } from 'date-fns';
const client = new SchedulerClient({ region: 'us-east-1' }); // Change to your preferred region

const { LOG_LEVEL, EVENT_TABLE } = process.env;
const logger = new Logger({ serviceName: 'websocketMessagingService', logLevel: LOG_LEVEL });
const tracer = new Tracer({ serviceName: 'websocketMessagingService' });
const AWS = tracer.captureAWS(require('aws-sdk'));
const ddb = tracer.captureAWSClient(new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION }));

function extractNumber(string: string) {
    // Use regular expression to match numbers in the string
    const match = string.match(/\d+/);
    // Convert the matched string to a number and return it
    return match ? parseInt(match[0], 10) : null;
}

class Lambda implements LambdaInterface {
    @tracer.captureLambdaHandler()
    public async handler(event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> {

        const body = JSON.parse(event.body!)
        const { groupName, scheduleName } = body
        const targetRate = body?.targetRate
        const targetStartDate = body?.targetStartDate

        let response: any = {}
        // console.log('event received\n', { groupName, scheduleName })


        if (groupName && scheduleName && targetRate && targetStartDate) {
            console.log('event received\n', { groupName, scheduleName, targetRate, targetStartDate })
            console.log('getting schedule data')
            const payload = { GroupName: groupName, Name: scheduleName }
            try {

                console.log('sending payload \n', { payload })
                const pay = new GetScheduleCommand(payload)
                const res = await client.send(pay);
                console.log('Data received:', { res });

                response = { ...res, Target: res.Target }

            } catch (error) {
                console.error('Error getting data for the following schedule:  ', payload);
                console.log({ error })
            }
            const oldInput = JSON.parse(response.Target.Input)
            //grab from payload
            const newStartDate = new Date(targetStartDate)
            const updateReq = new UpdateScheduleCommand({ GroupName: groupName, Name: scheduleName, ScheduleExpression: `rate(${targetRate} days)`, FlexibleTimeWindow: { Mode: 'OFF' }, Target: { ...response.Target, Input: JSON.stringify({ StartDate: newStartDate }) } })
            console.log('here is the update req', updateReq)

            try {

                const updateRes = await client.send(updateReq);
                console.log('update successful!', { updateRes })


            } catch (error) {
                console.error('Error updating schedule for the following schedule:  ', { GroupName: groupName, Name: scheduleName, Target: response.Target, FlexibleTimeWindow: undefined });
                console.log({ error })
            }


            try {
                const unix = new Date(oldInput.StartDate).valueOf()
                const eventDynamoParams = {
                    TableName: 'ClientTasks',
                    Item: {
                        PatientId: `${groupName}-${scheduleName}`,
                        TaskId: `${unix}`,
                        Data: { ...response }
                    }
                };

                console.log(eventDynamoParams)

                logger.debug(`Inserting event details ${JSON.stringify(eventDynamoParams)}`);
                await ddb.put(eventDynamoParams).promise();
            } catch (error) {
                console.log('error writing to db! \n', { error })
            }


        } else
            if (groupName && scheduleName) {
                console.log('event received\n', { groupName, scheduleName })
                console.log('getting schedule data')
                const payload = { GroupName: groupName, Name: scheduleName }
                const updatePayload = {}
                try {

                    console.log('sending payload \n', { payload })
                    const pay = new GetScheduleCommand(payload)
                    const res = await client.send(pay);
                    console.log('Data received:', { res });

                    response = { ...res, Target: res.Target }

                } catch (error) {
                    console.error('Error getting data for the following schedule:  ', payload);
                    console.log({ error })
                }
                const numberOfDaysToAdd = extractNumber(response.ScheduleExpression)
                const oldInput = JSON.parse(response.Target.Input)
                const newStartDate = addDays(new Date(oldInput.StartDate), numberOfDaysToAdd!)
                const updateReq = new UpdateScheduleCommand({ GroupName: groupName, Name: scheduleName, ScheduleExpression: response.ScheduleExpression, FlexibleTimeWindow: { Mode: 'OFF' }, Target: { ...response.Target, Input: JSON.stringify({ StartDate: newStartDate }) } })
                console.log('here is the update req', updateReq)

                try {

                    const updateRes = await client.send(updateReq);
                    console.log('update successful!', { updateRes })


                } catch (error) {
                    console.error('Error updating schedule for the following schedule:  ', { GroupName: groupName, Name: scheduleName, Target: response.Target, FlexibleTimeWindow: undefined });
                    console.log({ error })
                }


                try {
                    const unix = new Date(oldInput.StartDate).valueOf()
                    const eventDynamoParams = {
                        TableName: 'ClientTasks',
                        Item: {
                            PatientId: `${groupName}-${scheduleName}`,
                            TaskId: `${unix}`,
                            Data: { ...response }
                        }
                    };

                    console.log(eventDynamoParams)

                    logger.debug(`Inserting event details ${JSON.stringify(eventDynamoParams)}`);
                    await ddb.put(eventDynamoParams).promise();
                } catch (error) {
                    console.log('error writing to db! \n', { error })
                }


            }


        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'SUCCESSFULLY UPDATED' }),
        };



    }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;