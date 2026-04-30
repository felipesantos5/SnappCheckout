import { Route, Routes } from "react-router-dom";
import { MemoryRouter } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CheckoutSlugPage } from "../CheckoutSlugPage";
import { createOffer } from "../../test/fixtures/offers";
import { jsonResponse } from "../../test/testUtils";

const fetchCalls = () => vi.mocked(fetch).mock.calls.map(([url, init]) => ({ url: String(url), init }));

beforeEach(() => {
  global.fetch = vi.fn(async (input) => {
    const url = String(input);

    if (url.includes("ipapi.co")) {
      return jsonResponse({ country_code: "US" });
    }

    if (url.includes("/abtests/slug/ebook-avancado")) {
      return jsonResponse({ message: "not found" }, { status: 404 });
    }

    if (url.includes("/offers/slug/ebook-avancado")) {
      return jsonResponse(createOffer({ layoutType: "classic", language: "pt" }));
    }

    if (url.includes("/paypal/client-id")) {
      return jsonResponse({ clientId: "paypal_client_test" });
    }

    if (url.includes("api.ipify.org")) {
      return jsonResponse({ ip: "203.0.113.10" });
    }

    return jsonResponse({});
  }) as typeof fetch;
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/ebook-avancado"]}>
      <Routes>
        <Route path="/:slug" element={<CheckoutSlugPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("CheckoutSlugPage", () => {
  it("usa idioma detectado pelo IP do cliente acima do idioma da oferta", async () => {
    renderPage();

    expect(await screen.findByText(/personal information/i, {}, { timeout: 5000 })).toBeVisible();
    expect(screen.getByText(/payment method/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /complete payment/i })).toBeDisabled();
  });

  it("injeta Facebook Pixel e dispara PageView, InitiateCheckout e CAPI", async () => {
    renderPage();

    await screen.findByText(/personal information/i);

    await waitFor(() => {
      const fbq = window.fbq as any;
      const queue = fbq?.queue.map((entry: IArguments) => Array.from(entry));
      expect(queue).toEqual(
        expect.arrayContaining([
          ["init", "222222222222222"],
          ["init", "111111111111111"],
          ["track", "PageView"],
          [
            "track",
            "InitiateCheckout",
            expect.objectContaining({
              content_name: "Ebook Dominando Checkout",
              content_ids: ["prod_main"],
              content_type: "product",
              value: 49.9,
              currency: "BRL",
              num_items: 1,
            }),
            expect.objectContaining({ eventID: expect.stringContaining("_initiate_checkout") }),
          ],
        ]),
      );
    });

    const capiCall = fetchCalls().find(({ url }) => url.includes("/metrics/facebook-initiate-checkout"));
    expect(capiCall).toBeTruthy();
    expect(JSON.parse(String(capiCall?.init?.body))).toMatchObject({
      offerId: "offer_test_123",
      totalAmount: 4990,
      contentIds: ["prod_main"],
    });
  });

  it("registra view unica e view total quando a oferta carrega", async () => {
    renderPage();

    await screen.findByText(/personal information/i);

    await waitFor(() => {
      const metricBodies = fetchCalls()
        .filter(({ url }) => url.includes("/metrics/track"))
        .map(({ init }) => JSON.parse(String(init?.body)));

      expect(metricBodies).toEqual(
        expect.arrayContaining([
          { offerId: "offer_test_123", type: "view" },
          { offerId: "offer_test_123", type: "view_total" },
        ]),
      );
    });
  });
});
