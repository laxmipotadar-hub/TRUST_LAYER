import type { CallDecision, CallSession, TranscriptSegment } from "../../types";

export type PhoneCallState =
  | "idle"
  | "incoming_ringing"
  | "outgoing_calling"
  | "connecting"
  | "analyzing"
  | "connected_verified"
  | "connected_restricted"
  | "challenge_pending"
  | "challenge_recording"
  | "on_hold"
  | "transferring"
  | "with_agent"
  | "ended";

export type PhoneEndReason =
  | "caller_hung_up"
  | "declined"
  | "missed"
  | "operator_ended"
  | "security_end"
  | "transferred"
  | null;

export type PhoneActor = "caller" | "operator" | "system" | "bot";

export interface PhoneEventLogEntry {
  id: string;
  timestamp: string;
  event: string;
  actor: PhoneActor;
  fromState: PhoneCallState;
  toState: PhoneCallState;
  detail: string;
}

export interface PhoneMachineState {
  callState: PhoneCallState;
  endReason: PhoneEndReason;
  callerId: string;
  claimedCustomerId: string;
  claimedIdentity: string;
  callId: string | null;
  isDemo: boolean;
  scenarioId: "S1" | "S2" | "S3" | "S4" | null;
  startedAtMs: number | null;
  ringStartedAtMs: number | null;
  elapsedSeconds: number;
  ringElapsedSeconds: number;
  audioLevel: number;
  callerMuted: boolean;
  callerSpeakerOn: boolean;
  botPaused: boolean;
  botSpeaking: boolean;
  analysisIncomplete: boolean;
  recommendedAction: string;
  decision: CallDecision | null;
  challengePhrase: string;
  challengeId: string | null;
  challengeRemainingSec: number;
  challengeTotalSec: number;
  challengeOutcome: "passed" | "failed" | "incomplete" | null;
  challengeOutcomeNote: string | null;
  micError: string | null;
  holdReturnState: "connected_verified" | "connected_restricted";
  transcriptBubbles: Array<{
    id: string;
    speaker: "CALLER" | "AGENT";
    text: string;
    timestampSec: number;
  }>;
  eventLog: PhoneEventLogEntry[];
  ignoredTransitions: string[];
}

export type PhoneAction =
  | {
      type: "SIMULATE_INCOMING_CALL";
      actor?: PhoneActor;
      callerId?: string;
      claimedCustomerId?: string;
      claimedIdentity?: string;
      scenarioId?: "S1" | "S2" | "S3" | "S4" | null;
      isDemo?: boolean;
      timestamp?: string;
      nowMs?: number;
    }
  | {
      type: "OUTGOING_CALL_START";
      actor?: PhoneActor;
      callerId?: string;
      claimedCustomerId?: string;
      claimedIdentity?: string;
      isDemo?: boolean;
      timestamp?: string;
      nowMs?: number;
    }
  | { type: "AGENT_ACCEPT_CALL"; actor?: PhoneActor; timestamp?: string; nowMs?: number }
  | { type: "AGENT_DECLINE_CALL"; actor?: PhoneActor; timestamp?: string }
  | { type: "RING_TIMEOUT_MISSED"; actor?: PhoneActor; timestamp?: string }
  | {
      type: "START_ANALYZING";
      actor?: PhoneActor;
      callId?: string | null;
      claimedCustomerId?: string;
      claimedIdentity?: string;
      isDemo?: boolean;
      timestamp?: string;
      nowMs?: number;
    }
  | {
      type: "ANALYSIS_COMPLETE";
      actor?: PhoneActor;
      session?: CallSession;
      decision?: CallDecision;
      recommendedAction?: string;
      transcript?: TranscriptSegment[];
      analysisIncomplete?: boolean;
      isDemo?: boolean;
      timestamp?: string;
    }
  | { type: "ANALYSIS_FAILED"; actor?: PhoneActor; message?: string; timestamp?: string }
  | {
      type: "APPEND_TRANSCRIPT";
      actor?: PhoneActor;
      speaker?: "CALLER" | "AGENT";
      text: string;
      timestampSec?: number;
      timestamp?: string;
    }
  | {
      type: "START_CHALLENGE";
      actor?: PhoneActor;
      phrase: string;
      challengeId?: string | null;
      expiresInSeconds?: number;
      timestamp?: string;
    }
  | { type: "CHALLENGE_TICK" }
  | { type: "CHALLENGE_START_RECORDING"; actor?: PhoneActor; timestamp?: string }
  | {
      type: "CHALLENGE_RESULT";
      actor?: PhoneActor;
      passed: boolean;
      incomplete?: boolean;
      note?: string;
      timestamp?: string;
    }
  | { type: "OPERATOR_CONTINUE"; actor?: PhoneActor; note?: string; timestamp?: string }
  | { type: "OPERATOR_PAUSE_BOT"; actor?: PhoneActor; note?: string; timestamp?: string }
  | { type: "OPERATOR_RESUME_BOT"; actor?: PhoneActor; note?: string; timestamp?: string }
  | { type: "OPERATOR_START_BOT"; actor?: PhoneActor; timestamp?: string }
  | { type: "OPERATOR_TRANSFER_HUMAN"; actor?: PhoneActor; note?: string; timestamp?: string }
  | { type: "AGENT_CONNECTED"; actor?: PhoneActor; timestamp?: string }
  | { type: "OPERATOR_END_CALL"; actor?: PhoneActor; securityEnd?: boolean; note?: string; timestamp?: string }
  | { type: "CALLER_HANG_UP"; actor?: PhoneActor; timestamp?: string }
  | { type: "SET_AUDIO_LEVEL"; level: number }
  | { type: "TOGGLE_MUTE" }
  | { type: "TOGGLE_SPEAKER" }
  | { type: "SET_MIC_ERROR"; message: string | null }
  | { type: "TICK_CALL_TIMER" }
  | { type: "RESET_PHONE"; actor?: PhoneActor; timestamp?: string };

