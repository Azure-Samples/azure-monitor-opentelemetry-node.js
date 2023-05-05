// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { ApplicationInsightsClient, ApplicationInsightsConfig } from "applicationinsights";
import { trace } from "@opentelemetry/api";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

import { trace } from "@opentelemetry/api";
let tracer= trace.getTracer("testTracer");
let customSpan = tracer.startSpan("testSpan");

...

customSpan.end();


export function getAppInsightsClient() {
    const config = new ApplicationInsightsConfig();
    config.samplingRatio = 1;
    config.enableAutoCollectExceptions = true;
    config.enableAutoCollectStandardMetrics = true;
    config.enableAutoCollectPerformance = true;
    config.enableAutoCollectHeartbeat = true;

    config.instrumentations.azureSdk.enabled = true;
    config.instrumentations.http.enabled = true;
    config.instrumentations.mongoDb.enabled = true;
    config.instrumentations.mySql.enabled = true;
    config.instrumentations.postgreSql.enabled = true;

    config.logInstrumentations.console.enabled = true;
    config.logInstrumentations.bunyan.enabled = true;
    config.logInstrumentations.winston.enabled = true;


    const customResource = Resource.EMPTY;
    // ----------------------------------------
    // Setting role name and role instance
    // ----------------------------------------
    customResource.attributes[SemanticResourceAttributes.SERVICE_NAME] = "my-helloworld-service";
    customResource.attributes[SemanticResourceAttributes.SERVICE_NAMESPACE] = "my-namespace";
    customResource.attributes[SemanticResourceAttributes.SERVICE_INSTANCE_ID] = "my-instance";

    config.resource = customResource;

    let appInsights = new ApplicationInsightsClient(config);
    return appInsights;
}