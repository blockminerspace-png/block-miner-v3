import { describe, it, expect } from "vitest";
import en from "./locales/en.json";
import pt from "./locales/pt-BR.json";
import es from "./locales/es.json";

describe("locale bundles (pt-BR / es parity)", () => {
  it("exposes wallet deposit options, games label, check-in errors, and turbo iframe title", () => {
    expect(en.wallet.deposit_options.smart_contract).toBeTruthy();
    expect(pt.wallet.deposit_options.smart_contract).toBeTruthy();
    expect(es.wallet.deposit_options.smart_contract).toBeTruthy();

    expect(en.games.temporary_power_label).toBeTruthy();
    expect(pt.games.temporary_power_label).toBeTruthy();
    expect(es.games.temporary_power_label).toBeTruthy();

    expect(en.checkin.error_balance_insufficient).toBeTruthy();
    expect(pt.checkin.error_balance_insufficient).toBeTruthy();
    expect(es.checkin.error_balance_insufficient).toBeTruthy();

    expect(en.autoMiningGpuPage.turbo_zerads_iframe_title).toBeTruthy();
    expect(pt.autoMiningGpuPage.turbo_zerads_iframe_title).toBeTruthy();
    expect(es.autoMiningGpuPage.turbo_zerads_iframe_title).toBeTruthy();
  });
});