export const INITIAL_PHONE_STATE: PhoneMachineState = {
  callState: "idle",
  endReason: null,
  callerId: "+1 (415) 555-0194",
  claimedCustomerId: "CUST-4821-MARCUS",
  claimedIdentity: "Marcus Vance",
  callId: null,
  isDemo: false,
  scenarioId: null,
  startedAtMs: null,
  ringStartedAtMs: null,
  elapsedSeconds: 0,
  ringElapsedSeconds: 0,
  audioLevel: 0,
  callerMuted: false,
  callerSpeakerOn: false,
  botPaused: false,
  botSpeaking: false,
  analysisIncomplete: false,
  recommendedAction: "",
  decision: null,
  challengePhrase: "cobalt mango seven",
  challengeId: null,
  challengeRemainingSec: 20,
  challengeTotalSec: 20,
  challengeOutcome: null,
  challengeOutcomeNote: null,
  micError: null,
  holdReturnState: "connected_verified",
  transcriptBubbles: [],
  eventLog: [],
  ignoredTransitions: [],
};

type TransitionEvent =
  | "SIMULATE_INCOMING_CALL"
  | "OUTGOING_CALL_START"
  | "AGENT_ACCEPT_CALL"
  | "AGENT_DECLINE_CALL"
  | "RING_TIMEOUT_MISSED"
  | "START_ANALYZING"
  | "ANALYSIS_COMPLETE"
  | "ANALYSIS_FAILED"
  | "START_CHALLENGE"
  | "CHALLENGE_START_RECORDING"
  | "CHALLENGE_RESULT"
  | "OPERATOR_CONTINUE"
  | "OPERATOR_PAUSE_BOT"
  | "OPERATOR_RESUME_BOT"
  | "OPERATOR_TRANSFER_HUMAN"
  | "AGENT_CONNECTED"
  | "OPERATOR_END_CALL"
  | "CALLER_HANG_UP"
  | "RESET_PHONE";

const ACTIVE_CALL_STATES: PhoneCallState[] = [
  "incoming_ringing",
  "outgoing_calling",
  "connecting",
  "analyzing",
  "connected_verified",
  "connected_restricted",
  "challenge_pending",
  "challenge_recording",
  "on_hold",
  "transferring",
  "with_agent",
];

export const ALLOWED_TRANSITIONS: Record<PhoneCallState, Set<TransitionEvent>> = {
  idle: new Set(["SIMULATE_INCOMING_CALL", "OUTGOING_CALL_START", "START_ANALYZING", "ANALYSIS_COMPLETE", "RESET_PHONE"]),
  incoming_ringing: new Set([
    "AGENT_ACCEPT_CALL",
    "AGENT_DECLINE_CALL",
    "RING_TIMEOUT_MISSED",
    "START_ANALYZING",
    "OPERATOR_END_CALL",
    "CALLER_HANG_UP",
    "RESET_PHONE",
  ]),
  outgoing_calling: new Set([
    "AGENT_ACCEPT_CALL",
    "AGENT_DECLINE_CALL",
    "RING_TIMEOUT_MISSED",
    "START_ANALYZING",
    "OPERATOR_END_CALL",
    "CALLER_HANG_UP",
    "RESET_PHONE",
  ]),
  connecting: new Set([
    "START_ANALYZING",
    "ANALYSIS_COMPLETE",
    "ANALYSIS_FAILED",
    "OPERATOR_PAUSE_BOT",
    "OPERATOR_TRANSFER_HUMAN",
    "OPERATOR_END_CALL",
    "CALLER_HANG_UP",
    "RESET_PHONE",
  ]),
  analyzing: new Set([
    "ANALYSIS_COMPLETE",
    "ANALYSIS_FAILED",
    "START_CHALLENGE",
    "OPERATOR_CONTINUE",
    "OPERATOR_PAUSE_BOT",
    "OPERATOR_TRANSFER_HUMAN",
    "OPERATOR_END_CALL",
    "CALLER_HANG_UP",
    "RESET_PHONE",
  ]),
  connected_verified: new Set([
    "START_ANALYZING",
    "ANALYSIS_COMPLETE",
    "START_CHALLENGE",
    "OPERATOR_CONTINUE",
    "OPERATOR_PAUSE_BOT",
    "OPERATOR_TRANSFER_HUMAN",
    "OPERATOR_END_CALL",
    "CALLER_HANG_UP",
    "RESET_PHONE",
  ]),
  connected_restricted: new Set([
    "START_ANALYZING",
    "ANALYSIS_COMPLETE",
    "START_CHALLENGE",
    "OPERATOR_CONTINUE",
    "OPERATOR_PAUSE_BOT",
    "OPERATOR_TRANSFER_HUMAN",
    "OPERATOR_END_CALL",
    "CALLER_HANG_UP",
    "RESET_PHONE",
  ]),
  challenge_pending: new Set([
    "CHALLENGE_START_RECORDING",
    "CHALLENGE_RESULT",
    "OPERATOR_CONTINUE",
    "OPERATOR_PAUSE_BOT",
    "OPERATOR_TRANSFER_HUMAN",
    "OPERATOR_END_CALL",
    "CALLER_HANG_UP",
    "RESET_PHONE",
  ]),
  challenge_recording: new Set([
    "CHALLENGE_RESULT",
    "OPERATOR_CONTINUE",
    "OPERATOR_TRANSFER_HUMAN",
    "OPERATOR_END_CALL",
    "CALLER_HANG_UP",
    "RESET_PHONE",
  ]),
  on_hold: new Set([
    "OPERATOR_RESUME_BOT",
    "OPERATOR_CONTINUE",
    "START_CHALLENGE",
    "OPERATOR_TRANSFER_HUMAN",
    "OPERATOR_END_CALL",
    "CALLER_HANG_UP",
    "RESET_PHONE",
  ]),
  transferring: new Set([
    "AGENT_CONNECTED",
    "OPERATOR_END_CALL",
    "CALLER_HANG_UP",
    "RESET_PHONE",
  ]),
  with_agent: new Set([
    "OPERATOR_PAUSE_BOT",
    "OPERATOR_END_CALL",
    "CALLER_HANG_UP",
    "RESET_PHONE",
  ]),
  ended: new Set([
    "SIMULATE_INCOMING_CALL",
    "OUTGOING_CALL_START",
    "START_ANALYZING",
    "ANALYSIS_COMPLETE",
    "RESET_PHONE",
  ]),
};

