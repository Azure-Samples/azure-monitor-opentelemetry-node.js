// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Load the .env file if it exists
import * as dotenv from "dotenv";
dotenv.config();

import * as api from "@opentelemetry/api";
import { initializeTelemetry } from "./azureMonitor";

const { useAzureMonitor } = require("applicationinsights");

const config = {
    azureMonitorExporterOptions: {
        connectionString: process.env["APPLICATIONINSIGHTS_CONNECTION_STRING"] || "<your connection string>"
    },
};
useAzureMonitor(config);


/*********************************************************************
 *  OPEN TELEMETRY SETUP
 **********************************************************************/
initializeTelemetry();
let metricCounter = api.metrics.getMeter("testMeter").createCounter("Manual_Metric_Counter");


// Open Telemetry setup need to happen before instrumented libraries are loaded
import * as http from "http";
import * as mysql from "mysql";
import { EventHubProducerClient } from "@azure/event-hubs";
import { DefaultAzureCredential } from "@azure/identity";

/*********************************************************************
 *  BUNYAN LOGGER SETUP
 **********************************************************************/
const bunyan = require("bunyan");
const log = bunyan.createLogger({ name: "testapp" });

function logBunyan() {
  log.info("Hello from bunyan");
}

/*********************************************************************
 *  WINSTON LOGGER SETUP
 **********************************************************************/
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'user-service' },
});

logger.log({
  level: 'info',
  message: 'Hello from winston',
});

/*********************************************************************
 *  AZURE EVENTHUB SETUP
 **********************************************************************/
/** Connect to Azure Eventhub. */
const credential = new DefaultAzureCredential();
const eventHubHost = process.env["AZURE_EVENTHUB_HOST"] || "my-host-name";
const eventHubName = process.env["AZURE_EVENTHUB_NAME"] || "my-event-hub";
const client = new EventHubProducerClient(eventHubHost, eventHubName, credential);

async function handleEventHub(response: any) {
  try {
    const partitionIds = await client.getPartitionIds();
    response.end(JSON.stringify(partitionIds));
  } catch (error) {
    response.end("EventHub error: " + error);
  }
}

/*********************************************************************
 *  MYSQL SETUP
 **********************************************************************/
/** Connect to MySQL DB. */
const mysqlHost = process.env["MYSQL_HOST"] || "localhost";
const mysqlUser = process.env["MYSQL_USER"] || "root";
const mysqlPassword = process.env["MYSQL_PASSWORD"] || "secret";
const mysqlDatabase = process.env["MYSQL_DATABASE"] || "my_db";

const connection = mysql.createConnection({
  host: mysqlHost,
  user: mysqlUser,
  password: mysqlPassword,
  database: mysqlDatabase,
});

connection.connect((err: any) => {
  if (err) {
    console.log("Failed to connect to DB, err:" + err);
  }
  else {
    console.info("MySQL connnected");
  }
});

function handleConnectionQuery(response: any) {
  try {
    const query = 'SELECT 1 + 1 as solution';
    connection.query(query, (err: any, results: any, _fields: any) => {
      if (err) {
        console.log('Error code:', err.code);
        response.end(err.message);
      } else {
        response.end(`${query}: ${results[0].solution}`);
      }
    });
  } catch (error) {
    response.end("MySQL error: " + error);
  }
}

/*********************************************************************
 *  MONGO SETUP
 **********************************************************************/
const { MongoClient } = require("mongodb");
const uri = "mongodb://root:example@localhost:27017/";

async function handleMongoConnection(response: any) {
  MongoClient.connect(uri, function(err: any, db: any) {
    if (err) throw err;
    var dbo = db.db("myStateDB");
    var myobj = { name: "Company Inc", address: "Highway 37" };
    dbo.collection("customers").insertOne(myobj, function(err: any, res: any) {
      if (err) throw err;
      db.close();
    });
    response.end("1 MongoDB document inserted");
  });
}

/*********************************************************************
 *  POSTGRES SETUP
 **********************************************************************/
let postgresUser = process.env["POSTGRES_USER"] || "admin";
let postgresHost = process.env["POSTGRES_HOST"] || "localhost";
let postgresDatabase = process.env["POSTGRES_DB"] || "test_db";
let postgresPassword = process.env["POSTGRES_PASSWORD"] || "mypassword";
let postgresPort = process.env["POSTGRES_PORT"] || 5432;

