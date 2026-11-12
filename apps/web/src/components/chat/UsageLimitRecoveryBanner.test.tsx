import { ProviderDriverKind, ProviderInstanceId, RunId, UsageLimitSourceId } from "@t3tools/contracts";
import type { TimestampFormat } from "@t3tools/contracts/settings";
import { composerUsageResetFromPanel } from "@t3tools/shared/usageLimits";
import { describe, expect, it, vi } from "vite-plus/test";

import { usageLimitRecoveryBannerItem } from "./UsageLimitRecoveryBanner";

const stoppedAt = new Date(2026, 9, 20, 12, 0);

function bannerDescription(resetAt: Date, timestampFormat: TimestampFormat) {
  return usageLimitRecoveryBannerItem({
    runId: RunId.make("run-1"),
    errorCode: null,
    resetAt: resetAt.toISOString(),
    stoppedAt: stoppedAt.toISOString(),
    settled: false,
    requestPending: false,
    snoozedUntil: null,
    recovery: null,
    timestampFormat,
    onChange: async () => {},
  }).description;
}

describe("usageLimitRecoveryBannerItem", () => {
  it.each([
    ["12-hour", "Resets 5:30 PM"],
    ["24-hour", "Resets 17:30"],
  ] as const)("formats a same-day reset with the %s setting", (timestampFormat, expected) => {
    using _now = vi.spyOn(Date, "now").mockReturnValue(stoppedAt.getTime());
    expect(bannerDescription(new Date(2026, 9, 20, 17, 30), timestampFormat)).toBe(expected);
  });

  it("names the day when the reset is tomorrow", () => {
    using _now = vi.spyOn(Date, "now").mockReturnValue(stoppedAt.getTime());
    expect(bannerDescription(new Date(2026, 9, 21, 17, 30), "24-hour")).toBe(
      "Resets tomorrow at 17:30",
    );
  });

  it("shows the CLIProxy panel reset when the rate limit has no unix-seconds resetsAt", () => {
    using _now = vi.spyOn(Date, "now").mockReturnValue(stoppedAt.getTime());
    const resetsAt = new Date(2026, 9, 20, 17, 30).toISOString();
    const instanceId = ProviderInstanceId.make("claudeAgent_pool_ab");
    const claude = ProviderDriverKind.make("claudeAgent");
    const fromPanel = composerUsageResetFromPanel({
      reportedResetAt: null,
      providers: [
        {
          instanceId,
          driver: claude,
          usageLimits: {
            checkedAt: stoppedAt.toISOString(),
            windows: [
              {
                id: "five_hour",
                kind: "session",
                label: "Session",
                usedPercent: 100,
              },
            ],
          },
        },
      ],
      sources: [
        {
          id: UsageLimitSourceId.make("cliproxy_local"),
          kind: "cliproxy",
          label: "CLIProxy",
          checkedAt: stoppedAt.toISOString(),
          accounts: [
            {
              id: "jg",
              driver: claude,
              usageLimits: {
                checkedAt: stoppedAt.toISOString(),
                windows: [
                  {
                    id: "five_hour",
                    kind: "session",
                    label: "Session",
                    usedPercent: 100,
                    resetsAt,
                  },
                  {
                    id: "seven_day_fable",
                    kind: "weekly",
                    label: "Weekly · Fable",
                    usedPercent: 0,
                  },
                ],
              },
            },
          ],
        },
      ],
      instanceId,
      model: "claude-opus-4-6",
      now: stoppedAt.getTime(),
    });
    expect(fromPanel).toBe(resetsAt);
    expect(
      usageLimitRecoveryBannerItem({
        runId: RunId.make("run-1"),
        errorCode: null,
        resetAt: fromPanel,
        stoppedAt: stoppedAt.toISOString(),
        settled: false,
        requestPending: false,
        snoozedUntil: null,
        recovery: null,
        timestampFormat: "24-hour",
        onChange: async () => {},
      }).description,
    ).toBe("Resets 17:30");
    const fromWindow = composerUsageResetFromPanel({
      reportedResetAt: null,
      eventResetsAt: { status: "rejected", rateLimitType: "five_hour", window: { resets_at: resetsAt } },
      providers: [{ instanceId, driver: claude }],
      sources: [],
      instanceId,
      model: "claude-opus-4-6",
      now: stoppedAt.getTime(),
    });
    expect(fromWindow).not.toBeNull();
    expect(
      usageLimitRecoveryBannerItem({
        runId: RunId.make("run-1"),
        errorCode: null,
        resetAt: fromWindow,
        stoppedAt: stoppedAt.toISOString(),
        settled: false,
        requestPending: false,
        snoozedUntil: null,
        recovery: null,
        timestampFormat: "24-hour",
        onChange: async () => {},
      }).description,
    ).toBe("Resets 17:30");
  });
});