function appendLog(
  state: PhoneMachineState,
  event: string,
  actor: PhoneActor,
  fromState: PhoneCallState,
  toState: PhoneCallState,
  detail: string,
  timestamp?: string
): PhoneEventLogEntry[] {
  const entry: PhoneEventLogEntry = {
    id: `evt-${state.eventLog.length + 1}-${event}`,
    timestamp: timestamp || new Date().toISOString(),
    event,
    actor,
    fromState,
    toState,
    detail,
  };
  return [entry, ...state.eventLog].slice(0, 80);
}

function decisionToState(decision?: CallDecision | null): {
  callState: PhoneCallState;
  endReason: PhoneEndReason;
} {
  if (decision === "ALLOW") return { callState: "connected_verified", endReason: null };
  if (decision === "BLOCK" || decision === "END_CALL") {
    return { callState: "ended", endReason: "security_end" };
  }
  return { callState: "connected_restricted", endReason: null };
}

function isTransitionEvent(actionType: PhoneAction["type"]): actionType is TransitionEvent {
  return (
    actionType !== "SET_AUDIO_LEVEL" &&
    actionType !== "TOGGLE_MUTE" &&
    actionType !== "TOGGLE_SPEAKER" &&
    actionType !== "SET_MIC_ERROR" &&
    actionType !== "TICK_CALL_TIMER" &&
    actionType !== "CHALLENGE_TICK" &&
    actionType !== "APPEND_TRANSCRIPT" &&
    actionType !== "OPERATOR_START_BOT"
  );
}

