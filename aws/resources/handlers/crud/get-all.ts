import { APIGatewayProxyEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import * as jwt from 'jsonwebtoken';


const TABLE_NAME = process.env.TABLE_NAME || '';

const db = new AWS.DynamoDB.DocumentClient();

export const handler = async (event: APIGatewayProxyEvent): Promise<any> => {


  const now = new Date()
  const twoWeeksAgo = new Date(new Date(now).setDate(now.getDate() - 14)).toISOString()
  const fourMonthsAgo = new Date(new Date(now).setDate(now.getDate() - 120)).toISOString()


  // const params = {
  //   // Define the expression attribute value, which are substitutes for the values you want to compare.
  //   ExpressionAttributeValues: {
  //     ":creationDate": twoWeeksAgo,
  //   },
  //   // Specify which items in the results are returned.
  //   FilterExpression: "creationDate >= :creationDate",
  //   TableName: TABLE_NAME
  // };

  console.log({ event })
  let token
  try {
    token = event.headers?.Authorization;
    console.log("Token is valid. Payload:", token?.substring(0, 5));
  } catch {
    console.log("Token not valid!");
  }


  //check cognito user group
  let userGroups = []
  let payloadUsername = ''
  try {
    const decodedJwt = jwt.decode(token as string, { complete: true }) as any
    // console.log({ decodedJwt })
    userGroups = decodedJwt?.payload ? decodedJwt?.payload['cognito:groups'] : []
    payloadUsername = decodedJwt?.payload ? decodedJwt?.payload['cognito:username'] : ''

  } catch (error) {
    console.log("Error getting user groups!");
  }


  let dbParams: any = {
    // Define the expression attribute value, which are substitutes for the values you want to compare.
    ExpressionAttributeValues: {
      ":creationDate": fourMonthsAgo,
    },
    // Specify which items in the results are returned.
    FilterExpression: "creationDate >= :creationDate",
    TableName: TABLE_NAME
  };

  if (userGroups.includes('adminGroup')) {
    console.log('requested by admin, overriding params')
    // response.body = JSON.stringify(data.Items)
    dbParams = {
      // Define the expression attribute value, which are substitutes for the values you want to compare.
      ExpressionAttributeValues: {
        ":creationDate": fourMonthsAgo,
      },
      // Specify which items in the results are returned.
      FilterExpression: "creationDate >= :creationDate",
      TableName: TABLE_NAME
    };
    console.log({ dbParams })
  }




  //decode jwt to determine user group
  //admin gets all, employees only get tasks for their id

  // todo here below, leverage cognito instead of checking jwt directly

  // const verifier = CognitoJwtVerifier.create({
  //   userPoolId: "<user_pool_id>", // mandatory, can't be overridden upon calling verify
  //   tokenUse: "id", // needs to be specified here or upon calling verify
  //   clientId: "<client_id>", // needs to be specified here or upon calling verify
  //   groups: "admins", // optional
  //   graceSeconds: 0, // optional
  //   scope: "my-api/read", // optional
  //   // customJwtCheck: (payload, header, jwk) => {}, // optional
  // });


  const scanResults: any = []
  let data: any
  try {
    do {
      data = await db.scan(dbParams).promise();
      data.Items.forEach((item: any) => scanResults.push(item));
      // console.log({ dbresponse: scanResults })
      dbParams.ExclusiveStartKey = data.LastEvaluatedKey;
    } while (typeof data.LastEvaluatedKey !== "undefined");

    console.log('reassign scanresults to data.items', data, scanResults)
    data.Items = scanResults;
    console.log('BEFORE DELETION FILTER', data.Items)
    data.Items = data.Items?.filter((item: any) => !item.markedForDeletion)
    console.log('BEFORE DELETION FILTER', data.Items)
    let response = { statusCode: 200, body: 'null' };
    //admin gets all tasks

    response.body = JSON.stringify(data.Items)
    // if (userGroups.includes('adminGroup')) {
    //   console.log('requested by admin')
    //   response.body = JSON.stringify(data.Items)
    // }
    // if (userGroups.includes('employeeGroup')) {
    //   console.log('requested by employee, filtering down')
    //   console.log({ payloadUsername, rawData: JSON.stringify(data.Items) })
    //   const filteredResponse = data.Items?.filter((item:any) => {
    //     return item?.assignees?.some((assignedMember: any) => assignedMember?.Username === payloadUsername)
    //   })
    //   response.body = JSON.stringify(filteredResponse)
    // }


    return response
  } catch (dbError) {
    return { statusCode: 500, body: JSON.stringify(dbError) };
  }
};
