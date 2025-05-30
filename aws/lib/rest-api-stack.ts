// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Duration, Stack, StackProps } from "aws-cdk-lib";
import {
  IResource,
  LambdaIntegration,
  MockIntegration,
  PassthroughBehavior,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import {
  NodejsFunction,
  NodejsFunctionProps,
} from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { join } from "path";

import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Bucket } from "aws-cdk-lib/aws-s3";
export interface RestApiProps extends StackProps {
  logLevel?: string;
  adminEmailBucket?: Bucket;
}

export class RestApiStack extends Stack {
  public apiGatewayEndpoint: string;
  public restApi: RestApi;

  constructor(scope: Construct, id: string, props?: RestApiProps) {
    super(scope, id, props);

    //EMAIL STUFF

    const sharedLambdaProps: NodejsFunctionProps = {
      bundling: {
        externalModules: [],
        nodeModules: [
          "@aws-lambda-powertools/logger",
          "@aws-lambda-powertools/tracer",
          "aws-jwt-verify",
        ],
      },
      depsLockFilePath: join(__dirname, "../resources/", "package-lock.json"),
      environment: {
        LOG_LEVEL: props?.logLevel!,
      },
      runtime: Runtime.NODEJS_LATEST,
      memorySize: 256,
      timeout: Duration.seconds(10),
    };

    const sendEmailLambda = new NodejsFunction(this, "deleteUserFunction", {
      entry: join(
        __dirname,
        `/../resources/handlers/notification/`,
        "form-submit.ts"
      ),
      ...sharedLambdaProps,
    });

    sendEmailLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["ses:SendEmail"],
        resources: ["*"],
      })
    );

    // deleteUserLambda.addToRolePolicy(
    //   new PolicyStatement({
    //     effect: Effect.ALLOW,
    //     actions: ["cognito-idp:AdminDeleteUser"],
    //     resources: [
    //       `arn:aws:cognito-idp:${Stack.of(this).region}:${
    //         Stack.of(this).account
    //       }:userpool/${props?.cognitoUserPoolId!}`,
    //     ],
    //   })
    // );

    const sendEmailLambdaIntegration = new LambdaIntegration(sendEmailLambda);

    // Create an API Gateway resource for each of the CRUD operations
    // const api = new RestApi(this, 'itemsApi', {
    //   restApiName: 'Items Service'
    //   // In case you want to manage binary types, uncomment the following
    //   // binaryMediaTypes: ["*/*"],
    // });

    /* ================================
    API Schema
    -----------
    [GET]    /config
    [GET]    /users
    [GET]    /channels
    [GET]    /channels/{ID}
    [POST]   /channels/
    [GET]    /channels/{ID}/messages
    ==================================== */

    this.restApi = new RestApi(this, "TurboFunicular", {
      restApiName: "TurboFunicular",
    });

    this.apiGatewayEndpoint = this.restApi.url;

    const api = this.restApi.root.addResource("api");

    api.addResource("contact");
    api.addMethod("POST", sendEmailLambdaIntegration);

    // addCorsOptions(api);
  }
}

export function addCorsOptions(apiResource: IResource) {
  apiResource.addMethod(
    "OPTIONS",
    new MockIntegration({
      integrationResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Headers":
              "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
            "method.response.header.Access-Control-Allow-Origin": "'*'",
            "method.response.header.Access-Control-Allow-Credentials":
              "'false'",
            "method.response.header.Access-Control-Allow-Methods":
              "'OPTIONS,GET,PUT,POST,DELETE'",
          },
        },
      ],
      passthroughBehavior: PassthroughBehavior.NEVER,
      requestTemplates: {
        "application/json": '{"statusCode": 200}',
      },
    }),
    {
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Headers": true,
            "method.response.header.Access-Control-Allow-Methods": true,
            "method.response.header.Access-Control-Allow-Credentials": true,
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
      ],
    }
  );
}
