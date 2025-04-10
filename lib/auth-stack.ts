// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Mfa } from 'aws-cdk-lib/aws-cognito';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';


export class AuthenticationStack extends Stack {

  readonly serverlessChatUserPool: cognito.UserPool;
  readonly cognitoUserPoolId: string;

  constructor(scope: Construct, id: string, props?: StackProps, updated = false) {
    super(scope, id, props);

    // For this sample project, we just want users to be able to sign up and login instantly.
    // !!! WARNING !!! - do NOT use it in production! 
    // Add neccessary security measures, like email and multi-factor authentication.
    const autoVerifyFunction = new Function(this, 'lambda-function', {
      runtime: Runtime.NODEJS_LATEST,
      memorySize: 256,
      timeout: Duration.seconds(10),
      handler: 'index.handler',
      code: Code.fromInline(`exports.handler = (event, context, callback) => {
        // Autoconfirm user
        event.response.autoConfirmUser = true;
        // Return to Amazon Cognito
        callback(null, event);
        };`)
    });
    //TODO redeploy project




    if (updated) {

      this.serverlessChatUserPool = new cognito.UserPool(this, 'ServerlessChatUserPoolV2', {
        selfSignUpEnabled: true,
        passwordPolicy: {
          minLength: 12,
          requireLowercase: true,
          requireUppercase: true,
          requireDigits: true,
          requireSymbols: true,
          tempPasswordValidity: Duration.days(3),
        },
        signInAliases: {
          email: true,
        },
        lambdaTriggers: {
          preSignUp: autoVerifyFunction
        },
        standardAttributes: {
          fullname: {
            required: true,
          },
          profilePicture: {
            // required: true,
            mutable: true,
          },
          nickname: {
            required: true,
            mutable: true
          }
        },
        // customAttributes: {
        //   userType: new cognito.StringAttribute({ minLen: 5, maxLen: 15, mutable: true, }),
        // },
        mfa: Mfa.OPTIONAL
      });


      const adminGroup = new cognito.CfnUserPoolGroup(this, 'AdminGroupUserPool', {
        userPoolId: this.serverlessChatUserPool.userPoolId,

        // the properties below are optional
        description: 'group for admin users - Harold ',
        groupName: 'adminGroup',
        precedence: 0,
      });

      const employeeGroup = new cognito.CfnUserPoolGroup(this, 'EmployeeGroupUserPool', {
        userPoolId: this.serverlessChatUserPool.userPoolId,

        // the properties below are optional
        description: 'employees',
        groupName: 'employeeGroup',
        precedence: 1,
      });

      const clientGroup = new cognito.CfnUserPoolGroup(this, 'ClientGroupUserPool', {
        userPoolId: this.serverlessChatUserPool.userPoolId,

        // the properties below are optional
        description: 'clients -- end users ',
        groupName: 'clientGroup',
        precedence: 2,
      });
      NagSuppressions.addResourceSuppressions(
        this.serverlessChatUserPool,
        [
          {
            id: 'AwsSolutions-COG3',
            reason:
              "AdvancedSecurityMode is not available yet in the CDK construct. See: https://github.com/aws/aws-cdk/pull/17923"
          },
        ],
        true
      );


      NagSuppressions.addResourceSuppressions(
        this.serverlessChatUserPool,
        [
          {
            id: 'AwsSolutions-IAM4',
            reason:
              "AdvancedSecurityModes is not available yet in the CDK construct. See: https://github.com/aws/aws-cdk/pull/17923"
          },
        ],
        true
      );


      NagSuppressions.addResourceSuppressions(
        this.serverlessChatUserPool,
        [
          {
            id: 'AwsSolutions-IAM5',
            reason:
              "AdvancedSecurityMode is not available yet in the CDK construct. See: https://github.com/aws/aws-cdk/pull/17923"
          }
        ],
        true
      );





      // NagSuppressions.addResourceSuppressionsByPath(
      //   this,
      //   '/AuthenticationStackV2/lambda-function/ServiceRole/Resource',
      //   [{ id: 'AwsSolutions-IAM4', reason: 'at least 10 characters' }]
      // );


    } else {

      this.serverlessChatUserPool = new cognito.UserPool(this, 'ServerlessChatUserPool', {
        selfSignUpEnabled: true,
        autoVerify: { email: true, phone: true },
        passwordPolicy: {
          minLength: 12,
          requireLowercase: true,
          requireUppercase: true,
          requireDigits: true,
          requireSymbols: true,
          tempPasswordValidity: Duration.days(3),
        },
        signInAliases: {
          username: true,
          email: true,
        },
        lambdaTriggers: {
          preSignUp: autoVerifyFunction
        },
        // customAttributes: {
        //   userType: new cognito.StringAttribute({ minLen: 5, maxLen: 15, mutable: true, }),
        // },
      });
    }
    NagSuppressions.addResourceSuppressions(
      this.serverlessChatUserPool,
      [
        {
          id: 'AwsSolutions-COG3',
          reason:
            "AdvancedSecurityMode is not available yet in the CDK construct. See: https://github.com/aws/aws-cdk/pull/17923"
        },
        {
          id: 'AwsSolutions-IAM4',
          reason:
            "AdvancedSecurityModes is not available yet in the CDK construct. See: https://github.com/aws/aws-cdk/pull/17923"
        },
      ],
      true
    );

    this.cognitoUserPoolId = this.serverlessChatUserPool.userPoolId;
  }
};