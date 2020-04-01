import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import axios from "axios";

const config = new pulumi.Config();
const slackWebhookUrl = config.requireSecret("slackWebhookUrl");

const myDetector = new aws.guardduty.Detector("detector", {
    enable: true,
});

const rule = new aws.cloudwatch.EventRule("guard-duty-rule", {
    eventPattern: JSON.stringify({
        source: ["aws.guardduty"]
    })
});

const callbackFunction = new aws.lambda.CallbackFunction<aws.cloudwatch.EventRuleEvent, void>("callback", {
    environment: {
        variables: {
            SLACK_WEBHOOK_URL: slackWebhookUrl
        }
    },
    callback: (event) => {
            try {
                axios.post(process.env.SLACK_WEBHOOK_URL!, {
                    text: "Amazon GuardDuty has detected new findings!"
                });
            } catch (e) {
                console.log(e);
            }
        }
});

rule.onEvent("guard-duty-callback", callbackFunction);
