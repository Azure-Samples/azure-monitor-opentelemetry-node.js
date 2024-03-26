# Azure Monitor OpenTelemetry for Node.js
Sample app demonstrating how to instrument your application with Azure Monitor OpenTelemetry.

Contains both samples for the Application Insights 3.x beta and the Application Insights shim for Application Insights 2.x APIs.

## How to run the sample app

1. Install all dependencies.
 ```bash
    npm install
```
2. Update .env file with Application Insights Connection String and Azure Event Hub name and host.
3. Start Docker running following command inside docker folder.
    ```bash
    docker compose up 
    ```
4. Build project 
    ```bash
    npm run build
    ```
5. Start server 
    ```bash
    npm run server
    ```
6. Start client 
    ```bash
    npm run client
    ```

7. Telemetry should be available and visible in Azure Portal in Application Resource which connection string was provided. To visualize telemetry exported through OTLP to Zipkin, you can use http://localhost:9411/zipkin



## Resources


- [OpenTelemetry Overview](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-overview)
- [Getting Started](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable?tabs=nodejs)
