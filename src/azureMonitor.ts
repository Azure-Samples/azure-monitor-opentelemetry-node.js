// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { useAzureMonitor, AzureMonitorOpenTelemetryOptions } from "@azure/monitor-opentelemetry";
import { trace, metrics, Span, SpanKind, TraceFlags, ProxyTracerProvider } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { Resource } from "@opentelemetry/resources";
import { SemanticAttributes, SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { BatchSpanProcessor, ReadableSpan, SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { Logger } from "@opentelemetry/sdk-logs";
import { HttpInstrumentationConfig } from "@opentelemetry/instrumentation-http";
import { FsInstrumentation } from '@opentelemetry/instrumentation-fs';
import { IncomingMessage } from "http";
import { RequestOptions } from "https";


export function initializeTelemetry() {

    // Filter using HTTP instrumentation configuration
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

    const customResource = Resource.EMPTY;
    // ----------------------------------------
    // Setting role name and role instance
    // ----------------------------------------
    customResource.attributes[SemanticResourceAttributes.SERVICE_NAME] = "my-helloworld-service";
    customResource.attributes[SemanticResourceAttributes.SERVICE_NAMESPACE] = "my-namespace";
    customResource.attributes[SemanticResourceAttributes.SERVICE_INSTANCE_ID] = "my-instance";

    const options: AzureMonitorOpenTelemetryOptions = {
        // Sampling could be configured here
        samplingRatio: 1,
        // Use custom Resource
        resource: customResource as any,
        instrumentationOptions: {
            // Custom HTTP Instrumentation Configuration
            http: httpInstrumentationConfig,
            azureSdk: { enabled: true },
            mongoDb: { enabled: true },
            mySql: { enabled: true },
            postgreSql: { enabled: true },
            redis: { enabled: true },
            redis4: { enabled: true },
        },
    };

    useAzureMonitor(options);

    // Need client to be created
    addOpenTelemetryInstrumentation();
    addSpanProcessor();
    addOTLPExporter();
}

export function sendLogEvent() {
    const logger = (logs.getLogger("testLogger") as Logger);
    const logRecord = {
        body: "testEvent",
        attributes: {
            "testAttribute1": "testValue1",
            "testAttribute2": "testValue2",
            "testAttribute3": "testValue3"
        }
    };
    logger.emit(logRecord);
}


function addOpenTelemetryInstrumentation() {

    const tracerProvider = (trace.getTracerProvider() as ProxyTracerProvider).getDelegate();
    const meterProvider = metrics.getMeterProvider();
    registerInstrumentations({
        instrumentations: [
            new FsInstrumentation(),
        ],
        tracerProvider: tracerProvider,
        meterProvider: meterProvider
    });
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
    const tracerProvider = ((trace.getTracerProvider() as ProxyTracerProvider).getDelegate() as NodeTracerProvider);
    tracerProvider.addSpanProcessor(new SpanEnrichingProcessor());
}

function addOTLPExporter() {
    const traceExporter = new OTLPTraceExporter();
    const tracerProvider = ((trace.getTracerProvider() as ProxyTracerProvider).getDelegate() as NodeTracerProvider);
    tracerProvider.addSpanProcessor(new BatchSpanProcessor(traceExporter));
}
