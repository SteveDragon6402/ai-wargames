"use client";

import { useEffect, useState } from "react";
import { allGone, announcement, gate, OPEN_MINUTES, STOP_BY_ID, tickBoard, type Departure } from "../lib/station";
import { hear, stopHearing, type TalkTurn } from "../lib/voice";
import { Conversation } from "./Conversation";

interface StationProps {
  board: Departure[];
  /** The stop they are trying to reach. */
  destination: string;
  /** The station they are standing in. */
  here: string;
  wrongStop: string | null;
  memory: (id: string) => string;
  onRide: (platform: number) => "ok" | "wrong" | "none" | "early" | "gone";
  onWalk: () => void;
  onWait: () => void;
  onTalk: (id: string, turns: TalkTurn[]) => void;
}

function doorOf(minutes: number): "Open" | "Closed" | "Left" {
  if (minutes <= 0) return "Left";
  if (minutes > OPEN_MINUTES) return "Closed";
  return "Open";
}

export function Station({ board, destination, here, wrongStop, memory, onRide, onWalk, onWait, onTalk }: StationProps) {
  const [who, setWho] = useState<"conductor" | "officer" | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const wanted = STOP_BY_ID[destination];
  const standing = STOP_BY_ID[here];
  const cue = board.map((departure) => `${departure.stopId}:${gate(departure)}`).join("|");
  const said = announcement(board);

  useEffect(() => {
    setNotice(null);
  }, [cue]);

  useEffect(() => {
    if (who) return;
    let stopped = false;
    void hear("announcer", announcement(board), "any").then((problem) => {
      if (!stopped && problem) setVoiceError(problem);
    });
    return () => {
      stopped = true;
    };
    // Speak on arrival and when a platform opens or a train leaves, not every minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue, who]);

  useEffect(() => {
    if (who) return;
    const timer = window.setInterval(onWait, 20000);
    return () => window.clearInterval(timer);
  }, [onWait, who]);

  useEffect(() => () => stopHearing(), []);

  function wait() {
    const next = tickBoard(board);
    onWait();
    const nextCue = next.map((departure) => `${departure.stopId}:${gate(departure)}`).join("|");
    if (nextCue === cue) void hear("announcer", announcement(next), "any").then((problem) => setVoiceError(problem));
  }

  function boardTrain(platform: number) {
    stopHearing();
    const result = onRide(platform);
    if (result === "early") setNotice("That platform opens five minutes before the train leaves.");
    else if (result === "gone") setNotice("That train has left.");
    else setNotice(null);
  }

  return (
    <section aria-label="The station" data-voice="announcer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/sejour/station.jpg" alt="The branch-line station" className="sj-photo" />
      <div className="sj-sheet">
        <h2 className="ep-display text-[28px]">{standing?.station ?? "The station"}</h2>
        <p className="mt-1 text-[15px]">
          You are at {standing?.station ?? "the station"}. Ask which train you need. A platform opens only in the {OPEN_MINUTES} minutes before that train leaves.
        </p>
        {allGone(board) ? <p className="sj-error">The trains have left. You'll have to walk.</p> : null}
        {wrongStop ? <p className="sj-error">That train went to {STOP_BY_ID[wrongStop]?.station ?? "somewhere else"}. You can ride back, or walk.</p> : null}
        {notice ? <p className="sj-error">{notice}</p> : null}
        {voiceError ? <p className="sj-error">{voiceError}</p> : null}
        <table className="sj-board mt-3">
          <thead>
            <tr>
              <th>Train</th>
              <th>Platform</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {board.map((departure) => {
              const stop = STOP_BY_ID[departure.stopId];
              const door = doorOf(departure.minutes);
              return (
                <tr key={`${departure.platform}-${departure.stopId}`}>
                  <td>
                    {stop?.station}
                    <span className="sj-street">{stop?.street}</span>
                  </td>
                  <td>
                    {departure.platform} · voie {departure.platform}
                  </td>
                  <td>
                    <span className={door === "Open" ? "sj-open" : "sj-shut"}>
                      {departure.minutes > 0 ? `${departure.minutes} ` : ""}
                      {door}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 2, 3].map((platform) => {
            const train = board.find((departure) => departure.platform === platform);
            const door = doorOf(train?.minutes ?? 0).toLowerCase();
            return (
              <button key={platform} type="button" className={door === "open" ? "ep-button ep-primary" : "ep-button"} onClick={() => boardTrain(platform)}>
                Platform {platform} · {door}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="ep-button" onClick={wait}>
            Wait a minute
          </button>
          <button type="button" className="ep-button" onClick={() => setWho("conductor")}>
            Ask the conductor
          </button>
          <button type="button" className="ep-button" onClick={() => setWho("officer")}>
            Ask the officer
          </button>
          <button type="button" className="ep-button" onClick={onWalk}>
            I&apos;ll walk
          </button>
        </div>
        {who ? (
          <div className="mt-4">
            <Conversation
              title={who === "conductor" ? "The conductor" : "The officer"}
              character={who}
              role={who}
              who={who}
              memory={memory(who)}
              context={`The board says: ${said} The traveller wants ${wanted?.station ?? destination}, ${wanted?.street ?? ""}. Platforms open only in the five minutes before a train leaves.`}
              endLabel="Back to the platforms"
              onEnd={(turns) => {
                onTalk(who, turns);
                setWho(null);
              }}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
