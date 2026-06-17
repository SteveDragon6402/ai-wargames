import type { Server as HttpServer } from "node:http";
import type { GameState, TurnEvent } from "@wargame/shared";
import { Server } from "socket.io";

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    socket.on("room:join", ({ roomId }: { roomId: string }) => {
      if (roomId) socket.join(`room:${roomId}`);
    });
  });

  return io;
}

export function emitRoomState(roomId: string, payload: Record<string, unknown>) {
  io?.to(`room:${roomId}`).emit("room:state", payload);
}

export function emitTurnStart(roomId: string, turnEndsAt: string) {
  io?.to(`room:${roomId}`).emit("turn:start", { turnEndsAt });
}

export function emitTurnResolved(
  roomId: string,
  state: GameState,
  events: TurnEvent[]
) {
  io?.to(`room:${roomId}`).emit("turn:resolved", { state, events });
}

export function emitGameOver(roomId: string, winnerFactionId: string) {
  io?.to(`room:${roomId}`).emit("game:over", { winnerFactionId });
}

export function emitPlayerReady(roomId: string, playerId: string) {
  io?.to(`room:${roomId}`).emit("turn:player_ready", { playerId });
}

export function emitBothReady(roomId: string) {
  io?.to(`room:${roomId}`).emit("turn:both_ready", {});
}
