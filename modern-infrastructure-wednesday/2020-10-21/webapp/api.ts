import * as exec from "child_process";
import * as path from "path";

import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";


export const apiProgram = async (cwd: string, cors?: string) => {

    const pulumiConfig = new pulumi.Config();
    const awsConfig = new pulumi.Config("aws");

    // Explicitly have a provider so that awsx picks up the correct region
    // so that it can create the ARNs appropriately since when aws
    // is imported, the config isn't set yet.
    const awsProvider = new aws.Provider("aws-us-west-2", {
        region: <aws.Region>awsConfig.get("region"),
    });

    const ddbTable = new aws.dynamodb.Table("table", {
        attributes: [{
            name: "id",
            type: "S"
        }],
        hashKey: "id",
        readCapacity: 1,
        writeCapacity: 1
    }, { provider: awsProvider });

    let headers: awsx.apigateway.Response["headers"] = undefined;
    const corsDomain = pulumiConfig.get("corsDomain");
    if (corsDomain)
    {
        headers = {
            "Access-Control-Allow-Headers" : "Content-Type",
            "Access-Control-Allow-Origin": corsDomain,
            "Access-Control-Allow-Methods": "OPTIONS,GET"
        };
    }
    
    const apiRoutes: awsx.apigateway.Route[] = [
        {
            path: "/counter",
            method: "GET",
            eventHandler: async () => {
                const client = new aws.sdk.DynamoDB.DocumentClient();
                const tableName = ddbTable.name.get();
                const counterId = "counter";
            
                const data = await client.get({
                    TableName: tableName,
                    Key: { id: counterId },
                    ConsistentRead: true,
                }).promise();
            
                const value = data.Item;
                const count = value?.count || 0;
            
                await client.put({
                    TableName: tableName,
                    Item: { id: counterId, count: count + 1 },
                }).promise();
            
                return {
                    headers,
                    statusCode: 200,
                    body: JSON.stringify({
                        "count": count
                    }),
                }
            },
        },
        {
            path: "/counter",
            method: "OPTIONS",
            eventHandler: async () => {
                return {
                    headers,
                    statusCode: 200,
                    body: "",
                };
            }
        }
    ];

    const api = new awsx.apigateway.API("webapp-api", {
        routes: apiRoutes
    }, {
        provider: awsProvider,
    });

    return {
        apiEndpoint: api.url,
    };
}
