import { Queue, Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { games, getDb } from "@wargame/db";
import { getTurnDurationSeconds, resolveRoomTurn } from "./game.js";
import {
  emitGameOver,
  emitRoomState,
  emitTurnResolved,
  emitTurnStart,
  emitPlayerReady,
  emitBothReady,
} from "./socket.js";
import { buildSnapshot } from "./snapshot.js";

function redisConnection() {
  return { url: process.env.REDIS_URL ?? "redis://localhost:6379" };
}

export async function scheduleNextTurn(roomId: string): Promise<string | null> {
  const delay = getTurnDurationSeconds() * 1000;
  const jobId = `turn-${roomId}-${Date.now()}`;
  const queue = new Queue("turns", { connection: redisConnection() });
  await queue.add(
    "turn-end",
    { roomId },
    { jobId, delay, removeOnComplete: true }
  );
  const db = getDb();
  await db
    .update(games)
    .set({ turnJobId: jobId })
    .where(eq(games.roomId, roomId));
  return jobId;
}

export function startTurnWorker(): Worker {
  const worker = new Worker(
    "turns",
    async (job) => {
      const { roomId } = job.data as { roomId: string };
      const resolved = await resolveRoomTurn(roomId);
      if (!resolved) return;

      const { result, turnEndsAt, winner } = resolved;
      emitTurnResolved(roomId, result.state, result.events);

      if (winner) {
        emitGameOver(roomId, winner);
        const snapshot = await buildSnapshot(roomId);
        if (snapshot) emitRoomState(roomId, snapshot);
        return;
      }

      if (turnEndsAt) {
        await scheduleNextTurn(roomId);
        emitTurnStart(roomId, turnEndsAt.toISOString());
      }

      const snapshot = await buildSnapshot(roomId);
      if (snapshot) emitRoomState(roomId, snapshot);
    },
    { connection: redisConnection() }
  );

  worker.on("failed", (job, err) => {
    console.error("Turn job failed", job?.id, err);
  });

  return worker;
}
