import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const scheduledEvent = new aws.cloudwatch.EventRule("everySecond", {
    scheduleExpression: "rate(1 minute)"
});

const metricNamespace = "Pulumi";
const metricName = "AnomalyExample";

scheduledEvent.onEvent("scheduleHandler", async (event) => {
    const cloudwatch = new aws.sdk.CloudWatch();
    // we usually want to have 100, but once in a while, we'll be 1000
    let value = 100;
    if (Math.random() >= 0.9) {
        value = 1000;
    }

    try {
        await cloudwatch.putMetricData({
            Namespace: metricNamespace,
            MetricData: [{
                MetricName: metricName,
                Value: value
            }]
        }).promise();
    } catch (e) {
        console.log(e);
    }
});

const alarm = new aws.cloudwatch.MetricAlarm("anomalyAlarm", {
    name: "Anomaly Alarm",
    alarmDescription: "The value was out of expected bounds",
    comparisonOperator: "LessThanLowerOrGreaterThanUpperThreshold",
    evaluationPeriods: 1,
    metricQueries: [
        {
            expression: "ANOMALY_DETECTION_BAND(m1)",
            id: "e1",
            label: "Sum Exceeded",
            returnData: true,
        },
        {
            id: "m1",
            metric: {
                metricName: metricName,
                namespace: metricNamespace,
                period: 60,
                stat: "Sum"
            },
            returnData: true,
        },
    ],
    thresholdMetricId: "e1",
});
