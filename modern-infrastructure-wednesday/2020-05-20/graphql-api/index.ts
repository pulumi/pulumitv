import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import { ApolloServer, gql } from "apollo-server-cloud-functions";

function factory() {
    // Construct a schema, using GraphQL schema language
    const typeDefs = gql`
        type Query {
            hello: String
        }
    `;

    // Provide resolver functions for your schema fields
    const resolvers = {
        Query: {
            hello: () => 'Hello world!',
        },
    };

    const server = new ApolloServer({
        typeDefs,
        resolvers,
        playground: true,
        introspection: true,
    });

    const cb = server.createHandler();
    return cb;
}

const apiFunction = new gcp.cloudfunctions.HttpCallbackFunction("apiFunction", {
    callbackFactory: factory,
});

const apiInvoker = new gcp.cloudfunctions.FunctionIamMember("apiInvoker", {
    cloudFunction: apiFunction.function.id,
    member: "allUsers",
    role: "roles/cloudfunctions.invoker",
});

export const url = apiFunction.httpsTriggerUrl;
