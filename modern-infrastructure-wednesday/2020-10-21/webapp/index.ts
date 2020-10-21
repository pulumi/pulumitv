import * as pulumi from "@pulumi/pulumi";
import * as automation from "@pulumi/pulumi/x/automation";

import * as exec from "child_process";
import * as fs from "fs";
import * as process from "process";
import yargs from "yargs";
import * as lockfile from '@yarnpkg/lockfile';

let lf = fs.readFileSync("yarn.lock", "utf8");
let lockfileJson = lockfile.parse(lf);

import { apiProgram } from "./api";
import { websiteProgram } from "./website";

const args = process.argv.slice(2);
const argv = yargs(args)
    .option("name", { string: true, demandOption: true })
    .option("environment", { string: true, demandOption: true })
    .option("destroy", { boolean: true, default: false })
    .argv;

const projectName = argv.name;
const environmentName = argv.environment;
const isDestroyCommand = argv.destroy;

const run = async () => {

    // Setup API stack.
    const apiStackArgs: automation.InlineProgramArgs = {
        stackName: environmentName,
        projectName: `${projectName}-api`,
        program: async () => {
            return apiProgram(process.cwd());
        },
    };
    const apiStack = await automation.LocalWorkspace.createOrSelectStack(apiStackArgs, { workDir: process.cwd() });

    // Get the AWS plugin version based on what's in our lockfile.
    await apiStack.workspace.installPlugin("aws", lockfileJson.object["@pulumi/aws@^3.0.0"].version);
    // Set the AWS region.
    await apiStack.setConfig("aws:region", { value: "us-west-2" });
    
    // Setup our website stack.
    const websiteStackArgs: automation.InlineProgramArgs = {
        stackName: environmentName,
        projectName: `${projectName}-website`,
        program: async () => {
            return websiteProgram(process.cwd());
        },
    };
    const websiteStack = await automation.LocalWorkspace.createOrSelectStack(websiteStackArgs);

    // Get the AWS plugin version based on what's in our lockfile.
    await websiteStack.workspace.installPlugin("aws", lockfileJson.object["@pulumi/aws@^3.0.0"].version);
    // Set the AWS region.
    await websiteStack.setConfig("aws:region", { value: "us-west-2" });
    
    if (isDestroyCommand) {
        await apiStack.destroy({ onOutput: console.info });
        await websiteStack.destroy({ onOutput: console.info });
    } else {
        // Perform the `update` step and output the API endpoint.
        const apiUpResult = await apiStack.up({ onOutput: console.info });
        console.log(`API endpoint: ${apiUpResult.outputs.apiEndpoint.value}`);
        
        // Build the webapp with the API endpoint.
        exec.execSync("yarn build", {
            cwd: "app",
            env: {
                // We specifically want to call the 'counter' path.
                "REACT_APP_API_ENDPOINT": apiUpResult.outputs.apiEndpoint.value + "counter",
                ...process.env,
            },
        });

        // Update the website and output the website endpoint.
        const websiteUpResult = await websiteStack.up({ onOutput: console.info });
        console.log(`website url: ${websiteUpResult.outputs.websiteUrl.value}`);
        
        // Update the API CORS settings to use the website
        await apiStack.setConfig("corsDomain", { value: `http://${websiteUpResult.outputs.websiteUrl.value}` });
        // Perform the `update` step and output the API endpoint.
        const apiCorsUpdateResult = await apiStack.up({ onOutput: console.info });
        console.log(`API endpoint: ${apiUpResult.outputs.apiEndpoint.value}`);
    }
}

run().catch(err => console.log(err));


