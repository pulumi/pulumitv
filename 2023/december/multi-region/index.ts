import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure-native";

const stackName: string = pulumi.getStack();
const config = new pulumi.Config();
const resourceNamePrefix = config.require("resourceNamePrefix");
const storageKind = config.require("storageKind");
const storageSkuName = config.require("storageSkuName");

const tags = {
    "createdby": "multi-region-esting-team",
    "environment": stackName
}

const resourceGroupName = `${resourceNamePrefix}-rg`;
const storageAccountName = `${resourceNamePrefix}str`;

// Create an Azure Resource Group
const resourceGroup = new azure.resources.ResourceGroup(resourceGroupName, {
    resourceGroupName: resourceGroupName,
    tags
});

// Create an Azure Storage Account
const storageAccount = new azure.storage.StorageAccount(storageAccountName, {
    accountName: storageAccountName,
    resourceGroupName: resourceGroup.name,
    kind: storageKind,
    sku: {
        name: storageSkuName
    },
    tags
});

// Create an Azure Web App
const plan = new azure.web.AppServicePlan("plan", {
    resourceGroupName: resourceGroup.name,
    sku: {
        capacity: 1,
        family: "P",
        name: "P1",
        size: "P1",
        tier: "Premium",
    },
    tags
});

// Create a Virtual Network with a Subnet
const network = new azure.network.VirtualNetwork("network", {
    resourceGroupName: resourceGroup.name,
    addressSpace: {
        addressPrefixes: ["10.0.0.0/16"],
    },
    tags
});
const subnet = new azure.network.Subnet("subnet", {
    resourceGroupName: resourceGroup.name,
    virtualNetworkName: network.name,
    addressPrefix: "10.0.1.0/24",
});

// Create an Azure Cosmos DB account, a SQL database and a container named "app-db".
const cosmosdbAccount = new azure.documentdb.DatabaseAccount("cosmosdbAccount", {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    accountName: "adora-custom-codmos88",
    createMode: "Default",
    databaseAccountOfferType: azure.documentdb.DatabaseAccountOfferType.Standard,
    locations: [{
        failoverPriority: 0,
        isZoneRedundant: false,
        locationName: "westus",
    }],
    tags
});

const sqlDatabase = new azure.documentdb.SqlResourceSqlDatabase("sqlDatabase", {
    resourceGroupName: resourceGroup.name,
    accountName: cosmosdbAccount.name,
    databaseName: "databaseName",
    location: "West US",
    options: {},
    resource: {
        id: "databaseName",
    },
    tags
});

const sqlContainer = new azure.documentdb.SqlResourceSqlContainer("app-db", {
    resourceGroupName: resourceGroup.name,
    accountName: cosmosdbAccount.name,
    databaseName: sqlDatabase.name,
    containerName: "containerName",
    location: "West US",
    options: {},
    resource: {
        clientEncryptionPolicy: {
            includedPaths: [{
                clientEncryptionKeyId: "keyId",
                encryptionAlgorithm: "AEAD_AES_256_CBC_HMAC_SHA256",
                encryptionType: "Deterministic",
                path: "/path",
            }],
            policyFormatVersion: 2,
        },
        conflictResolutionPolicy: {
            conflictResolutionPath: "/path",
            mode: "LastWriterWins",
        },
        defaultTtl: 100,
        id: "containerName",
        indexingPolicy: {
            automatic: true,
            excludedPaths: [],
            includedPaths: [{
                indexes: [
                    {
                        dataType: "String",
                        kind: "Range",
                        precision: -1,
                    },
                    {
                        dataType: "Number",
                        kind: "Range",
                        precision: -1,
                    },
                ],
                path: "/*",
            }],
            indexingMode: "consistent",
        },
        partitionKey: {
            kind: "Hash",
            paths: ["/AccountNumber"],
        },
        uniqueKeyPolicy: {
            uniqueKeys: [{
                paths: ["/testPath"],
            }],
        },
    },
    tags
});

const tenantId = cosmosdbAccount.identity.apply(id => id!.tenantId)

pulumi.all([resourceGroup.name, cosmosdbAccount.name, tenantId]).apply(([resourceGroupName, accountName, tenantId]) => {
    
    // Fetch the connection strings for the Azure CosmosDB Account
    const connectionStrings = azure.documentdb.listDatabaseAccountConnectionStrings({
        resourceGroupName: resourceGroupName,
        accountName: accountName,
    });

    const cosmosdbConnectionString = connectionStrings.then(cs => cs.connectionStrings![0].connectionString);

    // Save it to the KeyVault
    const vault = new azure.keyvault.Vault("vault", {
        resourceGroupName: resourceGroup.name,
        location: resourceGroup.location,
        properties: {
            sku: { 
                name: "standard",
                family: "A"
            },
            tenantId: tenantId,
            accessPolicies: [],
        },
        tags
    });

    const secret = new azure.keyvault.Secret("cosmosConnectionString", {
        secretName: "cosmosConnectionString",
        vaultName: vault.name,
        resourceGroupName: resourceGroup.name,
        properties: {
            value: cosmosdbConnectionString
        },
        tags
    });
    
    // Get the secret's URI
    const secretUri = pulumi.interpolate`${vault.properties.vaultUri}secrets/${secret.name}`;

    const app = new azure.web.WebApp("app", {
        resourceGroupName: resourceGroup.name,
        serverFarmId: plan.id,
        siteConfig: {
            appSettings: [
                {
                    name: "CosmosConnectionString",
                    value: secretUri
                }
            ]
        },
        tags
    });
});
