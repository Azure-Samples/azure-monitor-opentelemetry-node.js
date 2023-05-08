// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { ApplicationInsightsClient, ApplicationInsightsConfig } from "applicationinsights";
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from "@opentelemetry/resources";
import { SemanticAttributes, SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { BatchSpanProcessor, ReadableSpan, SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { IncomingMessage } from "http";
import { RequestOptions } from "https";
import { HttpInstrumentationConfig } from "@opentelemetry/instrumentation-http";
import { Span, SpanKind, TraceFlags, trace } from "@opentelemetry/api";
import { FsInstrumentation } from '@opentelemetry/instrumentation-fs';


let telemetryClient: ApplicationInsightsClient;

export function getSpanContext() {
    return trace.getActiveSpan().spanContext();
}

export function getAppInsightsClient() {
    const config = new ApplicationInsightsConfig();
    // Sampling could be configured here
    config.samplingRatio = 1;
    // Azure Monitor Exporter configuration
    // config.azureMonitorExporterConfig = {
    //     // Offline storage
    //     storageDirectory: "c://azureMonitor",
    //     // Automatic retries
    //     disableOfflineStorage: false
    // };
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
    addOpenTelemetryResource(config);
    filterTelemetryUsingHttpInstrumentation(config);

    // All configuration should be done before instantiating the telemetry client
    telemetryClient = new ApplicationInsightsClient(config);

    // Need client to be created
    addOpenTelemetryInstrumentation();
    addSpanProcessor();
    addOTLPExporter();

    return telemetryClient;
}

export function sendLogEvent() {
    const logHandler = telemetryClient.getLogHandler();
    // Extra attributes could be added to the telemetry
    const attributes = {
        "testAttribute1": "testValue1",
        "testAttribute2": "testValue2",
        "testAttribute3": "testValue3",
    };
    logHandler.trackEvent({
        name: "testEvent",
        properties: attributes
    });
}


function addOpenTelemetryInstrumentation() {
    const fsInstrumentation = new FsInstrumentation();
    const traceHandler = telemetryClient.getTraceHandler();
    traceHandler.addInstrumentation(fsInstrumentation);
}

function addSpanProcessor() {
    // Custom SpanProcessor class
    class SpanEnrichingProcessor implements SpanProcessor {
        forceFlush(): Promise<void> {
            return Promise.resolve();
        }
        shutdown(): Promise<void> {
            return Promise.resolve();
        }
        onStart(_span: Span): void { }
        onEnd(span: ReadableSpan) {

            // Telemetry can be Filtered out here
            if (span.kind == SpanKind.INTERNAL) {
                span.spanContext().traceFlags = TraceFlags.NONE;
            }

            // Extra attributes could be added to the Span
            else {
                span.attributes["CustomDimension1"] = "value1";
                span.attributes["CustomDimension2"] = "value2";
                span.attributes[SemanticAttributes.HTTP_CLIENT_IP] = "<IP Address>";
                span.attributes[SemanticAttributes.ENDUSER_ID] = "<User ID>";
            }
        }
    }
    const traceHandler = telemetryClient.getTraceHandler();
    traceHandler.addSpanProcessor(new SpanEnrichingProcessor());
}

function addOTLPExporter() {
    const traceExporter = new OTLPTraceExporter();
    const traceHandler = telemetryClient.getTraceHandler();
    traceHandler.addSpanProcessor(new BatchSpanProcessor(traceExporter));
}

function addOpenTelemetryResource(config: ApplicationInsightsConfig) {
    const customResource = Resource.EMPTY;
    // ----------------------------------------
    // Setting role name and role instance
    // ----------------------------------------
    customResource.attributes[SemanticResourceAttributes.SERVICE_NAME] = "my-helloworld-service";
    customResource.attributes[SemanticResourceAttributes.SERVICE_NAMESPACE] = "my-namespace";
    customResource.attributes[SemanticResourceAttributes.SERVICE_INSTANCE_ID] = "my-instance";
    config.resource = customResource;
    return config;
}

function filterTelemetryUsingHttpInstrumentation(config: ApplicationInsightsConfig) {
    // Filter using HTTP instrumentation configuration, should be done before instatiating the telemetry client
    const httpInstrumentationConfig: HttpInstrumentationConfig = {
        enabled: true,
        ignoreIncomingRequestHook: (request: IncomingMessage) => {
            // Ignore OPTIONS incoming requests
            if (request.method === 'OPTIONS') {
                return true;
            }
            return false;
        },
        ignoreOutgoingRequestHook: (options: RequestOptions) => {
            // Ignore outgoing requests with /test path
            if (options.path === '/test') {
                return true;
            }
            return false;
        }
    };
    config.instrumentations.http = httpInstrumentationConfig;
    return config;
}
