import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

const api = new awsx.apigateway.API("api", {
    routes: [{
        localPath: "./app/build",
        path: "/",
    }, {
        path: "/api",
        method: "GET",
        eventHandler: async () => {
            return {
                headers: {
                    "Access-Control-Allow-Headers" : "Content-Type",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "OPTIONS,GET"
                },
                statusCode: 200,
                body: "hello",
            };
        }
    }, {
        path: "/api",
        method: "OPTIONS",
        eventHandler: async () => {
            return {
                headers: {
                    "Access-Control-Allow-Headers" : "Content-Type",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "OPTIONS,GET"
                },
                statusCode: 200,
                body: "",
            };
        }
    }]
});

export const url = api.url;