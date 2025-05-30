// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Logger } from '@aws-lambda-powertools/logger';
import { LambdaInterface } from '@aws-lambda-powertools/commons';
// const cognito = tracer.captureAWSClient(new AWS.CognitoIdentityServiceProvider()); // ES Modules import
// const { CognitoIdentityProviderClient, ListUsersInGroupCommand } = require("@aws-sdk/client-cognito-identity-provider"); // CommonJS import
import * as AWS from "@aws-sdk/client-cognito-identity-provider";


const { LOG_LEVEL, COGNITO_USER_POOL_ID } = process.env;

import { CognitoIdentityProviderClient, ListUsersCommand, ListUsersInGroupCommand } from "@aws-sdk/client-cognito-identity-provider"; // ES Modules import


class Lambda implements LambdaInterface {
  // @tracer.captureLambdaHandler()
  public async handler(event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> {

    // let response = { statusCode: 200, body: "OK" };
    // logger.addContext(context);
    // logger.debug(`Getting employee data: ${JSON.stringify({})}`);

    const client = new AWS.CognitoIdentityProvider({ region: "us-east-1" });
    const employeeInput = { // ListUsersRequest
      UserPoolId: COGNITO_USER_POOL_ID,
      GroupName: 'employeeGroup' // required
    };
    const adminInput = { // ListUsersRequest
      UserPoolId: COGNITO_USER_POOL_ID,
      GroupName: 'adminGroup' // required
    };
    const employeeCommand = new ListUsersInGroupCommand(employeeInput);
    const adminCommand = new ListUsersInGroupCommand(adminInput);
    const response = await client.send(employeeCommand);
    const adminResponse = await client.send(adminCommand);

    let mergedResponses:any = { Users: [] }
    if (response && adminResponse) {
      mergedResponses.Users = [...response.Users!, ...adminResponse.Users!]
    }

    console.log({ response, adminResponse })
    //map employees into UI schema

    const body = JSON.stringify(mergedResponses?.Users?.map((user:any) => {
      return {
        UserId: user.Attributes?.find((item:any) => item.Name === 'sub')?.Value,
        ...user
      }
    }))

    return {
      statusCode: 200,
      body
    }
  }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;