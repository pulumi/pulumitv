// Copyright 2018, Pulumi Corporation.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as aws from  "@pulumi/aws";
import * as awsx from  "@pulumi/awsx";
import * as awslambda from "aws-lambda";
import * as pulumi from "@pulumi/pulumi";
import * as github from "@pulumi/github";
import * as random from "@pulumi/random";
import { WebhookEvent } from "@octokit/webhooks-definitions/schema";

export interface GitHubWebhookRequest {
    token: string,
    request: awsx.apigateway.Request;
    type: string;
    id: string;
    data: WebhookEvent;
}

export interface GitHubWebhookArgs {
    repository: string;
    handler: (req: GitHubWebhookRequest) => Promise<void>;
    events: string[];
    token: pulumi.Output<string>;
}

export class GitHubWebhook extends pulumi.ComponentResource {
    public readonly url: pulumi.Output<string>;

    constructor(name: string, args: GitHubWebhookArgs, opts?: pulumi.ResourceOptions) {
        super("github:rest:Hook", name, {}, opts);

        const secret = new random.RandomString("shared-secret", {
            length: 16,
        }, {
            parent: this,
        });

        const api = new awsx.apigateway.API("hook", {
            routes: [
                {
                    path: "/",
                    method: "POST",
                    eventHandler: new aws.lambda.CallbackFunction<awslambda.APIGatewayProxyEvent, awslambda.APIGatewayProxyResult>("callback", {
                        callback: async (req: awslambda.APIGatewayProxyEvent): Promise<awslambda.APIGatewayProxyResult> => {
                            const eventType = req.headers["X-GitHub-Event"];
                            const eventId = req.headers["X-GitHub-Delivery"];
                            const eventSig = req.headers["X-Hub-Signature"];

                            if (!(eventType && eventId && eventSig && req.body)) {
                                return {
                                    statusCode: 400,
                                    body: "missing parameter",
                                };
                            }

                            const body = Buffer.from(req.body, req.isBase64Encoded ? "base64" : "utf8");

                            const crypto = await import("crypto");
                            const hmac = crypto.createHmac("sha1", secret.result.get());
                            hmac.update(body);

                            const digest = `sha1=${hmac.digest("hex")}`;

                            if (!crypto.timingSafeEqual(Buffer.from(eventSig), Buffer.from(digest))) {
                                console.log(`[${eventId}] ignorning, bad signature ${digest} != ${eventSig}`);
                                return {
                                    statusCode: 400,
                                    body: "bad signature",
                                };
                            }

                            const event = JSON.parse(body.toString());

                            await args.handler({
                                token: process.env.TOKEN!,
                                request: req,
                                type: eventType,
                                id: eventId,
                                data: event,
                            });

                            return {
                                statusCode: 200,
                                body: "",
                            };
                        },
                        environment: {
                            variables: {
                                TOKEN: args.token,
                            },
                        },
                    }),
                },
            ],
        }, {
            parent: this,
        });

        new github.RepositoryWebhook(`${name}-registration`, {
            repository: args.repository,
            events: args.events,
            configuration: {
                contentType: "application/json",
                secret: secret.result,
                url: api.url,
            },
        },
        {
            parent: this,
        });

        this.url = api.url;
    }
}
