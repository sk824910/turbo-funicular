
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { LambdaInterface } from '@aws-lambda-powertools/commons';
const { COGNITO_USER_POOL_ID } = process.env;
import { CognitoIdentityProviderClient, ListUsersInGroupCommand } from "@aws-sdk/client-cognito-identity-provider"; // ES Modules import

const listUsers = () => {
    const client = new CognitoIdentityProviderClient({ region: "us-east-1" });
    const command = new ListUsersInGroupCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        GroupName: 'employeeGroup' // required
    });
    return client.send(command);
};

class Lambda implements LambdaInterface {
    // @tracer.captureLambdaHandler()
    public async handler(event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> {


        const res = await listUsers();


        const body = JSON.stringify(res?.Users?.map((user: any) => {
            return {
                UserId: user.Attributes?.find((item: any) => item.Name === 'sub')?.Value,
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