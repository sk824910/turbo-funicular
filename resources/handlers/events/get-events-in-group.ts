// SPDX-License-Identifier: MIT-0
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { GetScheduleCommand, GetScheduleInput, ListSchedulesCommand, ListSchedulesCommandInput, SchedulerClient } from "@aws-sdk/client-scheduler";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
const client = new SchedulerClient({ region: 'us-east-1' }); // Change to your preferred region



const tracer = new Tracer({ serviceName: 'websocketMessagingService' });
const AWS = tracer.captureAWS(require('aws-sdk'));

class Lambda implements LambdaInterface {
  @tracer.captureLambdaHandler()
  public async handler(event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> {

    const body = JSON.parse(event.body!);
    const GroupName = body.groupName;
    const detailedParamList: GetScheduleInput[] = []

    const groupParams: ListSchedulesCommandInput = {
      GroupName,
    }
    let listRes, detailedRes = []



    try {
      const groupCommand = new ListSchedulesCommand(groupParams);
      listRes = await client.send(groupCommand);
      console.log('Data received:', { listRes: JSON.stringify(listRes) });
      listRes.Schedules?.map((schedule) => {

        detailedParamList.push(
          {
            Name: schedule.Name,
            GroupName: GroupName
          }
        )
      })

    } catch (error) {
      console.error('Error getting data:', error);
      return {
        statusCode: 500,
        body: JSON.stringify('Error creating group'),
      };
    }





    if (detailedParamList.length > 0) {
      for (let i = 0; i < detailedParamList.length; i++) {
        try {
          const payload = detailedParamList[i]
          console.log('sending payload \n', { payload })
          const pay = new GetScheduleCommand(payload)
          const res = await client.send(pay);
          console.log('Data received:', { res });

          detailedRes.push({...res, Target: res.Target?.Input})

        } catch (error) {
          console.error('Error getting data for the following schedule:  ', detailedParamList[i].Name);
          console.log({ error })
        }
      }

    }


    return {
      statusCode: 200,
      body: JSON.stringify(detailedRes),
    };




  }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;