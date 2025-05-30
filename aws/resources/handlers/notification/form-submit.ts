// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Logger } from "@aws-lambda-powertools/logger";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
const ses = new SESClient({ region: "us-east-1" }); // or your region
const { LOG_LEVEL } = process.env;
const logger = new Logger({
  serviceName: "TurboFunicular-FormSubmit",
  logLevel: LOG_LEVEL,
});
const tracer = new Tracer({ serviceName: "TurboFunicular-FormSubmit" });
const AWS = tracer.captureAWS(require("aws-sdk"));
const ssm = tracer.captureAWSClient(new AWS.SSM());

class Lambda implements LambdaInterface {
  @tracer.captureLambdaHandler()
  public async handler(
    event: APIGatewayProxyEvent,
    context: any
  ): Promise<APIGatewayProxyResult> {
    try {
      const body = JSON.parse(event.body!);

      const { name, email, message } = body;

      const params = {
        Destination: {
          ToAddresses: ["contact@brandywinewebservices.com"],
        },
        Message: {
          Body: {
            Text: {
              Data: `From: ${name} <${email}>\n\n${message}`,
            },
          },
          Subject: {
            Data: "New Contact Form Submission",
          },
        },
        Source: "your-verified-sender@example.com",
      };

      await ses.send(new SendEmailCommand(params));

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Email sent!" }),
      };
    } catch (err) {
      console.error(err);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to send email" }),
      };
    }
  }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;



