
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { LambdaInterface } from '@aws-lambda-powertools/commons';
const { COGNITO_USER_POOL_ID } = process.env;
import { AdminDeleteUserCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider"; // ES Modules import

const deleteCognitoUser = async ({ username, email }: { username: string, email: string }) => {
    const client = new CognitoIdentityProviderClient({});
    const command = new AdminDeleteUserCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        Username: username,
    });

    return client.send(command);
};
class Lambda implements LambdaInterface {
    // @tracer.captureLambdaHandler()
    public async handler(event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> {

        const { username, email } = JSON.parse(event.body!);
        console.log(event.body)

        const res = await deleteCognitoUser({ username, email });
        console.log(res)

        return {
            statusCode: 200,
            body: JSON.stringify(res)
        }
    }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;