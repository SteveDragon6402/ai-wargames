import { Queue } from "bullmq";
import { getRedisUrl } from "./env";

let queue: Queue | null = null;

export function getTurnQueue(): Queue {
  if (!queue) {
    queue = new Queue("turns", { connection: { url: getRedisUrl() } });
  }
  return queue;
}

export async function scheduleTurnEnd(
  roomId: string,
  delayMs: number
): Promise<string> {
  const q = getTurnQueue();
  const jobId = `turn-${roomId}-${Date.now()}`;
  await q.add(
    "turn-end",
    { roomId },
    {
      jobId,
      delay: delayMs,
      removeOnComplete: true,
      removeOnFail: 50,
    }
  );
  return jobId;
}

export async function cancelTurnJob(jobId: string): Promise<void> {
  const q = getTurnQueue();
  const job = await q.getJob(jobId);
  if (job) await job.remove();
}

export async function resolveTurnNow(roomId: string): Promise<void> {
  const q = getTurnQueue();
  await q.add(
    "turn-end",
    { roomId },
    {
      jobId: `turn-now-${roomId}-${Date.now()}`,
      removeOnComplete: true,
    }
  );
}
