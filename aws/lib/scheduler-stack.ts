// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { AuthorizationType, CognitoUserPoolsAuthorizer, LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, BillingMode, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, Policy, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from 'constructs';
import { join } from "path";

// Test auth configuration to use with a locally hosted frontend
export class SchedulerStack extends Stack {
    public apiGatewayEndpoint: string;
    public restApi: RestApi;



    constructor(scope: Construct, id: string, props?: StackProps & { cognitoUserPoolId: any }) {
        super(scope, id, props);



        const eventsTable = new Table(this, 'ClientTasks', {
            partitionKey: {
                name: 'ClientId',
                type: AttributeType.STRING
            },
            sortKey: {
                name: 'TaskId',
                type: AttributeType.STRING
            },

            billingMode: BillingMode.PAY_PER_REQUEST,
            tableName: 'ClientTasks',
            removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production use
            encryption: TableEncryption.AWS_MANAGED,
            pointInTimeRecovery: false // set to "true" to enable PITR
        });

        eventsTable.addGlobalSecondaryIndex({
            indexName: 'ScheduledDate',
            partitionKey: {
                name: 'ScheduledDate',
                type: AttributeType.STRING
            }
        })



        const sharedLambdaProps: NodejsFunctionProps = {
            bundling: {
                externalModules: [
                ],
                nodeModules: [
                    '@aws-lambda-powertools/logger',
                    '@aws-lambda-powertools/tracer',
                    'aws-jwt-verify',
                ],
            },
            depsLockFilePath: join(__dirname, '../resources/', 'package-lock.json'),
            environment: {
                EVENT_TABLE: eventsTable.tableName
            },
            runtime: Runtime.NODEJS_LATEST,
            memorySize: 256,
            timeout: Duration.seconds(10)
        }

        const rateBasedLambda = new NodejsFunction(this, 'rateBasedLambda', {
            entry: join(__dirname, `/../resources/handlers/events/`, 'rate-based-lambda.ts'),
            ...sharedLambdaProps,
        });



        const schedulerRole = new Role(this, "schedulerRole", {
            assumedBy: new ServicePrincipal("scheduler.amazonaws.com"),
        });


        const rateProps: NodejsFunctionProps = {
            ...sharedLambdaProps, environment: {
                RATE_LAMBDA_ARN: rateBasedLambda.functionArn,
                ROLE_ARN: schedulerRole.roleArn
            }
        }

        const eventLambda = new NodejsFunction(this, 'eventLambda', {
            entry: join(__dirname, `/../resources/handlers/events/`, 'event-lambda.ts'),
            ...rateProps,
        });

        eventLambda.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["scheduler:CreateSchedule", "scheduler:CreateScheduleGroup", "iam:PassRole"],
                resources: [
                    "*"
                ],
            })
        );

        const invokeLambdaPolicy = new Policy(this, "invokeLambdaPolicy", {
            document: new PolicyDocument({
                statements: [
                    new PolicyStatement({
                        actions: ["lambda:InvokeFunction"],
                        resources: [eventLambda.functionArn, rateBasedLambda.functionArn],
                        effect: Effect.ALLOW,
                    }),
                ],
            }),
        });

        schedulerRole.attachInlinePolicy(invokeLambdaPolicy);


        const getAllEventGroupsLambda = new NodejsFunction(this, 'getAllEventGroupsLambda', {
            entry: join(__dirname, `/../resources/handlers/events/`, 'get-all-events.ts'),
            ...sharedLambdaProps,
        });

        getAllEventGroupsLambda.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["scheduler:ListScheduleGroups"],
                resources: [
                    "*"
                ],
            })
        );

        const getEventsInAGroupLambda = new NodejsFunction(this, 'getEventsInAGroupLambda', {
            entry: join(__dirname, `/../resources/handlers/events/`, 'get-events-in-group.ts'),
            ...sharedLambdaProps,
        });

        getEventsInAGroupLambda.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["scheduler:ListSchedules", "scheduler:ListScheduleGroups", "scheduler:GetSchedule"],
                resources: [
                    "*"
                ],
            })
        );


        const markEventCompleteLambda = new NodejsFunction(this, 'markEventCompleteLambda', {
            entry: join(__dirname, `/../resources/handlers/events/`, 'mark-event-complete.ts'),
            ...sharedLambdaProps,
        });

        markEventCompleteLambda.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["scheduler:ListSchedules", "scheduler:ListScheduleGroups", "scheduler:GetSchedule","scheduler:UpdateSchedule", "iam:PassRole"],
                resources: [
                    "*"
                ],
            })
        );

        const showCompletedEventsLambda = new NodejsFunction(this, 'showCompletedEventsLambda', {
            entry: join(__dirname, `/../resources/handlers/events/`, 'show-completed-tasks.ts'),
            ...sharedLambdaProps,
        });

  



        const deleteAnEventLambda = new NodejsFunction(this, 'deleteOneEventLambda', {
            entry: join(__dirname, `/../resources/handlers/events/`, 'delete-one-event.ts'),
            ...sharedLambdaProps,
        });

        deleteAnEventLambda.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["scheduler:DeleteSchedule"],
                resources: [
                    "*"
                ],
            })
        );


        const getAllSchedulesForAllGroupsLambda = new NodejsFunction(this, 'getAllSchedulesForAllGroupsLambda', {
            entry: join(__dirname, `/../resources/handlers/events/`, 'get-all-schedules.ts'),
            ...sharedLambdaProps,
        });

        getAllSchedulesForAllGroupsLambda.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["scheduler:ListSchedules", "scheduler:ListScheduleGroups", "scheduler:GetSchedule"],
                resources: [
                    "*"
                ],
            })
        );


        eventsTable.grantReadWriteData(eventLambda)
        eventsTable.grantReadWriteData(markEventCompleteLambda)
        eventsTable.grantReadWriteData(showCompletedEventsLambda)
        // Integrate the Lambda functions with the API Gateway resource
        const eventLambdaConfiguration = new LambdaIntegration(eventLambda);
        const getAllEventsLambdaConfiguration = new LambdaIntegration(getAllEventGroupsLambda);
        const getEventsInAGroupLambdaConfiguration = new LambdaIntegration(getEventsInAGroupLambda);
        const deleteAnEventLambdaConfiguration = new LambdaIntegration(deleteAnEventLambda)
        const getAllSchedulesForAllGroupsConfiguration = new LambdaIntegration(getAllSchedulesForAllGroupsLambda)
        const markEventCompleteConfiguration = new LambdaIntegration(markEventCompleteLambda)
        const showCompletedEventsConfiguration = new LambdaIntegration(showCompletedEventsLambda)

        this.restApi = new RestApi(this, 'ServerlessChatRestApi', {
            restApiName: 'Serverless Chat REST API'
        });

        this.apiGatewayEndpoint = this.restApi.url;

        const userPool = UserPool.fromUserPoolId(this, "UserPool", props?.cognitoUserPoolId!);
        const auth = new CognitoUserPoolsAuthorizer(this, 'websocketChatUsersAuthorizer', {
            cognitoUserPools: [userPool],
        });
        const authMethodOptions = { authorizer: auth, authorizationType: AuthorizationType.COGNITO };

        const api = this.restApi.root.addResource('v2');

        const event = api.addResource('event');
        /* [GET]  /config - Retrieve all users with online/offline status */
        event.addMethod('POST', eventLambdaConfiguration, authMethodOptions);


        const schedules = api.addResource('schedules');
        /* [GET]  /config - Retrieve all users with online/offline status */
        schedules.addMethod('GET', getAllEventsLambdaConfiguration, authMethodOptions);
        schedules.addMethod('POST', getEventsInAGroupLambdaConfiguration, authMethodOptions);
        schedules.addMethod('DELETE', deleteAnEventLambdaConfiguration, authMethodOptions);
        schedules.addMethod('PATCH', markEventCompleteConfiguration, authMethodOptions);

        const historical = api.addResource('history');
        historical.addMethod('GET', showCompletedEventsConfiguration, authMethodOptions)

        //used to get all events frome eventbridge
        const all = schedules.addResource('all')
        all.addMethod('GET',getAllSchedulesForAllGroupsConfiguration, authMethodOptions)
        // EventBridge Scheduler using L2 Constructs

    }


};