import type { NodeId } from "./map";
import type { ReputationKey } from "../lib/types";

export interface ContractTemplate {
  id: string;
  payer: ReputationKey;
  place: NodeId;
  payAt: NodeId;
  bandName: string;
  leaderName: string;
  count: number;
  purse: number;
  blurb: string;
}

export const CONTRACTS: ContractTemplate[] = [
  {
    id: "reedwaste",
    payer: "ashmarch",
    place: "reedwaste",
    payAt: "high-ash",
    bandName: "The reed men",
    leaderName: "Odo the Reed",
    count: 16,
    purse: 40,
    blurb:
      "Odo the Reed keeps a band in the wet country. They know the reeds, and they will not fight a host that clearly outnumbers them.",
  },
  {
    id: "southfen",
    payer: "mere",
    place: "southfen",
    payAt: "greylake",
    bandName: "The fen riders",
    leaderName: "Marn of the Fen",
    count: 14,
    purse: 45,
    blurb:
      "Marn of the Fen runs riders on the open fen. They will set on a company they clearly outnumber, and they will not stand against a host.",
  },
];