const { Client } = require('pg');
const pgClient = new Client({
  user: postgresUser,
  host: postgresHost,
  database: postgresDatabase,
  password: postgresPassword,
  port: postgresPort,
});
pgClient.connect();
console.log("Connected to Postgres");

function handlePostgresConnection(response: any) {
  try {
    pgClient.query('SELECT NOW()', (err: any, res: any) => {
      response.end(`Postgres connected and queried at ${res.rows[0].now}`)
    });
  } catch (error) {
    response.end("Postgres error: " + error);
  }
}
/*********************************************************************
 *  REDIS SETUP
 **********************************************************************/
const { createClient } = require('redis');
const redisClient = createClient();
redisClient.connect();
console.log("Connected to Redis");

async function handleRedisConnection(response: any) {
  try {
    await redisClient.set('mykey', 'Hello from node redis');
    const myKeyValue = await redisClient.get('mykey');
    console.log(myKeyValue);

    const numAdded = await redisClient.zAdd('vehicles', [
      {
        score: 4,
        value: 'car',
      },
      {
        score: 2,
        value: 'bike',
      },
    ]);
    response.end(`Added ${numAdded} items.`);
  } catch (error) {
    response.end("Error: " + error);
  }
}
/*********************************************************************
 *  HTTP SERVER SETUP
 **********************************************************************/
/** Starts a HTTP server that receives requests on sample server port. */
let server: http.Server;
function startServer(port: number) {
  // Creates a server
  server = http.createServer(handleRequest);
  // Starts the server
  server.listen(port, () => {
    console.log(`Node HTTP listening on ${port}`);
  });
}

/** A function which handles requests and send response. */
function handleRequest(request: any, response: any) {


  const body = [];
  request.on("error", (err: Error) => console.log(err));
  request.on("data", (chunk: string) => body.push(chunk));
  request.on("end", () => {

    if (request.url == '/') {
      response.end("Hello World!");
    }
    else if (request.url == '/eventhub') {
      handleEventHub(response);
    }
    else if (request.url == '/mysql') {
      handleConnectionQuery(response);
    }
    else if (request.url == '/mongo') {
      handleMongoConnection(response);
    }
    else if (request.url == '/postgres') {
      handlePostgresConnection(response);
    }
    else if (request.url == '/redis') {
      handleRedisConnection(response);
    }
    else if (request.url == '/http') {
      http.get(
        {
          host: "bing.com"
        },
        (res) => {
          const body: any = [];
          res.on("data", (chunk) => body.push(chunk));
          res.on("end", () => {
            response.end("Done");
          });
        }
      );
    }
    else if (request.url == '/span') {
      const currentSpan = api.trace.getSpan(api.context.active());
      if (currentSpan) {
        // display traceid in the terminal
        console.log(`traceid: ${currentSpan.spanContext().traceId}`);
      }
      const span = api.trace.getTracer("something").startSpan("handleRequest", {
        kind: api.SpanKind.SERVER, // server
        attributes: { key: "value" }
      });
      // Annotate our span to capture metadata about the operation
      span.addEvent("invoking handleRequest");
      try {
        new Error("Test Exception");
      }
      catch (ex) {
        span.recordException(ex);
      }
      span.end();
      response.end("Done");
    }
    else if (request.url == '/exception') {
      let req = http.get(
        {
          host: "test.com",
          port: "65530"
        },
        (res) => {
          const body: any = [];
          res.on("data", (chunk) => body.push(chunk));
          res.on("end", () => {
            response.end("Done");
          });
        }
      );
      setTimeout(() => {
        this._requestTimedOut = true;
        req.abort();
      }, 2000);

      req.on("error", (error: Error) => {
        response.end("Done");
      });
      req.end();
    }
    else if (request.url == '/metric') {

      metricCounter.add(1);
    }
    else if (request.url == '/bunyan') {
      logBunyan();
      response.end("Logged from bunyan");
    }
    else if (request.url == '/winston') {
      logger.log({
        level: 'info',
        message: 'Hello from winston',
      });
      response.end("Logged from winston");
    }
  });
}

startServer(8080);