export function phoneReducer(state: PhoneMachineState, action: PhoneAction): PhoneMachineState {
  // Non-transition local telemetry updates
  if (action.type === "SET_AUDIO_LEVEL") {
    const level = Math.max(0, Math.min(100, Math.round(action.level)));
    return level === state.audioLevel ? state : { ...state, audioLevel: level };
  }
  if (action.type === "TOGGLE_MUTE") {
    return { ...state, callerMuted: !state.callerMuted };
  }
  if (action.type === "TOGGLE_SPEAKER") {
    return { ...state, callerSpeakerOn: !state.callerSpeakerOn };
  }
  if (action.type === "SET_MIC_ERROR") {
    return { ...state, micError: action.message };
  }
  if (action.type === "TICK_CALL_TIMER") {
    if (state.callState === "incoming_ringing" || state.callState === "outgoing_calling") {
      return { ...state, ringElapsedSeconds: state.ringElapsedSeconds + 1 };
    }
    if (ACTIVE_CALL_STATES.includes(state.callState)) {
      return { ...state, elapsedSeconds: state.elapsedSeconds + 1 };
    }
    return state;
  }
  if (action.type === "CHALLENGE_TICK") {
    if (state.callState !== "challenge_pending") return state;
    return { ...state, challengeRemainingSec: Math.max(0, state.challengeRemainingSec - 1) };
  }
  if (action.type === "APPEND_TRANSCRIPT") {
    const cleaned = action.text.trim();
    if (!cleaned) return state;
    const exists = state.transcriptBubbles.some((b) => b.text === cleaned);
    if (exists) return state;
    return {
      ...state,
      transcriptBubbles: [
        ...state.transcriptBubbles,
        {
          id: `tb-${state.transcriptBubbles.length + 1}`,
          speaker: action.speaker || "CALLER",
          text: cleaned,
          timestampSec: action.timestampSec ?? state.elapsedSeconds,
        },
      ],
    };
  }
  if (action.type === "OPERATOR_START_BOT") {
    return {
      ...state,
      botSpeaking: true,
      eventLog: appendLog(
        state,
        "START_BOT",
        action.actor || "bot",
        state.callState,
        state.callState,
        "Bot greeting playback started.",
        action.timestamp
      ),
    };
  }

  // Idempotent no-op guards for rapid repeated clicks
  if (
    (action.type === "AGENT_ACCEPT_CALL" && state.callState === "connecting") ||
    (action.type === "OPERATOR_PAUSE_BOT" && state.callState === "on_hold") ||
    (action.type === "OPERATOR_TRANSFER_HUMAN" &&
      (state.callState === "transferring" || state.callState === "with_agent")) ||
    ((action.type === "OPERATOR_END_CALL" ||
      action.type === "CALLER_HANG_UP" ||
      action.type === "AGENT_DECLINE_CALL" ||
      action.type === "RING_TIMEOUT_MISSED") &&
      state.callState === "ended") ||
    (action.type === "CHALLENGE_START_RECORDING" && state.callState === "challenge_recording")
  ) {
    return state;
  }

  if (isTransitionEvent(action.type)) {
    const allowed = ALLOWED_TRANSITIONS[state.callState];
    if (!allowed.has(action.type)) {
      const note = `Ignored illegal transition ${action.type} from ${state.callState}`;
      return {
        ...state,
        ignoredTransitions: [...state.ignoredTransitions.slice(-19), note],
      };
    }
  }

  const ts = action.timestamp;

  switch (action.type) {
    case "RESET_PHONE":
      return {
        ...INITIAL_PHONE_STATE,
        eventLog: appendLog(state, "RESET_PHONE", action.actor || "system", state.callState, "idle", "Session reset", ts),
      };

    case "SIMULATE_INCOMING_CALL": {
      const now = action.nowMs ?? Date.now();
      return {
        ...INITIAL_PHONE_STATE,
        callState: "incoming_ringing",
        callerId: action.callerId || "+1 (415) 555-0194",
        claimedCustomerId: action.claimedCustomerId || "CUST-4821-MARCUS",
        claimedIdentity: action.claimedIdentity || "Marcus Vance",
        isDemo: action.isDemo ?? true,
        scenarioId: action.scenarioId ?? null,
        ringStartedAtMs: now,
        startedAtMs: now,
        eventLog: appendLog(
          state,
          "INCOMING_RING",
          action.actor || "caller",
          state.callState,
          "incoming_ringing",
          `Incoming call for ${action.claimedIdentity || "Marcus Vance"}`,
          ts
        ),
      };
    }

    case "OUTGOING_CALL_START": {
      const now = action.nowMs ?? Date.now();
      return {
        ...INITIAL_PHONE_STATE,
        callState: "outgoing_calling",
        callerId: action.callerId || "+1 (415) 555-0194",
        claimedCustomerId: action.claimedCustomerId || "CUST-4821-MARCUS",
        claimedIdentity: action.claimedIdentity || "Marcus Vance",
        isDemo: action.isDemo ?? false,
        ringStartedAtMs: now,
        startedAtMs: now,
        eventLog: appendLog(
          state,
          "OUTGOING_CALL",
          action.actor || "caller",
          state.callState,
          "outgoing_calling",
          "Caller initiated call to AEGIS Bank, Customer Care",
          ts
        ),
      };
    }

    case "AGENT_ACCEPT_CALL":
      return {
        ...state,
        callState: "connecting",
        endReason: null,
        elapsedSeconds: 0,
        eventLog: appendLog(
          state,
          "CALL_ACCEPTED",
          action.actor || "operator",
          state.callState,
          "connecting",
          "Receiver answered incoming call",
          ts
        ),
      };

    case "AGENT_DECLINE_CALL":
      return {
        ...state,
        callState: "ended",
        endReason: "declined",
        audioLevel: 0,
        botSpeaking: false,
        eventLog: appendLog(
          state,
          "CALL_DECLINED",
          action.actor || "operator",
          state.callState,
          "ended",
          "Receiver declined incoming call",
          ts
        ),
      };

    case "RING_TIMEOUT_MISSED":
      return {
        ...state,
        callState: "ended",
        endReason: "missed",
        audioLevel: 0,
        botSpeaking: false,
        eventLog: appendLog(
          state,
          "RING_MISSED",
          action.actor || "system",
          state.callState,
          "ended",
          "Call unanswered after 25s ring timeout",
          ts
        ),
      };

    case "START_ANALYZING": {
      const now = action.nowMs ?? Date.now();
      return {
        ...state,
        callState: "analyzing",
        endReason: null,
        callId: action.callId ?? state.callId,
        claimedCustomerId: action.claimedCustomerId || state.claimedCustomerId,
        claimedIdentity: action.claimedIdentity || state.claimedIdentity,
        isDemo: action.isDemo ?? state.isDemo,
        startedAtMs: state.startedAtMs ?? now,
        analysisIncomplete: false,
        challengeOutcome: null,
        challengeOutcomeNote: null,
        micError: null,
        eventLog: appendLog(
          state,
          "START_ANALYZING",
          action.actor || "system",
          state.callState,
          "analyzing",
          "Running multi-layer voice & script verification",
          ts
        ),
      };
    }

    case "ANALYSIS_COMPLETE": {
      const sess = action.session;
      const decision = action.decision || sess?.decision || "STEP_UP";
      const mapped = decisionToState(decision);
      const isIncomplete =
        Boolean(action.analysisIncomplete) ||
        decision === "INCOMPLETE ANALYSIS" ||
        sess?.voice_authenticity?.status === "UNAVAILABLE" ||
        sess?.scam_analysis?.status === "UNAVAILABLE";
      const realSnippets = (action.transcript || sess?.transcript || [])
        .filter((s) => s.text.trim() && !s.text.trim().startsWith("[Audio sample:"))
        .map((s, idx) => ({
          id: s.id || `tb-${idx + 1}`,
          speaker: s.speaker,
          text: s.text,
          timestampSec: s.timestamp_sec,
        }));
      return {
        ...state,
        callState: mapped.callState,
        endReason: mapped.endReason,
        callId: sess?.call_id ?? state.callId,
        claimedCustomerId: sess?.claimed_customer_id || state.claimedCustomerId,
        claimedIdentity:
          sess?.caller_profile?.claimed_name || sess?.caller_label || state.claimedIdentity,
        isDemo: action.isDemo ?? (sess ? sess.execution_mode === "DEMO" : state.isDemo),
        decision,
        analysisIncomplete: isIncomplete,
        recommendedAction:
          action.recommendedAction ||
          sess?.decision_reason ||
          sess?.trust_breakdown?.recommended_action ||
          "",
        transcriptBubbles: realSnippets.length > 0 ? realSnippets : state.transcriptBubbles,
        holdReturnState:
          mapped.callState === "connected_verified" ? "connected_verified" : "connected_restricted",
        botPaused: mapped.endReason === "security_end" ? true : state.botPaused,
        audioLevel: mapped.callState === "ended" ? 0 : state.audioLevel,
        eventLog: appendLog(
          state,
          `DECISION_${decision}`,
          action.actor || "system",
          state.callState,
          mapped.callState,
          `Analysis decision: ${decision}`,
          ts
        ),
      };
    }

    case "ANALYSIS_FAILED":
      return {
        ...state,
        callState: "connected_restricted",
        analysisIncomplete: true,
        decision: "INCOMPLETE ANALYSIS",
        recommendedAction: action.message || "Analysis incomplete — require manual callback verification.",
        holdReturnState: "connected_restricted",
        eventLog: appendLog(
          state,
          "ANALYSIS_FAILED",
          action.actor || "system",
          state.callState,
          "connected_restricted",
          action.message || "Analysis incomplete",
          ts
        ),
      };

    case "START_CHALLENGE": {
      const ttl = Math.max(5, action.expiresInSeconds || 20);
      return {
        ...state,
        callState: "challenge_pending",
        challengePhrase: action.phrase,
        challengeId: action.challengeId ?? state.challengeId,
        challengeTotalSec: ttl,
        challengeRemainingSec: ttl,
        challengeOutcome: null,
        challengeOutcomeNote: null,
        micError: null,
        eventLog: appendLog(
          state,
          "START_CHALLENGE",
          action.actor || "operator",
          state.callState,
          "challenge_pending",
          `Prompted caller with phrase: "${action.phrase}"`,
          ts
        ),
      };
    }

    case "CHALLENGE_START_RECORDING":
      return {
        ...state,
        callState: "challenge_recording",
        micError: null,
        eventLog: appendLog(
          state,
          "CHALLENGE_RECORDING",
          action.actor || "caller",
          state.callState,
          "challenge_recording",
          "Caller microphone recording challenge reply",
          ts
        ),
      };

    case "CHALLENGE_RESULT": {
      if (action.passed) {
        return {
          ...state,
          callState: "connected_verified",
          endReason: null,
          decision: "ALLOW",
          challengeOutcome: "passed",
          challengeOutcomeNote: action.note || "Challenge verified",
          audioLevel: 0,
          holdReturnState: "connected_verified",
          eventLog: appendLog(
            state,
            "CHALLENGE_PASSED",
            action.actor || "system",
            state.callState,
            "connected_verified",
            "Live voice liveness check passed",
            ts
          ),
        };
      }
      if (action.incomplete) {
        return {
          ...state,
          callState: "connected_restricted",
          endReason: null,
          decision: "STEP_UP",
          challengeOutcome: "incomplete",
          challengeOutcomeNote: action.note || "Challenge incomplete",
          audioLevel: 0,
          holdReturnState: "connected_restricted",
          eventLog: appendLog(
            state,
            "CHALLENGE_INCOMPLETE",
            action.actor || "system",
            state.callState,
            "connected_restricted",
            action.note || "Liveness check incomplete",
            ts
          ),
        };
      }
      return {
        ...state,
        callState: "ended",
        endReason: "security_end",
        decision: "END_CALL",
        challengeOutcome: "failed",
        challengeOutcomeNote: action.note || "Challenge failed",
        audioLevel: 0,
        botPaused: true,
        eventLog: appendLog(
          state,
          "CHALLENGE_FAILED",
          action.actor || "system",
          state.callState,
          "ended",
          action.note || "Liveness check failed -> END_CALL",
          ts
        ),
      };
    }

    case "OPERATOR_CONTINUE":
      return {
        ...state,
        callState: "connected_verified",
        endReason: null,
        decision: "ALLOW",
        botPaused: false,
        holdReturnState: "connected_verified",
        recommendedAction: action.note || "Operator approved call continuation.",
        eventLog: appendLog(
          state,
          "OPERATOR_CONTINUE",
          action.actor || "operator",
          state.callState,
          "connected_verified",
          action.note || "Operator approved call",
          ts
        ),
      };

    case "OPERATOR_PAUSE_BOT": {
      const returnState =
        state.callState === "connected_verified" ? "connected_verified" : "connected_restricted";
      return {
        ...state,
        callState: "on_hold",
        botPaused: true,
        botSpeaking: false,
        holdReturnState: returnState,
        eventLog: appendLog(
          state,
          "OPERATOR_PAUSE_BOT",
          action.actor || "operator",
          state.callState,
          "on_hold",
          action.note || "Bot Guard paused; caller placed on hold",
          ts
        ),
      };
    }

    case "OPERATOR_RESUME_BOT":
      return {
        ...state,
        callState: state.holdReturnState,
        botPaused: false,
        eventLog: appendLog(
          state,
          "OPERATOR_RESUME_BOT",
          action.actor || "operator",
          state.callState,
          state.holdReturnState,
          action.note || "Operator resumed call",
          ts
        ),
      };

    case "OPERATOR_TRANSFER_HUMAN":
      return {
        ...state,
        callState: "transferring",
        botPaused: true,
        botSpeaking: false,
        recommendedAction: action.note || "Escalated to human banking specialist.",
        eventLog: appendLog(
          state,
          "OPERATOR_TRANSFER_HUMAN",
          action.actor || "operator",
          state.callState,
          "transferring",
          action.note || "Transferring caller to human specialist",
          ts
        ),
      };

    case "AGENT_CONNECTED":
      return {
        ...state,
        callState: "with_agent",
        eventLog: appendLog(
          state,
          "AGENT_CONNECTED",
          action.actor || "system",
          state.callState,
          "with_agent",
          "Connected with human banking specialist",
          ts
        ),
      };

    case "OPERATOR_END_CALL": {
      const reason: PhoneEndReason = action.securityEnd ? "security_end" : "operator_ended";
      return {
        ...state,
        callState: "ended",
        endReason: reason,
        decision: "END_CALL",
        audioLevel: 0,
        botPaused: true,
        botSpeaking: false,
        eventLog: appendLog(
          state,
          "OPERATOR_END_CALL",
          action.actor || "operator",
          state.callState,
          "ended",
          action.note || "Operator terminated call",
          ts
        ),
      };
    }

    case "CALLER_HANG_UP":
      return {
        ...state,
        callState: "ended",
        endReason: "caller_hung_up",
        audioLevel: 0,
        botSpeaking: false,
        eventLog: appendLog(
          state,
          "CALLER_HANG_UP",
          action.actor || "caller",
          state.callState,
          "ended",
          "Caller ended the call",
          ts
        ),
      };

    default:
      return state;
  }
}

