import * as aws from "@pulumi/aws";
import { describe, it } from "mocha";
import { expect } from 'chai';

import { promise } from "./";
import * as infra from "../index";

describe("Infrastructure", () => {
    const webServer: aws.ec2.Instance = infra.webServer;
    describe("#server", () => {
        it("must have a name tag", async () => {
            const tags = await promise(webServer.tags);
            expect((tags || {})["Name"]).is.not.undefined;
        });
    });

    const webSg: aws.ec2.SecurityGroup = infra.webSg;
    describe("#group", function () {
        it("must not have public internet access", async () => {
            const rules = await promise(webSg.ingress);
            const publicInternet = (rules || []).find(rule =>
                (rule.cidrBlocks || []).find(cidr =>
                    cidr === "0.0.0.0/0"
                )
            );
            expect(publicInternet).is.undefined;
        });
    });
});
