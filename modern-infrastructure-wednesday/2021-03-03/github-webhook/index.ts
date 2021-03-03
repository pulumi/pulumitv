import { Octokit } from "@octokit/rest";
import * as pulumi from "@pulumi/pulumi";
import { IssuesEvent } from "@octokit/webhooks-definitions/schema";
import { GitHubWebhook } from "./webhook";

const ghWebhookToken = new pulumi.Config("github").requireSecret("token");

export const webhook = new GitHubWebhook("issue-label-check", {
    repository: "pulumitv",
    events: ["issues"],
    token: ghWebhookToken,
    handler: async (event) => {
        const issuesEvent = event.data as IssuesEvent;
        const octokit = new Octokit({
            auth: event.token,
        });

        // We only care about 'closed' actions. Ignore all others.
        if (issuesEvent.action !== "closed") {
            console.log("Ignoring non-close event.");
            return;
        }

        // re-open the issue if we're missing the 'fixed' label
        console.log("Checking labels");
        if (-1 === issuesEvent.issue.labels?.findIndex(l => l.name === "resolution/fixed")) {
            // re-open the issue
            console.log("Re-opening issue");
            await octokit.issues.update({
                owner: issuesEvent.repository.owner.login,
                repo: issuesEvent.repository.name,
                issue_number: issuesEvent.issue.number,
                state: "open",
            });
        }
    },
});
