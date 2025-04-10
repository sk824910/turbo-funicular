import { APIGatewayProxyEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';


const TABLE_NAME = process.env.TABLE_NAME || '';

const db = new AWS.DynamoDB.DocumentClient();

export const handler = async (event: APIGatewayProxyEvent): Promise<any> => {
    const now = new Date()
    const twoMonthsAgo = new Date(new Date(now).setDate(now.getDate() - 60)).toISOString()
    let dbParams: any = {
        // Define the expression attribute value, which are substitutes for the values you want to compare.
        ExpressionAttributeValues: {
            ":startDate": twoMonthsAgo,
        },
        // Specify which items in the results are returned.
        FilterExpression: "startDate >= :startDate",
        TableName: 'ClientTasks'
    };

    const scanResults: any = []
    let data: any
    try {
        do {
            data = await db.scan({ TableName: 'ClientTasks' }).promise();
            data.Items.forEach((item: any) => scanResults.push(item));
            // console.log({ dbresponse: scanResults })
            dbParams.ExclusiveStartKey = data.LastEvaluatedKey;
        } while (typeof data.LastEvaluatedKey !== "undefined");

        // console.log('reassign scanresults to data.items', data, scanResults)
        data.Items = scanResults;
        // console.log('BEFORE DELETION FILTER', data.Items)
        // // data.Items = data.Items?.filter((item: any) => !item.markedForDeletion)
        // console.log('BEFORE DELETION FILTER', data.Items)
        let response = { statusCode: 200, body: 'null' };
        response.body = JSON.stringify(data.Items)
        //admin gets all tasks


        return response
    } catch (dbError) {
        return { statusCode: 500, body: JSON.stringify(dbError) };
    }
};
