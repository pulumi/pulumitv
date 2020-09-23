import * as pulumi from "@pulumi/pulumi";
import * as resources from "@pulumi/azure-nextgen/resources/latest";
import * as documentdb from "@pulumi/azure-nextgen/documentdb/v20200601preview";
import { CosmosClient } from "@azure/cosmos";

const config = new pulumi.Config();
const location = config.require("location");

// Create an Azure Resource Group
const resourceGroup = new resources.ResourceGroup("resourceGroup", {
    resourceGroupName: "leezen-rg",
    location,
});

const dbAccount = new documentdb.DatabaseAccount("dbAccount", {
    accountName: "leezen-serverless",
    resourceGroupName: resourceGroup.name,
    location,
    properties: {
        createMode: "Default",
        databaseAccountOfferType: "Standard",
        locations: [
            {
                locationName: "West US",
                failoverPriority: 0,
            },
        ],
        capabilities: [{
            name: "EnableServerless",
        }],
    }
});

const dbName = "mydb";
const sqlDatabase = new documentdb.SqlResourceSqlDatabase(dbName, {
    accountName: dbAccount.name,
    databaseName: dbName,
    options: {},
    resource: {
        id: dbName,
    },
    resourceGroupName: resourceGroup.name,
    location,
});

const containerName = "sqlContainer";
const dbContainer = new documentdb.SqlResourceSqlContainer(containerName, {
    accountName: dbAccount.name,
    containerName,
    databaseName: sqlDatabase.name,
    resourceGroupName: resourceGroup.name,
    location,
    options: {
    },
    resource: {
        id: containerName,
    },
});

if (!pulumi.runtime.isDryRun()) {
    pulumi.all([dbAccount.name, resourceGroup.name]).apply(([accountName, rgName]) => {
        documentdb.listDatabaseAccountConnectionStrings({
            accountName,
            resourceGroupName: rgName,
        }).then(async r => {
            // Assume the first one we get back is the primary connection string
            const cs = r.connectionStrings![0];
            const [endpoint, key] = cs.connectionString.split(";");
            const client = new CosmosClient({
                endpoint: endpoint.split("=")[1],
                key: key.split("=")[1],
            });

            client.database(dbName).container(containerName).items.create({
                "pk": Date.now(),
            });
        });
    });
}
