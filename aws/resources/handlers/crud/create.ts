import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const TABLE_NAME = process.env.TABLE_NAME || '';
const PRIMARY_KEY = process.env.PRIMARY_KEY || '';
const EMAIL_BUCKET = process.env.EMAIL_BUCKET || '';


export interface KanbanCard {
  id: string;
  title: string;
  description: string;
  progress?: number;
  assignees: any[];
  attachments?: any[];
  comments?: any[];
  startDate?: string;
  dueDate?: string;
  completed: boolean;
  priority: Object;
  taskList: any;
  from: string;
  dateReceived: string;
  message: String
}


const db = new AWS.DynamoDB.DocumentClient();
// const s3 = tracer.captureAWSClient(new AWS.S3({ apiVersion: '2006-03-01' }));
const s3 = new AWS.S3({ apiVersion: '2006-03-01' })
const RESERVED_RESPONSE = `Error: You're using AWS reserved keywords as attributes`,
  DYNAMODB_EXECUTION_ERROR = `Error: Execution update, caused a Dynamodb error, please take a look at your CloudWatch Logs.`;

export const handler = async (event: any = {}): Promise<any> => {

  if (!event.body) {
    return { statusCode: 400, body: 'invalid request, you are missing the parameter body' };
  }
  const item = typeof event.body == 'object' ? event.body : JSON.parse(event.body);

  const uuid = uuidv4()

  let obj: KanbanCard = {
    "title": item.title,
    "creationDate": new Date().toISOString().split('T')[0],
    //commenting out since this is now handled on forntend
    // [PRIMARY_KEY]: uuid,
    ...item
  }

  if (obj['attachments']) {
    delete obj['attachments']
  }


  const params = {
    TableName: TABLE_NAME,
    Item: obj
  };

  try {
    console.log({item,obj,params})
    await db.put(params).promise();


    // if (item?.attachments) {
    //   console.log('item has attachments, going to try s3')
    //   try {
    //     item.attachments.map((file: any) => {
    //       console.log('inside map \n',file)
    //       let uploadParams = { Bucket: EMAIL_BUCKET, Key: `${uuid}/${file?.name}`, Body: "" };
          
    //       uploadParams.Body = file.data;

    //       console.log({uploadParams})
    //       // call S3 to retrieve upload file to specified bucket
    //       s3.upload(uploadParams).promise();


    //     })

    //   } catch (e) {
    //     console.log(e)
    //   }

    // }




    return { statusCode: 201, body: '' };
  } catch (dbError: any) {
    const errorResponse = dbError.code === 'ValidationException' && dbError.message.includes('reserved keyword') ?
      RESERVED_RESPONSE : DYNAMODB_EXECUTION_ERROR;
    return { statusCode: 500, body: errorResponse };
  }
};
