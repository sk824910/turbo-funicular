// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { WebSocketApi } from '@aws-cdk/aws-apigatewayv2-alpha';
import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { AuthorizationType, CognitoUserPoolsAuthorizer, IResource, LambdaIntegration, MockIntegration, PassthroughBehavior, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, BillingMode, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, PolicyStatement, } from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';
import { join } from 'path';

import { S3EventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Bucket } from 'aws-cdk-lib/aws-s3';
export interface RestApiProps extends StackProps {
  messagesTable?: Table;
  channelsTable?: Table;
  connectionsTable?: Table;
  cognitoUserPoolId?: string;
  webSocketApi?: WebSocketApi;
  logLevel?: string;
  adminEmailBucket?: Bucket
}

export class RestApiStack extends Stack {

  public apiGatewayEndpoint: string;
  public restApi: RestApi;

  constructor(scope: Construct, id: string, props?: RestApiProps) {
    super(scope, id, props);


    //props for lambdas
    const dynamoTable = new Table(this, 'items', {
      partitionKey: {
        name: 'itemId',
        type: AttributeType.STRING
      },
      tableName: 'items',

      /**
       *  The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
       * the new table, and it will remain in your account until manually deleted. By setting the policy to
       * DESTROY, cdk destroy will delete the table (even if it has data in it)
       */
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const metadataTable = new Table(this, 'adminEmailMetadataDynamoTable', {
      partitionKey: {
        name: 'pkey',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'skey',
        type: AttributeType.STRING
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      tableName: 'adminMetadataTable',
      removalPolicy: RemovalPolicy.RETAIN, // NOT recommended for production use
      encryption: TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: false // set to "true" to enable PITR
    });



    const adminEmailBucket = new s3.Bucket(this, 'AdminEmailBucket', {
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.RETAIN, // NOT recommended for production use
      autoDeleteObjects: false, // NOT recommended for production use

    });

    const sharedLambdaProps: NodejsFunctionProps = {
      bundling: {
        externalModules: [
        ],
        nodeModules: [
          '@aws-lambda-powertools/logger',
          '@aws-lambda-powertools/tracer',
          'aws-jwt-verify'
        ],
      },
      depsLockFilePath: join(__dirname, '../resources/', 'package-lock.json'),
      environment: {
        // CHANNELS_TABLE_NAME: props?.channelsTable.tableName!,
        // CONNECTIONS_TABLE_NAME: props?.connectionsTable.tableName!,
        // MESSAGES_TABLE_NAME: props?.messagesTable.tableName!,
        // COGNITO_USER_POOL_ID: props?.cognitoUserPoolId!,
        // WEBSOCKET_API_URL: `${props?.webSocketApi.apiEndpoint!}/wss`,
        LOG_LEVEL: props?.logLevel!,
        PRIMARY_KEY: 'itemId',
        TABLE_NAME: dynamoTable.tableName,
        METADATA_TABLE_NAME: metadataTable.tableName,
        EMAIL_BUCKET: adminEmailBucket.bucketName
      },
      runtime: Runtime.NODEJS_LATEST,
      memorySize: 256,
      timeout: Duration.seconds(10)
    }


    // const nodeJsFunctionProps: NodejsFunctionProps = {
    //   bundling: {
    //     externalModules: [
    //       'aws-sdk', // Use the 'aws-sdk' available in the Lambda runtime
    //     ],
    //   },
    //   depsLockFilePath: join(__dirname, `../resources/`, 'package-lock.json'),
    // environment: {
    // PRIMARY_KEY: 'itemId',
    // TABLE_NAME: dynamoTable.tableName,
    // },
    //   runtime: Runtime.NODEJS_LATEST,
    // }





    //Email Bucket and Lambda Integration


    // adminEmailBucket.addToResourcePolicy(new PolicyStatement({
    //   effect: Effect.ALLOW,
    //   principals: [
    //     new ServicePrincipal('ses.amazonaws.com'),
    //   ],
    //   actions: [
    //     "s3:PutObject"
    //   ],
    //   resources: [`${adminEmailBucket.bucketArn}/*`],
    //   conditions: {
    //     "Bool": { "aws:SecureTransport": "false" },
    //   },
    // }));


    // adminEmailBucket.addToResourcePolicy(new PolicyStatement({
    //   effect: Effect.ALLOW,
    //   principals: [
    //     new AnyPrincipal()
    //   ],
    //   actions: [
    //     "s3:GetObject"
    //   ],
    //   resources: [`${adminEmailBucket.bucketArn}/*`],
    // }));


    // adminEmailBucket.addToResourcePolicy(new PolicyStatement({
    //   effect: Effect.ALLOW,
    //   principals: [
    //     new AnyPrincipal()
    //   ],
    //   actions: [
    //     "s3:ListBucket"
    //   ],
    //   resources: [adminEmailBucket.bucketArn],
    // }));

    // adminEmailBucket.addToResourcePolicy(new PolicyStatement({
    //   effect: Effect.DENY,
    //   principals: [
    //     new AnyPrincipal(),
    //   ],
    //   actions: [
    //     "s3:*"
    //   ],
    //   resources: [adminEmailBucket.bucketArn],
    //   conditions: {
    //     "Bool": { "aws:SecureTransport": "false" },
    //   },
    // }));


    // adminEmailBucket.addToResourcePolicy(new PolicyStatement({
    //   effect: Effect.ALLOW,
    //   principals: [
    //     new ServicePrincipal("ses.amazonaws.com")
    //   ],
    //   actions: [
    //     "s3:PutObject"
    //   ],
    //   resources: [adminEmailBucket.bucketArn],
    //   conditions: {
    //     "StringEquals": {
    //       "aws:Referer": Stack.of(this).account
    //     }
    //   }
    // }));




    //COGNITO AUTH FUNCTIONS

    const listUserLambda = new NodejsFunction(this, 'listUserAsAdminFunction', {
      entry: join(__dirname, `/../resources/handlers/auth/`, 'list-users.ts'),
      ...sharedLambdaProps,
    });
    listUserLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["cognito-idp:ListUsers", "cognito-idp:ListUsersInGroup"],
        resources: [
          `arn:aws:cognito-idp:${Stack.of(this).region}:${Stack.of(this).account}:userpool/${props?.cognitoUserPoolId!}`,
        ],
      })
    );




    const signupUserLambda = new NodejsFunction(this, 'signupUserFunction', {
      entry: join(__dirname, `/../resources/handlers/auth/`, 'signup-user.ts'),
      ...sharedLambdaProps,
    });

    signupUserLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["cognito-idp:AdminCreateUser", "cognito-idp:AdminAddUserToGroup"],
        resources: [
          `arn:aws:cognito-idp:${Stack.of(this).region}:${Stack.of(this).account}:userpool/${props?.cognitoUserPoolId!}`,
        ],
      })
    );

    signupUserLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["ssm:GetParameter"],
        resources: [
          `arn:aws:ssm:${Stack.of(this).region}:${Stack.of(this).account}:parameter/prod/cognito/clientid`,
        ],
      })
    );

    const assignUserToEmployeeGroupLambda = new NodejsFunction(this, 'assignUserToEmployeeGroupFunction', {
      entry: join(__dirname, `/../resources/handlers/auth/`, 'assign-employee.ts'),
      ...sharedLambdaProps,
    });

    assignUserToEmployeeGroupLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["cognito-idp:AdminAddUserToGroup"],
        resources: [
          `arn:aws:cognito-idp:${Stack.of(this).region}:${Stack.of(this).account}:userpool/${props?.cognitoUserPoolId!}`,
        ],
      })
    );


    const deleteUserLambda = new NodejsFunction(this, 'deleteUserFunction', {
      entry: join(__dirname, `/../resources/handlers/auth/`, 'delete-user.ts'),
      ...sharedLambdaProps,
    });

    deleteUserLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["cognito-idp:AdminDeleteUser"],
        resources: [
          `arn:aws:cognito-idp:${Stack.of(this).region}:${Stack.of(this).account}:userpool/${props?.cognitoUserPoolId!}`,
        ],
      })
    );

    const deleteUserLambdaIntegration = new LambdaIntegration(deleteUserLambda)
    const listUserLambdaIntegration = new LambdaIntegration(listUserLambda);
    const signupUserLambdaIntegration = new LambdaIntegration(signupUserLambda);
    const assignUserToEmployeeGroupLambdaIntegration = new LambdaIntegration(assignUserToEmployeeGroupLambda)



    const forwardEmailToS3Lambda = new NodejsFunction(this, 'forwardEmailToS3Function', {
      entry: join(__dirname, `/../resources/handlers/email/`, 'forward-to-s3.ts'),
      ...sharedLambdaProps,
    });

    const getEmailsFromS3Lambda = new NodejsFunction(this, 'getEmailsFromS3Lambda', {
      entry: join(__dirname, `/../resources/handlers/email/`, 'get-from-s3.ts'),
      ...sharedLambdaProps,
    });

    const getEmailsFromDynamoLambda = new NodejsFunction(this, 'getEmailsFromDynamoLambda', {
      entry: join(__dirname, `/../resources/handlers/email/`, 'get-from-dynamo.ts'),
      ...sharedLambdaProps,
    });

    const getOneEmailFromS3Lambda = new NodejsFunction(this, 'getOneEmailFromS3Lambda', {
      entry: join(__dirname, `/../resources/handlers/email/`, 'get-one-from-s3.ts'),
      ...sharedLambdaProps,
    });

    const getPresignedUrlFromS3Lambda = new NodejsFunction(this, 'getPresignedUrlFromS3Lambda', {
      entry: join(__dirname, `/../resources/handlers/email/`, 'get-presigned-url.ts'),
      ...sharedLambdaProps,
    });

    const writeMetadataToDynamoLambda = new NodejsFunction(this, 'writeMetadataToDynamoLambda', {
      entry: join(__dirname, `/../resources/handlers/email/`, 'create-metadata.ts'),
      ...sharedLambdaProps,
    });

    forwardEmailToS3Lambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["s3:*"],
        resources: [adminEmailBucket.bucketArn],
      })
    );

    getEmailsFromS3Lambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["s3:*"],
        resources: [adminEmailBucket.bucketArn],
      })
    );

    writeMetadataToDynamoLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["s3:*"],
        resources: [adminEmailBucket.bucketArn],
      })
    );

    const s3PutEventSource = new S3EventSource(adminEmailBucket, {
      events: [
        s3.EventType.OBJECT_CREATED_PUT
      ]
    });

    writeMetadataToDynamoLambda.addEventSource(s3PutEventSource);
    metadataTable.grantReadWriteData(writeMetadataToDynamoLambda)
    metadataTable.grantReadWriteData(getEmailsFromDynamoLambda)

    const getEmailsFromDynamoIntegration = new LambdaIntegration(getEmailsFromDynamoLambda);
    const getEmailsFromS3Integration = new LambdaIntegration(getEmailsFromS3Lambda);
    const getOneEmailFromS3Integration = new LambdaIntegration(getOneEmailFromS3Lambda);
    const getPresignedUrlFromS3Integration = new LambdaIntegration(getPresignedUrlFromS3Lambda);


    // Create a Lambda function for each of the CRUD operations
    const getOneLambda = new NodejsFunction(this, 'getOneItemFunction', {
      entry: join(__dirname, `/../resources/handlers/crud/`, 'get-one.ts'),
      ...sharedLambdaProps,
    });
    const getAllLambda = new NodejsFunction(this, 'getAllItemsFunction', {
      entry: join(__dirname, `/../resources/handlers/crud/`, 'get-all.ts'),
      ...sharedLambdaProps,
    });
    const createOneLambda = new NodejsFunction(this, 'createItemFunction', {
      entry: join(__dirname, `/../resources/handlers/crud/`, 'create.ts'),
      ...sharedLambdaProps,
    });
    const updateOneLambda = new NodejsFunction(this, 'updateItemFunction', {
      entry: join(__dirname, `/../resources/handlers/crud/`, 'update-one.ts'),
      ...sharedLambdaProps,
    });
    const deleteOneLambda = new NodejsFunction(this, 'deleteItemFunction', {
      entry: join(__dirname, `/../resources/handlers/crud/`, 'delete-one.ts'),
      ...sharedLambdaProps,
    });

    // Grant the Lambda function read access to the DynamoDB table
    dynamoTable.grantReadWriteData(getAllLambda);
    dynamoTable.grantReadWriteData(getOneLambda);
    dynamoTable.grantReadWriteData(createOneLambda);
    dynamoTable.grantReadWriteData(updateOneLambda);
    dynamoTable.grantReadWriteData(deleteOneLambda);


    adminEmailBucket.grantReadWrite(getOneLambda)

    // Integrate the Lambda functions with the API Gateway resource
    const getAllIntegration = new LambdaIntegration(getAllLambda);
    const createOneIntegration = new LambdaIntegration(createOneLambda);
    const getOneIntegration = new LambdaIntegration(getOneLambda);
    const updateOneIntegration = new LambdaIntegration(updateOneLambda);
    const deleteOneIntegration = new LambdaIntegration(deleteOneLambda);


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



    const getEmployeesHandler = new NodejsFunction(this, 'getEmployeesHandler', {
      entry: path.join(__dirname, `/../resources/handlers/rest/get-employees.ts`),
      ...sharedLambdaProps,
    });

    getEmployeesHandler.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["cognito-idp:ListUsers", "cognito-idp:ListUsersInGroup"],
        resources: [
          `arn:aws:cognito-idp:${Stack.of(this).region}:${Stack.of(this).account}:userpool/${props?.cognitoUserPoolId!}`,
        ],
      })
    );

    // Create a Lambda function for each of the CRUD operations
    const getUsersHandler = new NodejsFunction(this, 'getUsersHandler', {
      entry: path.join(__dirname, `/../resources/handlers/rest/get-users.ts`),
      ...sharedLambdaProps,
    });
    props?.connectionsTable.grantReadData(getUsersHandler);
    getUsersHandler.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["cognito-idp:ListUsers"],
        resources: [
          `arn:aws:cognito-idp:${Stack.of(this).region}:${Stack.of(this).account}:userpool/${props?.cognitoUserPoolId!}`,
        ],
      })
    );

    const getConfigHandler = new NodejsFunction(this, 'getCConfigHandler', {
      entry: path.join(__dirname, `/../resources/handlers/rest/get-config.ts`),
      ...sharedLambdaProps,
    });
    getConfigHandler.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ],
        resources: [
          `arn:aws:ssm:${Stack.of(this).region}:${Stack.of(this).account}:parameter/prod/cognito/signinurl`,
          `arn:aws:ssm:${Stack.of(this).region}:${Stack.of(this).account}:parameter/prod/websocket/url`,
        ],
      })
    );

    const getChannelsHandler = new NodejsFunction(this, 'getChannelsHandler', {
      entry: path.join(__dirname, `/../resources/handlers/rest/get-channels.ts`),
      ...sharedLambdaProps,
    });

    const postChannelsHandler = new NodejsFunction(this, 'postChannelsHandler', {
      entry: path.join(__dirname, `/../resources/handlers/rest/post-channels.ts`),
      ...sharedLambdaProps,
    });

    const getChannelHandler = new NodejsFunction(this, 'getChannelHandler', {
      entry: path.join(__dirname, `/../resources/handlers/rest/get-channel.ts`),
      ...sharedLambdaProps,
    });

    const getChannelMessagesHandler = new NodejsFunction(this, 'getChannelMessagesHandler', {
      entry: path.join(__dirname, `/../resources/handlers/rest/get-channel-messages.ts`),
      ...sharedLambdaProps,
    });


    getChannelsHandler.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["cognito-idp:ListUsers", "cognito-idp:ListUsersInGroup"],
        resources: [
          `arn:aws:cognito-idp:${Stack.of(this).region}:${Stack.of(this).account}:userpool/${props?.cognitoUserPoolId!}`,
        ],
      })
    );

    // Grant the Lambda functions read/write access to the DynamoDB tables
    props?.channelsTable.grantReadWriteData(getChannelsHandler);
    props?.channelsTable.grantReadData(getChannelsHandler);
    props?.channelsTable.grantReadWriteData(postChannelsHandler);
    props?.channelsTable.grantReadData(getChannelHandler);
    props?.messagesTable.grantReadData(getChannelMessagesHandler);

    // Integrate the Lambda functions with the API Gateway resource
    const getConfigIntegration = new LambdaIntegration(getConfigHandler);
    const getUsersIntegration = new LambdaIntegration(getUsersHandler);
    const getChannelsIntegration = new LambdaIntegration(getChannelsHandler);
    const postChannelsIntegration = new LambdaIntegration(postChannelsHandler);
    const getChannelIntegration = new LambdaIntegration(getChannelHandler);
    const getChannelMessagesIntegration = new LambdaIntegration(getChannelMessagesHandler);
    const getEmployeesIntegration = new LambdaIntegration(getEmployeesHandler);

    this.restApi = new RestApi(this, 'ServerlessChatRestApi', {
      restApiName: 'Serverless Chat REST API'
    });

    this.apiGatewayEndpoint = this.restApi.url;

    const userPool = UserPool.fromUserPoolId(this, "UserPool", props?.cognitoUserPoolId!);
    const auth = new CognitoUserPoolsAuthorizer(this, 'websocketChatUsersAuthorizer', {
      cognitoUserPools: [userPool],
    });
    const authMethodOptions = { authorizer: auth, authorizationType: AuthorizationType.COGNITO };

    const api = this.restApi.root.addResource('api');

    const config = api.addResource('config');
    /* [GET]  /config - Retrieve all users with online/offline status */
    config.addMethod('GET', getConfigIntegration);

    const users = api.addResource('users');
    /* [GET]  /users - Retrieve all users with online/offline status */
    users.addMethod('GET', getUsersIntegration, authMethodOptions);


    const employees = api.addResource('employees');
    /* [GET]  /users - Retrieve all users with online/offline status */
    employees.addMethod('GET', getEmployeesIntegration, authMethodOptions);

    const channels = api.addResource('channels');
    /* [GET]  /channels - Retrieve all channels with participant details */
    channels.addMethod('GET', getChannelsIntegration, authMethodOptions);
    /* [POST] /channels - Creates a new channel */
    channels.addMethod('POST', postChannelsIntegration, authMethodOptions);
    /* [ANY] /channels/{id} - retrieves channel with specific ID */
    const channelId = channels.addResource('{id}');
    channelId.addMethod('GET', getChannelIntegration, authMethodOptions);

    const messages = channelId.addResource('messages');
    /* [GET]  /channels/{ID}/messages - Retrieve top 100 messages for a specific channel */
    messages.addMethod('GET', getChannelMessagesIntegration, authMethodOptions);



    const emails = api.addResource('emails');
    emails.addMethod('GET', getEmailsFromS3Integration, authMethodOptions);
    emails.addMethod('POST', getOneEmailFromS3Integration, authMethodOptions);

    const upload = api.addResource('upload');
    upload.addMethod('POST', getPresignedUrlFromS3Integration, authMethodOptions);


    /* [GET]  /email - Retrieve all emails from dynamo metadata table */
    const email = api.addResource('email');
    email.addMethod('GET', getEmailsFromDynamoIntegration, authMethodOptions);

    const items = api.addResource('items');
    items.addMethod('GET', getAllIntegration);
    items.addMethod('POST', createOneIntegration);

    const singleItem = items.addResource('{id}');
    singleItem.addMethod('GET', getOneIntegration, authMethodOptions);
    singleItem.addMethod('PATCH', updateOneIntegration, authMethodOptions);
    singleItem.addMethod('DELETE', deleteOneIntegration, authMethodOptions);

    const authRoute = api.addResource('au');
    authRoute.addMethod('GET', listUserLambdaIntegration, authMethodOptions)
    authRoute.addMethod('PUT', signupUserLambdaIntegration, authMethodOptions)
    authRoute.addMethod('DELETE', deleteUserLambdaIntegration, authMethodOptions)

    const group = authRoute.addResource('group')
    group.addMethod('POST', assignUserToEmployeeGroupLambdaIntegration, authMethodOptions)

    addCorsOptions(group);
    addCorsOptions(authRoute);
    addCorsOptions(items);
    addCorsOptions(singleItem);
    addCorsOptions(email);
    addCorsOptions(config);
    addCorsOptions(users);
    addCorsOptions(employees);
    addCorsOptions(channels);
    addCorsOptions(messages);
  }
};

export function addCorsOptions(apiResource: IResource) {
  apiResource.addMethod('OPTIONS', new MockIntegration({
    integrationResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
        'method.response.header.Access-Control-Allow-Origin': "'*'",
        'method.response.header.Access-Control-Allow-Credentials': "'false'",
        'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
      },
    }],
    passthroughBehavior: PassthroughBehavior.NEVER,
    requestTemplates: {
      "application/json": "{\"statusCode\": 200}"
    },
  }), {
    methodResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
        'method.response.header.Access-Control-Allow-Credentials': true,
        'method.response.header.Access-Control-Allow-Origin': true,
      },
    }]
  })
}