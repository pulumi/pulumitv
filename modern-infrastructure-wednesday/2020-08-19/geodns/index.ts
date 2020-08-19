import * as pulumi from "@pulumi/pulumi";
import * as ns1 from "@pulumi/ns1";

const zone = new ns1.Zone("pulumitv", {
    zone: "pulumi.tv",
});

const demo = new ns1.Record("demo", {
    domain: "demo.pulumi.tv",
    type: "A",
    zone: zone.zone,
    answers: [{
        answer: "1.2.3.4",
        region: "west",
    }, {
        answer: "5.6.7.8",
        region: "west",
    }, {
        answer: "8.8.8.8",
        region: "east",
    }, {
        answer: "9.9.9.9",
        region: "east",
    }],
    regions: [{
        name: "west",
        meta: {
            "georegion": "US-WEST",
        },
    }, {
        name: "east",
        meta: {
            "georegion": "US-EAST",
        },
    }],
    filters: [{
        filter: "geotarget_regional",
    }, {
        filter: "select_first_region",
    }],
});

export const nameservers = zone.dnsServers;
