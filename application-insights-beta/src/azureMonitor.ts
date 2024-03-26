// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { useAzureMonitor, AzureMonitorOpenTelemetryOptions } from "@azure/monitor-opentelemetry";
import { trace, metrics, Span, SpanKind, TraceFlags, ProxyTracerProvider } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { Resource } from "@opentelemetry/resources";
import { SEMATTRS_ENDUSER_ID, SEMATTRS_HTTP_CLIENT_IP, SEMRESATTRS_SERVICE_INSTANCE_ID, SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_NAMESPACE, SemanticAttributes, SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { BatchSpanProcessor, ReadableSpan, SpanProcessor } from "@opentelemetry/sdk-trace-base";
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
    customResource.attributes[SEMRESATTRS_SERVICE_NAME] = "my-helloworld-service";
    customResource.attributes[SEMRESATTRS_SERVICE_NAMESPACE] = "my-namespace";
    customResource.attributes[SEMRESATTRS_SERVICE_INSTANCE_ID] = "my-instance";

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

    addSpanProcessor(options);
    addOTLPExporter(options);
    useAzureMonitor(options);

    // Need client to be created
    addOpenTelemetryInstrumentation();
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

function addSpanProcessor(options: AzureMonitorOpenTelemetryOptions) {
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
                span.attributes[SEMATTRS_HTTP_CLIENT_IP] = "<IP Address>";
                span.attributes[SEMATTRS_ENDUSER_ID] = "<User ID>";
            }
        }
    }
    if (options.spanProcessors?.length > 0) {
        options.spanProcessors.push(new SpanEnrichingProcessor());
    } else {
        options.spanProcessors = [new SpanEnrichingProcessor()];
    
    }
}

function addOTLPExporter(options: AzureMonitorOpenTelemetryOptions) {
    const traceExporter = new OTLPTraceExporter();
    if (options.spanProcessors?.length > 0) {
        options.spanProcessors.push(new BatchSpanProcessor(traceExporter));
    } else {
        options.spanProcessors = [new BatchSpanProcessor(traceExporter)];
    }
}
