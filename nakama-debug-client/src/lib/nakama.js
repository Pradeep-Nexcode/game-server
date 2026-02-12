import { Client } from "@heroiclabs/nakama-js";

const client = new Client(
  "defaultkey",      // server key (default for local)
  "127.0.0.1",       // host
  "7350",            // port
  false              // useSSL (false for local)
);

client.timeout = 10000;

export default client;
