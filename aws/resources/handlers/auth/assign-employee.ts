
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { LambdaInterface } from '@aws-lambda-powertools/commons';
const { COGNITO_USER_POOL_ID } = process.env;
import { AdminAddUserToGroupCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider"; // ES Modules import

const addUserToEmployeeGroup = async ({ username }: { username: string }) => {
    const client = new CognitoIdentityProviderClient({});
    const command = new AdminAddUserToGroupCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        Username: username,
        GroupName: 'employeeGroup'
    });

    return client.send(command);
};
class Lambda implements LambdaInterface {
    // @tracer.captureLambdaHandler()
    public async handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {

        const { username } = JSON.parse(event.body!);
        console.log(event.body)

        const res = await addUserToEmployeeGroup({ username });
        console.log(res)

        return {
            statusCode: 200,
            body: JSON.stringify(res)
        }
    }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;