export interface CallerPhoneViewModel {
  role: "caller";
  screen: PhoneCallState;
  headerTitle: string;
  headline: string;
  subline: string;
  bannerTone: "neutral" | "success" | "amber" | "danger";
  bannerText: string | null;
  showVerifiedShield: boolean;
  showTimer: boolean;
  elapsedSeconds: number;
  showWaveform: boolean;
  audioLevel: number;
  showVerifyButton: boolean;
  showStartReplyButton: boolean;
  showEndButton: boolean;
  showInCallControls: boolean;
  callerMuted: boolean;
  callerSpeakerOn: boolean;
  challengePhrase: string | null;
  challengeRemainingSec: number;
  challengeTotalSec: number;
  challengeOutcomeText: string | null;
  micError: string | null;
  ariaAnnouncement: string;
}

export interface AgentPhoneViewModel {
  role: "agent";
  screen: PhoneCallState;
  callerId: string;
  claimedIdentity: string;
  claimedCustomerId: string;
  statusChip: "Incoming" | "Verified" | "Needs verification" | "Do not proceed" | "Analysis incomplete" | "On Hold" | "Transferring" | "Connected" | "Ended";
  statusVariant: "info" | "success" | "warning" | "danger" | "neutral";
  showIncomingActions: boolean;
  ringElapsedSeconds: number;
  ringTimeoutSeconds: number;
  elapsedSeconds: number;
  transcriptBubbles: PhoneMachineState["transcriptBubbles"];
  recommendedAction: string;
  headline: string;
  subline: string;
  micError: string | null;
  ariaAnnouncement: string;
}

