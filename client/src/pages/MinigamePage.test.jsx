import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "../store/auth";
import MinigamePage from "./MinigamePage";

vi.mock("../store/auth", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, opts) => {
      if (key === "minigame.reward_hs" && opts?.hr != null) return `+${opts.hr} H/s`;
      if (key === "minigame.play_cooldown" && opts?.time) return `CD ${opts.time}`;
      if (opts && typeof opts === "object") return `${key}:${JSON.stringify(opts)}`;
      return key;
    }
  })
}));

describe("MinigamePage", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        ok: true,
        allowNewStart: true,
        cooldownEndsAt: null,
        cooldownSecondsRemaining: 0,
        activeSession: null,
        rewardHashRate: 25,
        durationSeconds: 69
      }
    });
    vi.mocked(api.post).mockResolvedValue({
      data: {
        ok: true,
        reused: false,
        session: {
          id: 1,
          startedAt: "2026-04-12T12:00:00.000Z",
          endsAt: "2026-04-12T12:01:09.000Z",
          durationSeconds: 69,
          rewardHashRate: 25
        }
      }
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads status and shows play when server allows new start", async () => {
    render(<MinigamePage />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/minigame/status"));
    expect(screen.getByRole("button", { name: "minigame.play" })).toBeEnabled();
  });
});
