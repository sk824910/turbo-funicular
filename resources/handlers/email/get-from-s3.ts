// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Logger } from '@aws-lambda-powertools/logger';
import { LambdaInterface } from '@aws-lambda-powertools/commons';
const { LOG_LEVEL } = process.env
const logger = new Logger({ serviceName: 'websocketMessagingService', logLevel: LOG_LEVEL });
const tracer = new Tracer({ serviceName: 'websocketMessagingService' });
const AWS = tracer.captureAWS(require('aws-sdk'));
const s3 = tracer.captureAWSClient(new AWS.S3({ apiVersion: '2006-03-01' }));
const simpleParser = require('mailparser').simpleParser;

const EMAIL_BUCKET = process.env.EMAIL_BUCKET || '';

class Lambda implements LambdaInterface {
  @tracer.captureLambdaHandler()
  public async handler(event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> {

    let response: APIGatewayProxyResult = { statusCode: 200, body: "" };
    const body = typeof event.body == 'object' ? event.body : JSON.parse(event.body);
    //get 10 latest emails
    let count = 10;
    if(body){
      count = body.count;
    }

    logger.addContext(context);
    // console.log('getting email from S3\n this is the event!!!! \n', { event })
    const params = {
      Bucket: EMAIL_BUCKET,
      MaxKeys: 100,
    }

    console.log("Checkpoint 1");

    let s3Objects

    try {
      //get 100 items from s3
      s3Objects = await s3.listObjectsV2(params).promise();
      let buff64;

      let emailList: any = []
      console.log({s3Objects})

      let i = 0;
      for (const email of s3Objects?.Contents){
        const keyParams = {
          Bucket: EMAIL_BUCKET,
          Key: email.Key
        }

        console.log({keyParams})
        const res = await s3.getObject(keyParams).promise();
        // emailList.push(res)d
        buff64 = Buffer.from(res?.Body, 'base64')
        const parsed = await simpleParser(buff64);

        const mapped = {
          id: i,
          attachments: parsed?.attachments,
          from: parsed?.from.value[0].name,
          email: parsed?.from.value[0].address,
          image: 'ionibowcher.png',
          title: parsed?.subject,
          message: parsed?.text,
          messageAsHtml: parsed?.textAsHtml,
          date: parsed?.date,
          important: false,
          starred: false,
          trash: false,
          spam: false,
          archived: false
        }
        i++;
        emailList.push({ mapped, parsed })
      }
      console.log("Checkpoint 2");

      console.log({ emailList })





      // Assuming you're using API Gateway
      response.body = JSON.stringify(emailList) || JSON.stringify({ message: 'No objects found in s3 bucket' })
      return response

    } catch (e) {
      console.log(e)
    }


    console.log("Checkpoint 2");

    // Assuming you're using API Gateway
    response.body = JSON.stringify(s3Objects || { message: 'No objects found in s3 bucket' })
    return response

  }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;