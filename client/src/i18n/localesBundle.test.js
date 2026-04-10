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

    expect(en.minerGames.hash_score_label).toBeTruthy();
    expect(pt.minerGames.hash_score_label).toBeTruthy();
    expect(es.minerGames.hash_score_label).toBeTruthy();

    expect(en.minerGames.socket_errors.invalid_session).toBeTruthy();
    expect(pt.minerGames.socket_errors.invalid_session).toBeTruthy();
    expect(es.minerGames.socket_errors.invalid_session).toBeTruthy();

    expect(en.minerGames.game_reward.full_term).toContain("{{days}}");
    expect(pt.minerGames.game_reward.full_term).toContain("{{days}}");
    expect(es.minerGames.game_reward.full_term).toContain("{{days}}");

    expect(en.checkin.error_balance_insufficient).toBeTruthy();
    expect(pt.checkin.error_balance_insufficient).toBeTruthy();
    expect(es.checkin.error_balance_insufficient).toBeTruthy();

    expect(en.checkin.payment_method_heading).toBeTruthy();
    expect(pt.checkin.payment_tab_wallet).toBeTruthy();
    expect(es.checkin.cta_balance_claim).toBeTruthy();

    expect(en.checkin.internal_balance_vs_wallet_hint).toBeTruthy();
    expect(pt.checkin.internal_balance_available).toBeTruthy();
    expect(es.checkin.internal_balance_vs_wallet_hint).toBeTruthy();

    expect(en.wallet.hero_subtitle).toBeTruthy();
    expect(pt.wallet.ledger_title).toBeTruthy();
    expect(es.wallet.tx_inflow).toBeTruthy();

    expect(en.autoMiningGpuPage.turbo_zerads_iframe_title).toBeTruthy();
    expect(pt.autoMiningGpuPage.turbo_zerads_iframe_title).toBeTruthy();
    expect(es.autoMiningGpuPage.turbo_zerads_iframe_title).toBeTruthy();

    expect(en.wallet.web3_deposit.disconnect_to_switch).toBeTruthy();
    expect(pt.wallet.web3_deposit.hint_disconnect_for_contract).toBeTruthy();
    expect(es.wallet.web3_deposit.hint_disconnect_for_wc).toBeTruthy();
  });

  it("exposes Read & Earn strings in en, pt-BR, and es", () => {
    expect(en.readEarn.title).toBeTruthy();
    expect(pt.readEarn.title).toBeTruthy();
    expect(es.readEarn.title).toBeTruthy();
    expect(en.adminReadEarn.title).toBeTruthy();
    expect(pt.adminReadEarn.title).toBeTruthy();
    expect(es.adminReadEarn.title).toBeTruthy();
    expect(en.sidebar.read_earn).toBeTruthy();
    expect(pt.sidebar.read_earn).toBeTruthy();
    expect(es.sidebar.read_earn).toBeTruthy();
  });

  it("exposes support tickets and admin support strings in en, pt-BR, and es", () => {
    expect(en.sidebar.support).toBeTruthy();
    expect(pt.sidebar.support).toBeTruthy();
    expect(es.sidebar.support).toBeTruthy();

    expect(en.support_tickets.title).toBeTruthy();
    expect(pt.support_tickets.title).toBeTruthy();
    expect(es.support_tickets.title).toBeTruthy();

    expect(en.admin_support.title).toBeTruthy();
    expect(pt.admin_support.title).toBeTruthy();
    expect(es.admin_support.title).toBeTruthy();
  });
});
