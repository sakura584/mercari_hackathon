import { describe, expect, it } from "vitest";
import { createSession, getSession } from "./session-repository";

describe("session-repository", () => {
  it("creates a session and reads it back", async () => {
    const session = await createSession({ purposeType: "earn_money", targetAmount: 10000 });

    expect(session.id).toBeTruthy();
    expect(session.purposeType).toBe("earn_money");
    expect(session.targetAmount).toBe(10000);

    const fetched = await getSession(session.id);
    expect(fetched).toEqual(session);
  });

  it("returns null for an unknown session id", async () => {
    const fetched = await getSession("does-not-exist");
    expect(fetched).toBeNull();
  });
});
