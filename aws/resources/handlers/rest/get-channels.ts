// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Logger } from '@aws-lambda-powertools/logger';
import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { ListUsersInGroupCommand, UserType } from '@aws-sdk/client-cognito-identity-provider';
import * as COGNITO from "@aws-sdk/client-cognito-identity-provider";
const { CHANNELS_TABLE_NAME, LOG_LEVEL, COGNITO_USER_POOL_ID } = process.env;
const logger = new Logger({ serviceName: 'websocketMessagingService', logLevel: LOG_LEVEL });
const tracer = new Tracer({ serviceName: 'websocketMessagingService' });
const AWS = tracer.captureAWS(require('aws-sdk'));
const ddb = tracer.captureAWSClient(new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION }));
import * as jwt from 'jsonwebtoken';

const cognito = tracer.captureAWSClient(new AWS.CognitoIdentityServiceProvider());
class Lambda implements LambdaInterface {
  @tracer.captureLambdaHandler()
  public async handler(event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> {

    let response: APIGatewayProxyResult = { statusCode: 200, body: "OK" };
    logger.addContext(context);

    logger.info('GETTING EMPLOYEE DATA')
    const client = new COGNITO.CognitoIdentityProvider({ region: "us-east-1" });
    const input = {
      UserPoolId: COGNITO_USER_POOL_ID,
      GroupName: 'employeeGroup'
    };
    const command = new ListUsersInGroupCommand(input);
    const cognitoRes = await client.send(command);

    // get list of employees
    // make sure each one has a channel, if not create a channel for each employee

    //map employees IDs into channel IDs list
    //scan db for channel IDs
    //any employees without a dedicated channel?

    logger.info('GOT EMPLOYEE DATA')
    console.log(cognitoRes)
    const employeeIdList = cognitoRes?.Users?.map((employee: any) => {
      return { Username: employee.Username, EmpName: getEmployeeName(employee) }
    }) || []



    try {
      let channels = await ddb.scan({ TableName: CHANNELS_TABLE_NAME, ProjectionExpression: 'id, Participants, channelName' }).promise();

      console.log({ channels })
      let shouldGetUpdatedChannels = false
      console.log({ employeeIdList })
      employeeIdList.map((employeeData) => {
        // todo figure out this bug
        const index = channels.Items?.findIndex((channel: { id: any }) => channel.id === employeeData.Username)
        if (index !== -1) {
          console.log('this employee has a channel --- ,', employeeData, channels)
          channels.Items[index].channelName = employeeData.EmpName
        } else {
          console.log('this employee does not have a channel -- creating now!')
          shouldGetUpdatedChannels = true
          createChannel(employeeData.Username, cognitoRes.Users)
        }
      })

      console.log({ shouldGetUpdatedChannels })
      if (shouldGetUpdatedChannels) {
        channels = await ddb.scan({ TableName: CHANNELS_TABLE_NAME, ProjectionExpression: 'id, Participants,channelName' }).promise();
      }

      const isEmployee = checkIfUserIsEmployee(event.headers)
      console.log({ isEmployee })
      console.log(' here is the channels data \n\n', JSON.stringify(channels))
      if (isEmployee) {
        console.log('user is an employee !!!! filtering the channels by participants now', channels, isEmployee.userId)
        //todo figure out this bug
        channels.Items = channels.Items.filter((channel: any) => channel.Participants?.findIndex((participant: any) => participant.Username !== isEmployee.userId ))
      }

      console.log({ mappedChannels: channels })

      response = { statusCode: 200, body: JSON.stringify(channels.Items) };

    }
    catch (e: any) {
      response = { statusCode: 500, body: e.stack };
    }

    return response;
  }
}

export const createChannel = async (employeeId: any, cognitoUsers: UserType[] | undefined) => {
  try {
    const Participants = cognitoUsers?.filter((user) => user.Username === employeeId)
    const channelParams = {
      TableName: CHANNELS_TABLE_NAME,
      Item: {
        id: employeeId,
        Participants
      }
    };

    logger.debug(`Inserting channel details ${JSON.stringify(channelParams)}`);
    await ddb.put(channelParams).promise();

    // logger.debug(JSON.stringify(event));
    logger.debug('Post Channel executed successfully!');
  }
  catch (e: any) {
    let response = { statusCode: 500, body: e.stack };
    console.log('ERROR CREATING CHANNEL', e, response)
  }

}

export const getEmployeeName = (employee: { Attributes: any[] }) => {
  return employee?.Attributes?.find((attr) => attr.Name === 'name')?.Value || 'Unregistered Employee'
}


export const checkIfUserIsEmployee = (headers: any) => {

  let token
  try {
    token = headers?.Authorization;
    console.log("Token is valid. Payload:", token?.substring(0, 5));
  } catch {
    console.log("Token not valid!");
  }

  //check cognito user group
  let userGroups = []
  let userId = ''
  try {
    const decodedJwt = jwt.decode(token as string, { complete: true }) as any
    // console.log({ decodedJwt })
    userGroups = decodedJwt?.payload ? decodedJwt?.payload['cognito:groups'] : []
    userId = decodedJwt?.payload ? decodedJwt?.payload['cognito:username'] : ''

  } catch (error) {
    console.log("Error getting user groups!");
  }



  if (userGroups.includes('employeeGroup')) {
    return { userId }
    // response.body = JSON.stringify(filteredResponse)
  } else return false

}


export const handlerClass = new Lambda();
export const handler = handlerClass.handler;