import { describe, expect, it } from "vitest";
import {
  ALLOWED_TRANSITIONS,
  INITIAL_PHONE_STATE,
  phoneReducer,
  selectPhoneViewModel,
  sanitizeCallerCopy,
  derivePipelineStagesFromPhone,
  type CallerPhoneViewModel,
  type PhoneCallState,
} from "../phoneStateMachine";

const FORBIDDEN_CALLER_WORDS = /\b(fraud|deepfake|scores?|tactics?)\b/i;

function assertCallerHasNoForbiddenWords(vm: CallerPhoneViewModel) {
  const fields = [
    vm.headerTitle,
    vm.headline,
    vm.subline,
    vm.bannerText || "",
    vm.challengePhrase || "",
    vm.challengeOutcomeText || "",
    vm.micError || "",
    vm.ariaAnnouncement,
  ];
  for (const txt of fields) {
    expect(txt).not.toMatch(FORBIDDEN_CALLER_WORDS);
  }
}

describe("phoneStateMachine", () => {
  it("handles legal end-to-end transitions from incoming call through verified hangup", () => {
    let s = phoneReducer(INITIAL_PHONE_STATE, {
      type: "SIMULATE_INCOMING_CALL",
      callerId: "+1 (415) 555-0142",
      claimedCustomerId: "CUST-4821-MARCUS",
      claimedIdentity: "Marcus Vance",
    });
    expect(s.callState).toBe("incoming_ringing");

    s = phoneReducer(s, { type: "AGENT_ACCEPT_CALL" });
    expect(s.callState).toBe("connecting");

    s = phoneReducer(s, { type: "START_ANALYZING" });
    expect(s.callState).toBe("analyzing");

    s = phoneReducer(s, { type: "ANALYSIS_COMPLETE", decision: "ALLOW" });
    expect(s.callState).toBe("connected_verified");
    expect(s.endReason).toBeNull();

    s = phoneReducer(s, { type: "OPERATOR_PAUSE_BOT" });
    expect(s.callState).toBe("on_hold");

    s = phoneReducer(s, { type: "OPERATOR_RESUME_BOT" });
    expect(s.callState).toBe("connected_verified");

    s = phoneReducer(s, { type: "OPERATOR_TRANSFER_HUMAN" });
    expect(s.callState).toBe("transferring");

    s = phoneReducer(s, { type: "AGENT_CONNECTED" });
    expect(s.callState).toBe("with_agent");

    s = phoneReducer(s, { type: "CALLER_HANG_UP" });
    expect(s.callState).toBe("ended");
    expect(s.endReason).toBe("caller_hung_up");
  });

  it("handles challenge pending -> recording -> pass/fail/incomplete flows", () => {
    let s = phoneReducer(INITIAL_PHONE_STATE, { type: "START_ANALYZING" });
    s = phoneReducer(s, { type: "ANALYSIS_COMPLETE", decision: "STEP_UP" });
    expect(s.callState).toBe("connected_restricted");

    s = phoneReducer(s, { type: "START_CHALLENGE", phrase: "cobalt mango seven", expiresInSeconds: 20 });
    expect(s.callState).toBe("challenge_pending");
    expect(s.challengeRemainingSec).toBe(20);

    s = phoneReducer(s, { type: "CHALLENGE_TICK" });
    expect(s.challengeRemainingSec).toBe(19);

    s = phoneReducer(s, { type: "CHALLENGE_START_RECORDING" });
    expect(s.callState).toBe("challenge_recording");

    const failed = phoneReducer(s, { type: "CHALLENGE_RESULT", passed: false, note: "Replay detected" });
    expect(failed.callState).toBe("ended");
    expect(failed.endReason).toBe("security_end");

    const passed = phoneReducer(s, { type: "CHALLENGE_RESULT", passed: true });
    expect(passed.callState).toBe("connected_verified");

    const incomplete = phoneReducer(s, { type: "CHALLENGE_RESULT", passed: false, incomplete: true });
    expect(incomplete.callState).toBe("connected_restricted");
    expect(incomplete.challengeOutcome).toBe("incomplete");
  });

  it("rejects illegal transitions without corrupting state and keeps rapid clicks idempotent", () => {
    const s = phoneReducer(INITIAL_PHONE_STATE, { type: "AGENT_CONNECTED" });
    expect(s.callState).toBe("idle");
    expect(s.ignoredTransitions.length).toBe(1);

    let ring = phoneReducer(INITIAL_PHONE_STATE, { type: "SIMULATE_INCOMING_CALL" });
    ring = phoneReducer(ring, { type: "AGENT_ACCEPT_CALL" });
    const countAfterFirst = ring.eventLog.length;
    ring = phoneReducer(ring, { type: "AGENT_ACCEPT_CALL" });
    expect(ring.callState).toBe("connecting");
    expect(ring.eventLog.length).toBe(countAfterFirst);

    let hold = phoneReducer(INITIAL_PHONE_STATE, { type: "START_ANALYZING" });
    hold = phoneReducer(hold, { type: "ANALYSIS_COMPLETE", decision: "ALLOW" });
    hold = phoneReducer(hold, { type: "OPERATOR_PAUSE_BOT" });
    const holdEvents = hold.eventLog.length;
    hold = phoneReducer(hold, { type: "OPERATOR_PAUSE_BOT" });
    expect(hold.eventLog.length).toBe(holdEvents);
  });

  it("produces clean caller and agent view models across all states with ZERO forbidden words on caller screen", () => {
    const allStates: PhoneCallState[] = [
      "idle",
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
      "ended",
    ];

    for (const st of allStates) {
      expect(ALLOWED_TRANSITIONS[st]).toBeDefined();
      const base = { ...INITIAL_PHONE_STATE, callState: st };
      const callerVm = selectPhoneViewModel(base, "caller");
      const agentVm = selectPhoneViewModel(base, "agent");
      assertCallerHasNoForbiddenWords(callerVm);
      expect(agentVm.role).toBe("agent");
      expect(callerVm.screen).toBe(st);
    }

    const endReasons = ["security_end", "missed", "declined", "caller_hung_up", "operator_ended"] as const;
    for (const reason of endReasons) {
      const ended = {
        ...INITIAL_PHONE_STATE,
        callState: "ended" as const,
        endReason: reason,
        micError: "fraud deepfake score tactic test",
      };
      const callerVm = selectPhoneViewModel(ended, "caller");
      assertCallerHasNoForbiddenWords(callerVm);
      expect(sanitizeCallerCopy("Fraud deepfake score tactics warning")).not.toMatch(FORBIDDEN_CALLER_WORDS);
    }
  });

  it("derives pipeline stage statuses from phone call state", () => {
    expect(derivePipelineStagesFromPhone(INITIAL_PHONE_STATE).audioInput).toBe("queued");
    const ringing = phoneReducer(INITIAL_PHONE_STATE, { type: "SIMULATE_INCOMING_CALL" });
    expect(derivePipelineStagesFromPhone(ringing).audioInput).toBe("running");
    const chal = phoneReducer(
      phoneReducer(INITIAL_PHONE_STATE, { type: "START_ANALYZING" }),
      { type: "START_CHALLENGE", phrase: "test" }
    );
    expect(derivePipelineStagesFromPhone(chal).liveness).toBe("running");
  });
});