const CALLER_FORBIDDEN_WORDS_RE = /\b(fraud|deepfake|scores?|tactics?)\b/gi;

export function sanitizeCallerCopy(text: string): string {
  return text.replace(CALLER_FORBIDDEN_WORDS_RE, "security check");
}

export function selectPhoneViewModel(state: PhoneMachineState, role: "caller"): CallerPhoneViewModel;
export function selectPhoneViewModel(state: PhoneMachineState, role: "agent"): AgentPhoneViewModel;
export function selectPhoneViewModel(
  state: PhoneMachineState,
  role: "caller" | "agent"
): CallerPhoneViewModel | AgentPhoneViewModel {
  if (role === "caller") {
    const s = state.callState;
    let headline = "No active call";
    let subline = "Phone ready";
    let bannerTone: CallerPhoneViewModel["bannerTone"] = "neutral";
    let bannerText: string | null = null;
    let challengeOutcomeText: string | null = null;

    if (s === "incoming_ringing" || s === "outgoing_calling") {
      headline = "AEGIS Bank, Customer Care";
      subline = "Calling AEGIS Bank, Customer Care...";
    } else if (s === "connecting") {
      headline = "AEGIS Bank, Customer Care";
      subline = "Connecting...";
    } else if (s === "analyzing") {
      headline = "AEGIS Bank, Customer Care";
      subline = "Securing your call...";
    } else if (s === "connected_verified") {
      headline = "AEGIS Bank, Customer Care";
      subline = "Connected";
      bannerTone = "success";
      bannerText = "Verified";
      if (state.challengeOutcome === "passed") {
        challengeOutcomeText = "Thanks, you're verified";
      }
    } else if (s === "connected_restricted") {
      headline = "AEGIS Bank, Customer Care";
      subline = "Connected";
      bannerTone = "amber";
      bannerText = "For your security, some actions need extra verification";
      if (state.challengeOutcome === "incomplete") {
        challengeOutcomeText = "We could not verify you";
      }
    } else if (s === "challenge_pending") {
      headline = "Voice Check";
      subline = `Please say: ${state.challengePhrase}`;
      bannerTone = "amber";
      bannerText = "Voice confirmation requested";
    } else if (s === "challenge_recording") {
      headline = "Listening...";
      subline = `Please say: ${state.challengePhrase}`;
      bannerTone = "amber";
      bannerText = "Recording your voice reply";
    } else if (s === "on_hold") {
      headline = "AEGIS Bank, Customer Care";
      subline = "Please hold";
      bannerTone = "neutral";
      bannerText = "Please hold while an agent reviews your call";
    } else if (s === "transferring") {
      headline = "AEGIS Bank, Customer Care";
      subline = "Connecting you to a specialist...";
    } else if (s === "with_agent") {
      headline = "Specialist";
      subline = "Speaking with customer specialist";
      bannerTone = "success";
      bannerText = "Connected to specialist";
    } else if (s === "ended") {
      headline = "Call ended";
      if (state.endReason === "security_end") {
        subline =
          "We're unable to continue this call. Please visit your nearest branch or call the number on your card.";
        bannerTone = "danger";
        bannerText = "Call disconnected";
        if (state.challengeOutcome === "failed") {
          challengeOutcomeText = "We could not verify you";
        }
      } else if (state.endReason === "missed") {
        subline = "No answer";
      } else if (state.endReason === "declined") {
        subline = "Call declined";
      } else {
        subline = "Call ended";
      }
    }

    const safeHeadline = sanitizeCallerCopy(headline);
    const safeSubline = sanitizeCallerCopy(subline);
    const safeBanner = bannerText ? sanitizeCallerCopy(bannerText) : null;
    const safeOutcome = challengeOutcomeText ? sanitizeCallerCopy(challengeOutcomeText) : null;

    return {
      role: "caller",
      screen: s,
      headerTitle: "AEGIS Bank",
      headline: safeHeadline,
      subline: safeSubline,
      bannerTone,
      bannerText: safeBanner,
      showVerifiedShield: s === "connected_verified",
      showTimer:
        s === "connected_verified" ||
        s === "connected_restricted" ||
        s === "on_hold" ||
        s === "with_agent" ||
        s === "ended",
      elapsedSeconds: state.elapsedSeconds,
      showWaveform:
        s === "connected_verified" ||
        s === "connected_restricted" ||
        s === "analyzing" ||
        s === "challenge_recording" ||
        s === "with_agent",
      audioLevel: state.audioLevel,
      showVerifyButton: s === "connected_restricted",
      showStartReplyButton: s === "challenge_pending",
      showEndButton: s !== "idle" && s !== "ended",
      showInCallControls:
        s === "connected_verified" ||
        s === "connected_restricted" ||
        s === "on_hold" ||
        s === "with_agent",
      callerMuted: state.callerMuted,
      callerSpeakerOn: state.callerSpeakerOn,
      challengePhrase: s === "challenge_pending" || s === "challenge_recording" ? state.challengePhrase : null,
      challengeRemainingSec: state.challengeRemainingSec,
      challengeTotalSec: state.challengeTotalSec,
      challengeOutcomeText: safeOutcome,
      micError: state.micError ? sanitizeCallerCopy(state.micError) : null,
      ariaAnnouncement: `Caller phone: ${safeHeadline}. ${safeSubline}`,
    };
  }

  // Agent phone view model
  const s = state.callState;
  let statusChip: AgentPhoneViewModel["statusChip"] = "Connected";
  let statusVariant: AgentPhoneViewModel["statusVariant"] = "neutral";
  let headline = state.claimedIdentity || "Agent Receiver";
  let subline = "Waiting for incoming call";

  if (s === "idle") {
    statusChip = "Connected";
    statusVariant = "neutral";
    headline = "Ready for Calls";
    subline = "No active caller on line";
  } else if (s === "incoming_ringing" || s === "outgoing_calling") {
    statusChip = "Incoming";
    statusVariant = "info";
    headline = state.claimedIdentity;
    subline = `Incoming call from ${state.callerId}`;
  } else if (s === "connecting") {
    statusChip = "Needs verification";
    statusVariant = "warning";
    subline = "Establishing audio stream...";
  } else if (s === "analyzing") {
    statusChip = "Needs verification";
    statusVariant = "info";
    subline = "Evaluating caller audio and transcript...";
  } else if (s === "connected_verified") {
    statusChip = "Verified";
    statusVariant = "success";
    subline = "Identity and authenticity verified";
  } else if (s === "connected_restricted") {
    statusChip = state.analysisIncomplete ? "Analysis incomplete" : "Needs verification";
    statusVariant = "warning";
    subline = state.analysisIncomplete
      ? "Analysis incomplete — proceed with manual verification"
      : "Step-up verification recommended";
  } else if (s === "challenge_pending" || s === "challenge_recording") {
    statusChip = "Needs verification";
    statusVariant = "warning";
    subline =
      s === "challenge_recording"
        ? "Caller speaking verification phrase..."
        : `Awaiting spoken phrase: "${state.challengePhrase}"`;
  } else if (s === "on_hold") {
    statusChip = "On Hold";
    statusVariant = "warning";
    subline = "Bot paused — caller on hold";
  } else if (s === "transferring") {
    statusChip = "Transferring";
    statusVariant = "info";
    subline = "Routing call to human specialist...";
  } else if (s === "with_agent") {
    statusChip = "Connected";
    statusVariant = "success";
    subline = "Human specialist speaking with caller";
  } else if (s === "ended") {
    if (state.endReason === "security_end") {
      statusChip = "Do not proceed";
      statusVariant = "danger";
      headline = "Do not proceed — Security End";
      subline = "Call blocked per security policy";
    } else if (state.endReason === "missed") {
      statusChip = "Ended";
      statusVariant = "warning";
      headline = "Missed call";
      subline = "Receiver did not answer within 25s";
    } else if (state.endReason === "declined") {
      statusChip = "Ended";
      statusVariant = "neutral";
      headline = "Call declined";
      subline = "Receiver declined the incoming call";
    } else {
      statusChip = "Ended";
      statusVariant = "neutral";
      headline = "Call ended";
      subline =
        state.endReason === "caller_hung_up"
          ? "Caller hung up"
          : "Operator closed call";
    }
  }

  return {
    role: "agent",
    screen: s,
    callerId: state.callerId,
    claimedIdentity: state.claimedIdentity,
    claimedCustomerId: state.claimedCustomerId,
    statusChip,
    statusVariant,
    showIncomingActions: s === "incoming_ringing" || s === "outgoing_calling",
    ringElapsedSeconds: state.ringElapsedSeconds,
    ringTimeoutSeconds: 25,
    elapsedSeconds: state.elapsedSeconds,
    transcriptBubbles: state.transcriptBubbles,
    recommendedAction:
      state.analysisIncomplete
        ? "Analysis incomplete — verify caller manually"
        : state.recommendedAction || subline,
    headline,
    subline,
    micError: state.micError,
    ariaAnnouncement: `Agent phone: ${statusChip}. ${headline}. ${subline}`,
  };
}

