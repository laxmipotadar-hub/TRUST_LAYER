import type { PhoneAction } from "./phoneStateMachine";
import type { ScenarioId } from "../../types";

export interface DirectorStep {
  id: string;
  offsetMs: number;
  label: string;
  action: PhoneAction;
}

export interface ScenarioScript {
  id: ScenarioId;
  title: string;
  summary: string;
  callerId: string;
  claimedCustomerId: string;
  claimedIdentity: string;
  steps: DirectorStep[];
}

export const SCENARIO_SCRIPTS: Record<ScenarioId, ScenarioScript> = {
  S1: {
    id: "S1",
    title: "S1 · Genuine Enrolled Customer",
    summary: "Ring -> answer -> connecting -> analyzing -> verified -> short conversation -> caller hangs up",
    callerId: "+1 (415) 555-0142",
    claimedCustomerId: "CUST-4821-MARCUS",
    claimedIdentity: "Marcus Vance",
    steps: [
      {
        id: "s1-1",
        offsetMs: 0,
        label: "Incoming ring",
        action: {
          type: "SIMULATE_INCOMING_CALL",
          callerId: "+1 (415) 555-0142",
          claimedCustomerId: "CUST-4821-MARCUS",
          claimedIdentity: "Marcus Vance",
          scenarioId: "S1",
          isDemo: true,
        },
      },
      {
        id: "s1-2",
        offsetMs: 1600,
        label: "Agent accepts call",
        action: { type: "AGENT_ACCEPT_CALL", actor: "operator" },
      },
      {
        id: "s1-3",
        offsetMs: 2500,
        label: "Analyzing voice & script",
        action: {
          type: "START_ANALYZING",
          actor: "system",
          claimedCustomerId: "CUST-4821-MARCUS",
          claimedIdentity: "Marcus Vance",
          isDemo: true,
        },
      },
      {
        id: "s1-4",
        offsetMs: 3600,
        label: "Caller speaks routine greeting",
        action: {
          type: "APPEND_TRANSCRIPT",
          speaker: "CALLER",
          text: "Hi, I'm calling to confirm my Zurich travel notice before tomorrow's flight.",
          timestampSec: 4,
        },
      },
      {
        id: "s1-5",
        offsetMs: 4500,
        label: "Verified (ALLOW)",
        action: {
          type: "ANALYSIS_COMPLETE",
          decision: "ALLOW",
          recommendedAction: "Proceed with standard servicing.",
          isDemo: true,
        },
      },
      {
        id: "s1-6",
        offsetMs: 7500,
        label: "Caller hangs up",
        action: { type: "CALLER_HANG_UP", actor: "caller" },
      },
    ],
  },
  S2: {
    id: "S2",
    title: "S2 · AI Voice Clone",
    summary: "Ring -> answer -> analyzing -> END_CALL (security_end) with neutral branch guidance",
    callerId: "+1 (415) 555-0889",
    claimedCustomerId: "CUST-8831-VALERIA",
    claimedIdentity: "Valeria Chen",
    steps: [
      {
        id: "s2-1",
        offsetMs: 0,
        label: "Incoming ring",
        action: {
          type: "SIMULATE_INCOMING_CALL",
          callerId: "+1 (415) 555-0889",
          claimedCustomerId: "CUST-8831-VALERIA",
          claimedIdentity: "Valeria Chen",
          scenarioId: "S2",
          isDemo: true,
        },
      },
      {
        id: "s2-2",
        offsetMs: 1500,
        label: "Agent accepts call",
        action: { type: "AGENT_ACCEPT_CALL", actor: "operator" },
      },
      {
        id: "s2-3",
        offsetMs: 2400,
        label: "Analyzing audio",
        action: {
          type: "START_ANALYZING",
          actor: "system",
          claimedCustomerId: "CUST-8831-VALERIA",
          claimedIdentity: "Valeria Chen",
          isDemo: true,
        },
      },
      {
        id: "s2-4",
        offsetMs: 3600,
        label: "Caller requests urgent wire",
        action: {
          type: "APPEND_TRANSCRIPT",
          speaker: "CALLER",
          text: "I need to authorize an immediate offshore transfer right now.",
          timestampSec: 3,
        },
      },
      {
        id: "s2-5",
        offsetMs: 4600,
        label: "END_CALL (security_end)",
        action: {
          type: "ANALYSIS_COMPLETE",
          decision: "END_CALL",
          recommendedAction: "Do not proceed — terminate call and flag reference.",
          isDemo: true,
        },
      },
    ],
  },
  S3: {
    id: "S3",
    title: "S3 · Replayed Recording + Liveness",
    summary: "Ring -> answer -> STEP_UP -> nonce challenge -> replay failure -> END_CALL override",
    callerId: "+1 (415) 555-0317",
    claimedCustomerId: "CUST-4821-MARCUS",
    claimedIdentity: "Marcus Vance",
    steps: [
      {
        id: "s3-1",
        offsetMs: 0,
        label: "Incoming ring",
        action: {
          type: "SIMULATE_INCOMING_CALL",
          callerId: "+1 (415) 555-0317",
          claimedCustomerId: "CUST-4821-MARCUS",
          claimedIdentity: "Marcus Vance",
          scenarioId: "S3",
          isDemo: true,
        },
      },
      {
        id: "s3-2",
        offsetMs: 1400,
        label: "Agent accepts call",
        action: { type: "AGENT_ACCEPT_CALL", actor: "operator" },
      },
      {
        id: "s3-3",
        offsetMs: 2300,
        label: "Analyzing audio",
        action: {
          type: "START_ANALYZING",
          actor: "system",
          claimedCustomerId: "CUST-4821-MARCUS",
          claimedIdentity: "Marcus Vance",
          isDemo: true,
        },
      },
      {
        id: "s3-4",
        offsetMs: 3800,
        label: "STEP_UP extra verification",
        action: {
          type: "ANALYSIS_COMPLETE",
          decision: "STEP_UP",
          recommendedAction: "Run live voice phrase challenge.",
          isDemo: true,
        },
      },
      {
        id: "s3-5",
        offsetMs: 5000,
        label: "Challenge prompt issued",
        action: {
          type: "START_CHALLENGE",
          phrase: "cobalt mango seven forty-two",
          expiresInSeconds: 20,
        },
      },
      {
        id: "s3-6",
        offsetMs: 6500,
        label: "Recording reply",
        action: { type: "CHALLENGE_START_RECORDING", actor: "caller" },
      },
      {
        id: "s3-7",
        offsetMs: 8200,
        label: "Challenge fails -> END_CALL",
        action: {
          type: "CHALLENGE_RESULT",
          passed: false,
          note: "Replay check did not match live phrase -> END_CALL.",
        },
      },
    ],
  },
  S4: {
    id: "S4",
    title: "S4 · Social Engineering Script",
    summary: "Ring -> answer -> restricted -> coercive bubbles on agent phone -> human transfer",
    callerId: "+1 (646) 555-0911",
    claimedCustomerId: "CUST-9011-UNKNOWN",
    claimedIdentity: "Unverified Caller",
    steps: [
      {
        id: "s4-1",
        offsetMs: 0,
        label: "Incoming ring",
        action: {
          type: "SIMULATE_INCOMING_CALL",
          callerId: "+1 (646) 555-0911",
          claimedCustomerId: "CUST-9011-UNKNOWN",
          claimedIdentity: "Unverified Caller",
          scenarioId: "S4",
          isDemo: true,
        },
      },
      {
        id: "s4-2",
        offsetMs: 1400,
        label: "Agent accepts call",
        action: { type: "AGENT_ACCEPT_CALL", actor: "operator" },
      },
      {
        id: "s4-3",
        offsetMs: 2200,
        label: "Analyzing call",
        action: {
          type: "START_ANALYZING",
          actor: "system",
          claimedCustomerId: "CUST-9011-UNKNOWN",
          claimedIdentity: "Unverified Caller",
          isDemo: true,
        },
      },
      {
        id: "s4-4",
        offsetMs: 3600,
        label: "Restricted (STEP_UP)",
        action: {
          type: "ANALYSIS_COMPLETE",
          decision: "STEP_UP",
          recommendedAction: "Escalate to human specialist and verify customer out of band.",
          isDemo: true,
        },
      },
      {
        id: "s4-5",
        offsetMs: 4700,
        label: "Coercive phrase detected",
        action: {
          type: "APPEND_TRANSCRIPT",
          speaker: "CALLER",
          text: "Do not tell anyone at the branch. Read your 6-digit OTP code immediately or funds will be frozen.",
          timestampSec: 5,
        },
      },
      {
        id: "s4-6",
        offsetMs: 6300,
        label: "Transfer to human",
        action: {
          type: "OPERATOR_TRANSFER_HUMAN",
          actor: "operator",
          note: "Transferring high-pressure call to specialist desk.",
        },
      },
      {
        id: "s4-7",
        offsetMs: 7800,
        label: "Specialist connected",
        action: { type: "AGENT_CONNECTED", actor: "system" },
      },
    ],
  },
};
