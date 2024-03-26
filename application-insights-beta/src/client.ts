// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import * as http from "http";

/*********************************************************************
 *  HTTP CLIENT SETUP
 **********************************************************************/
/** A function which makes requests and handles response. */
function makeRequest(path: string) {
  http.get(
    {
      host: "localhost",
      port: 8080,
      path: path,
    },
    (response) => {
      const body: any = [];
      response.on("data", (chunk) => body.push(chunk));
      response.on("end", () => {
        console.log(body.toString());
      });
    }
  );
}

setInterval(() => {
  makeRequest("/");
  makeRequest("/eventhub");
  makeRequest("/mysql");
  makeRequest("/mongo");
  makeRequest("/postgres");
  makeRequest("/redis");
  makeRequest("/http");
  makeRequest("/span");
  makeRequest("/exception");
  makeRequest("/metric");
  makeRequest("/bunyan");
  makeRequest("/winston");
}, 10000)

