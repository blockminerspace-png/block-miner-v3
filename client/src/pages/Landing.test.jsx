import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAuthStore } from "../store/auth";
import Landing from "./Landing";

const mockI18n = vi.hoisted(() => ({
  language: "en",
  resolvedLanguage: "en",
  changeLanguage: vi.fn(() => Promise.resolve()),
}));

vi.mock("../store/auth", () => ({
  useAuthStore: vi.fn(() => ({ isAuthenticated: false })),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key, i18n: mockI18n }),
}));

vi.mock("../components/BrandLogo", () => ({
  default: () => <div data-testid="brand-logo" />,
}));

// Mock fetch so public-stats call doesn't throw in jsdom
global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ ok: false }) }));

const renderLanding = () =>
  render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  );

describe("Landing page", () => {
  beforeEach(() => {
    useAuthStore.mockReturnValue({ isAuthenticated: false });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders without crashing", () => {
    renderLanding();
  });

  it("shows brand logo", () => {
    renderLanding();
    expect(screen.getByTestId("brand-logo")).toBeInTheDocument();
  });

  it("renders h1 hero title", () => {
    renderLanding();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders hero title i18n key", () => {
    renderLanding();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("landing.hero.title");
  });

  it("renders hero highlighted text", () => {
    renderLanding();
    expect(screen.getByText("landing.hero.title_highlight")).toBeInTheDocument();
  });

  it("renders nav login link", () => {
    renderLanding();
    expect(screen.getByText("landing.nav.login")).toBeInTheDocument();
  });

  it("renders nav register link at least once", () => {
    renderLanding();
    expect(screen.getAllByText("landing.nav.register").length).toBeGreaterThanOrEqual(1);
  });

  it("renders 4 stats cards with labels", () => {
    renderLanding();
    expect(screen.getByText("landing.stats.users_label")).toBeInTheDocument();
    expect(screen.getByText("landing.stats.withdrawn_label")).toBeInTheDocument();
    expect(screen.getByText("landing.stats.uptime_label")).toBeInTheDocument();
    expect(screen.getByText("landing.stats.miners_label")).toBeInTheDocument();
  });

  it("renders How it works section title", () => {
    renderLanding();
    expect(screen.getByText("landing.how.title")).toBeInTheDocument();
  });

  it("renders 3 step titles", () => {
    renderLanding();
    expect(screen.getByText("landing.how.step1_title")).toBeInTheDocument();
    expect(screen.getByText("landing.how.step2_title")).toBeInTheDocument();
    expect(screen.getByText("landing.how.step3_title")).toBeInTheDocument();
  });

  it("renders 3 feature cards in the features grid", () => {
    renderLanding();
    for (let i = 1; i <= 3; i++) {
      expect(screen.getByText(`landing.features.f${i}_title`)).toBeInTheDocument();
    }
  });

  it("renders all feature titles", () => {
    renderLanding();
    for (let i = 1; i <= 3; i++) {
      expect(screen.getByText(`landing.features.f${i}_title`)).toBeInTheDocument();
    }
  });

  it("renders features section heading", () => {
    renderLanding();
    expect(screen.getByText("landing.features.title")).toBeInTheDocument();
  });

  it("renders FAQ section title", () => {
    renderLanding();
    expect(screen.getByText("landing.faq.title")).toBeInTheDocument();
  });

  it("renders 4 FAQ questions", () => {
    renderLanding();
    for (let i = 1; i <= 4; i++) {
      expect(screen.getByText(`landing.faq.q${i}`)).toBeInTheDocument();
    }
  });

  it("FAQ answer hidden by default, opens on click", () => {
    renderLanding();
    expect(screen.queryByText("landing.faq.a1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("landing.faq.q1").closest("button"));
    expect(screen.getByText("landing.faq.a1")).toBeInTheDocument();
  });

  it("FAQ answer closes on second click", () => {
    renderLanding();
    const btn = screen.getByText("landing.faq.q1").closest("button");
    fireEvent.click(btn);
    expect(screen.getByText("landing.faq.a1")).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText("landing.faq.a1")).not.toBeInTheDocument();
  });

  it("renders closing section title", () => {
    renderLanding();
    expect(screen.getByText("landing.closing.title")).toBeInTheDocument();
  });

  it("renders closing register button", () => {
    renderLanding();
    expect(screen.getByText("landing.closing.register")).toBeInTheDocument();
  });

  it("closing login link points to login route", () => {
    renderLanding();
    const loginLinks = screen.getAllByText("landing.closing.login");
    expect(loginLinks.some((el) => el.closest("a")?.getAttribute("href") === "/login")).toBe(true);
  });

  it("renders footer tagline", () => {
    renderLanding();
    expect(screen.getByText("landing.footer.tagline")).toBeInTheDocument();
  });

  it("redirects authenticated users (renders nothing)", () => {
    useAuthStore.mockReturnValue({ isAuthenticated: true });
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <Landing />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("sets document title on mount", () => {
    renderLanding();
    expect(document.title).toBe("landing.meta.title");
  });

  it("renders hero title_end i18n key", () => {
    renderLanding();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("landing.hero.title_end");
  });
});