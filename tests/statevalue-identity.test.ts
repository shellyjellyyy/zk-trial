import { describe, expect, it } from "vitest";
import * as compact from "@midnight-ntwrk/compact-runtime";
import * as protocol from "@midnight-ntwrk/midnight-js-protocol/onchain-runtime";

describe("StateValue constructor identity (onchain-runtime-v3 dedup fix)", () => {
  it("Compact Runtime StateValue === Midnight.js Protocol StateValue", () => {
    expect(compact.StateValue).toBe(protocol.StateValue);
    expect(compact.ChargedState).toBe(protocol.ChargedState);
  });

  it("ChargedState accepts a StateValue from compact-runtime", () => {
    // The original failing expression from the bug report.
    const charged = new protocol.ChargedState(compact.StateValue.newNull());
    expect(charged).toBeDefined();
    expect(charged.state).toBeDefined();
  });
});