export interface PipelinePhoneStageStatuses {
  audioInput: "queued" | "running" | "done" | "error";
  liveness: "queued" | "running" | "done" | "error" | "skipped";
  operator: "queued" | "running" | "done" | "error" | "pending";
}

export function derivePipelineStagesFromPhone(
  phoneState: PhoneMachineState
): PipelinePhoneStageStatuses {
  const s = phoneState.callState;
  const audioInput: PipelinePhoneStageStatuses["audioInput"] =
    s === "idle"
      ? "queued"
      : s === "incoming_ringing" || s === "outgoing_calling" || s === "connecting" || s === "analyzing"
      ? "running"
      : "done";

  const liveness: PipelinePhoneStageStatuses["liveness"] =
    s === "challenge_pending" || s === "challenge_recording"
      ? "running"
      : phoneState.challengeOutcome === "passed"
      ? "done"
      : phoneState.challengeOutcome === "failed" || phoneState.challengeOutcome === "incomplete"
      ? "error"
      : "skipped";

  const operator: PipelinePhoneStageStatuses["operator"] =
    s === "connected_verified" || s === "with_agent" || s === "ended"
      ? "done"
      : s === "on_hold" || s === "transferring" || s === "connected_restricted"
      ? "pending"
      : "queued";

  return { audioInput, liveness, operator };
}
