import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), "../../.env") });
import { createServer } from "node:http";
import { startTurnWorker } from "./turn-worker.js";
import { initSocket } from "./socket.js";

const port = Number(process.env.PORT ?? 3001);

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "worker" }));
});

initSocket(httpServer);
startTurnWorker();

httpServer.listen(port, () => {
  console.log(`Worker listening on :${port} (HTTP + Socket.IO)`);
});
