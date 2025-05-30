// SPDX-License-Identifier: MIT-0
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { DeleteScheduleCommand, DeleteScheduleCommandInput, SchedulerClient } from "@aws-sdk/client-scheduler";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
const client = new SchedulerClient({ region: 'us-east-1' }); // Change to your preferred region



const tracer = new Tracer({ serviceName: 'deleteEventLambda' });
const AWS = tracer.captureAWS(require('aws-sdk'));

class Lambda implements LambdaInterface {
  @tracer.captureLambdaHandler()
  public async handler(event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> {

    const body = JSON.parse(event.body!);
    const GroupName = body.groupName;
    const scheduleName = body.scheduleName

    const payload: DeleteScheduleCommandInput = {
      GroupName,
      Name: scheduleName
    }


    let data;

    try {
      console.log('sending payload \n', { payload })
      const pay = new DeleteScheduleCommand(payload)
      const res = await client.send(pay);
      console.log('Data received:', { res });
      data = res

    } catch (error) {
      console.error('Error deleting schedule for the following schedule:  ---   ', payload.Name, payload.GroupName);
      console.log({ error })
      return {
        statusCode: 200,
        body: JSON.stringify(error),
      };
    }



    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };




  }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;