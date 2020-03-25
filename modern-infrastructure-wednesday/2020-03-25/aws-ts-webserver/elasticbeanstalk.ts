import * as aws from "@pulumi/aws";

/**
 * This resource exists to demonstrate policy-as-code.
 */
export const beanstalkApp = new aws.elasticbeanstalk.Application("main", {
    description: "My application",
});
