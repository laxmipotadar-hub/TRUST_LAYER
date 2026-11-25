export interface ScenarioMeta {
  callerLabel: string;
  claimedUserId: string;
  enrolled: boolean;
  mode: "DEMO";
}

export const scenarioMeta: Record<"S1" | "S2" | "S3" | "S4", ScenarioMeta> = {
  S1: {
    callerLabel: "Marcus Aurelius (S1)",
    claimedUserId: "CUST-4821-MARCUS",
    enrolled: true,
    mode: "DEMO",
  },
  S2: {
    callerLabel: "Valeria Chen Clone (S2)",
    claimedUserId: "CUST-8831-VALERIA",
    enrolled: true,
    mode: "DEMO",
  },
  S3: {
    callerLabel: "Marcus Aurelius Replay (S3)",
    claimedUserId: "CUST-4821-MARCUS",
    enrolled: true,
    mode: "DEMO",
  },
  S4: {
    callerLabel: "Unknown Caller (S4)",
    claimedUserId: "CUST-9011-UNKNOWN",
    enrolled: false,
    mode: "DEMO",
  },
};

export const DEMO_SCENARIO_LIST: Array<{
  id: "S1" | "S2" | "S3" | "S4";
  label: string;
  description: string;
}> = [
  {
    id: "S1",
    label: "S1: Genuine Customer",
    description: "Real human voice matching enrolled Marcus Aurelius baseline.",
  },
  {
    id: "S2",
    label: "S2: Synthetic Speech",
    description: "AI voice clone / deepfake detected by Aletheia + high scam risk.",
  },
  {
    id: "S3",
    label: "S3: Replay / Liveness Probe",
    description: "Replayed genuine voice flagged by dynamic challenge liveness.",
  },
  {
    id: "S4",
    label: "S4: Speaker Mismatch",
    description: "Real human voice diverging from claimed enrolled speaker baseline.",
  },
];
