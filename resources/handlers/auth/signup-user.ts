
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { LambdaInterface } from '@aws-lambda-powertools/commons';
const { COGNITO_USER_POOL_ID } = process.env;
import { AdminAddUserToGroupCommand, AdminAddUserToGroupRequestFilterSensitiveLog, AdminCreateUserCommand, CognitoIdentityProviderClient, ListUsersInGroupCommand, SignUpCommand } from "@aws-sdk/client-cognito-identity-provider"; // ES Modules import
import { SSM } from "aws-sdk";

const getParameterWorker = async (name: string, decrypt: boolean): Promise<any> => {
    const ssm = new SSM();
    const result = await ssm
        .getParameter({ Name: name, WithDecryption: decrypt })
        .promise();

    return result.Parameter ? result.Parameter.Value : null;
}

export const getParameter = async (name: string): Promise<string> => {
    return getParameterWorker(name, false);
}

// export const addUserToEmployeeGroup = async (userId:string): Promise<any> => {
//     return 
// }


const signUpAsEmployee = async ({ username, email }: { username: string, email: string }) => {
    const client = new CognitoIdentityProviderClient({});
    const command = new AdminCreateUserCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        Username: username,
        UserAttributes: [{ Name: "email", Value: email }],
        DesiredDeliveryMediums: ['EMAIL'],
    });

    const res = await client.send(command);
    const addToGroupCommand = new AdminAddUserToGroupCommand({
        GroupName: 'employeeGroup',
        Username: res.User?.Username,
        UserPoolId: COGNITO_USER_POOL_ID,
    })

    return client.send(addToGroupCommand)
};
class Lambda implements LambdaInterface {
    // @tracer.captureLambdaHandler()
    public async handler(event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> {

        const { username, email } = JSON.parse(event.body!);
        console.log(event.body)

        const res = await signUpAsEmployee({ username, email });
        console.log(res)


        return {
            statusCode: 200,
            body: JSON.stringify(res)
        }
    }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;