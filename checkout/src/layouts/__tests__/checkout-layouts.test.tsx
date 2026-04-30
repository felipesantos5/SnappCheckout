import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { loadStripe } from "@stripe/stripe-js";

import ClassicLayout from "../classic/ClassicLayout";
import HublaLayout from "../hubla/HublaLayout";
import { createOffer } from "../../test/fixtures/offers";
import { jsonResponse, renderCheckout } from "../../test/testUtils";
import { stripeMock } from "../../test/setup";

const renderClassic = () =>
  renderCheckout(
    <ClassicLayout
      offerData={createOffer({ layoutType: "classic" })}
      checkoutSessionId="session_test"
      generateEventId={() => "event_test"}
      abTestId="ab_test"
    />,
  );

const renderHubla = () =>
  renderCheckout(
    <HublaLayout
      offerData={createOffer({ layoutType: "hubla" })}
      checkoutSessionId="session_test"
      generateEventId={() => "event_test"}
      abTestId="ab_test"
    />,
  );

const paymentIntentCalls = () =>
  vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes("/payments/create-intent"));

const metricCalls = () =>
  vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes("/metrics/track"));

const input = (id: string) => document.getElementById(id) as HTMLInputElement;

beforeEach(() => {
  window.history.pushState({}, "", "/");
  global.fetch = vi.fn(async (input) => {
    const url = String(input);

    if (url.includes("/paypal/client-id")) {
      return jsonResponse({ clientId: "paypal_client_test" });
    }

    if (url.includes("/coupons/validate")) {
      return jsonResponse({ valid: true, discountPercent: 10 });
    }

    if (url.includes("/payments/create-intent")) {
      return jsonResponse({ clientSecret: "cs_test_checkout" });
    }

    if (url.includes("api.ipify.org")) {
      return jsonResponse({ ip: "203.0.113.10" });
    }

    return jsonResponse({});
  }) as typeof fetch;
});

describe("Layout Classic - Renderizacao e Pagamento", () => {
  it("preenche o email quando ele vem pela URL", async () => {
    window.history.pushState({}, "", "/ebook-avancado?email=barbeiro%40teste.com");
    renderClassic();

    expect(await screen.findByLabelText(/e-mail/i)).toHaveValue("barbeiro@teste.com");
  });

  it("renderiza campos, metodos de pagamento, PayPal e order bump sem crashar", async () => {
    renderClassic();

    expect(await screen.findByLabelText(/e-mail/i)).toBeVisible();
    expect(screen.getByLabelText(/nome completo/i)).toBeVisible();
    expect(screen.getByLabelText(/celular/i)).toBeVisible();
    expect(screen.getByLabelText(/cpf/i)).toBeVisible();
    expect(screen.getByText(/m[eé]todo de pagamento/i)).toBeVisible();
    expect(screen.getByText(/cart[aã]o de cr[eé]dito/i)).toBeVisible();
    expect(screen.getByText("PayPal")).toBeVisible();
    expect((await screen.findAllByText(/adicione o checklist/i, {}, { timeout: 5000 }))[0]).toBeVisible();
    expect(screen.getByRole("button", { name: /concluir pagamento/i })).toBeEnabled();

    expect(loadStripe).toHaveBeenCalledWith("pk_test_checkout", {
      stripeAccount: "acct_test_checkout",
    });
  });

  it("atualiza o total quando order bump e selecionado", async () => {
    const user = userEvent.setup();
    renderClassic();

    expect(await screen.findByText(/concluir pagamento - r\$\s*49,90/i)).toBeVisible();
    await screen.findAllByText(/adicione o checklist/i);

    await user.click(screen.getAllByRole("checkbox")[0]);

    expect(await screen.findByText(/concluir pagamento - r\$\s*69,80/i)).toBeVisible();
  });

  it("dispara carrinho abandonado quando o cliente informa email", async () => {
    renderClassic();

    fireEvent.change(await screen.findByLabelText(/e-mail/i), {
      target: { value: "cliente@example.com" },
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/offers/checkout-started"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ offerId: "offer_test_123" }),
        }),
      );
    });

    await waitFor(() => {
      const initiateCheckout = metricCalls().find(([, init]) => {
        const body = JSON.parse(String(init?.body));
        return body.type === "initiate_checkout" && body.email === "cliente@example.com" && body.language === "pt";
      });

      expect(initiateCheckout).toBeTruthy();
    });
  });

  it("envia pagamento por cartao com dados do cliente, UTM e order bump selecionado", async () => {
    const user = userEvent.setup();
    renderClassic();

    await user.type(await screen.findByLabelText(/e-mail/i), "cliente@example.com");
    await user.type(screen.getByLabelText(/nome completo/i), "Cliente Teste");
    await user.type(screen.getByLabelText(/celular/i), "11999999999");
    await user.type(screen.getByLabelText(/cpf/i), "12345678901");
    await user.type(screen.getByLabelText(/cep/i), "01001000");
    await user.type(input("address-street"), "Rua Teste");
    await user.type(input("address-number"), "123");
    await user.type(input("address-neighborhood"), "Centro");
    await user.type(input("address-city"), "Sao Paulo");
    await user.type(input("address-state"), "SP");
    await user.type(screen.getByLabelText(/titular do cart[aã]o/i), "Cliente Teste");
    await screen.findAllByText(/adicione o checklist/i);
    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: /concluir pagamento/i }));

    await waitFor(() => expect(stripeMock.confirmCardPayment).toHaveBeenCalled());

    const [, init] = paymentIntentCalls()[0];
    const payload = JSON.parse(String(init?.body));

    expect(payload).toMatchObject({
      offerSlug: "ebook-avancado",
      selectedOrderBumps: ["bump_checklist"],
      contactInfo: {
        email: "cliente@example.com",
        name: "Cliente Teste",
      },
      metadata: {
        ip: "203.0.113.10",
        abTestId: "ab_test",
        purchaseEventId: "session_test_purchase",
      },
    });
  });
});

describe("Layout Hubla - Renderizacao e Pagamento", () => {
  it("preenche o email quando ele vem pela URL", async () => {
    window.history.pushState({}, "", "/ebook-avancado?email=barbeiro%40teste.com");
    renderHubla();

    await screen.findByRole("button", { name: /concluir pagamento/i });
    expect(input("email")).toHaveValue("barbeiro@teste.com");
  });

  it("renderiza campos compactos, cartao, PayPal e botao de compra", async () => {
    renderHubla();

    await screen.findByRole("button", { name: /concluir pagamento/i });
    expect(input("name")).toBeVisible();
    expect(input("email")).toBeVisible();
    expect(input("phone")).toBeVisible();
    expect(screen.getByText(/cart[aã]o de cr[eé]dito/i)).toBeVisible();
    expect(await screen.findByText("PayPal")).toBeVisible();
    expect(screen.getByTestId("stripe-card-number")).toBeVisible();
    expect(screen.getByTestId("stripe-card-expiry")).toBeVisible();
    expect(screen.getByTestId("stripe-card-cvc")).toBeVisible();
    expect(screen.getByRole("button", { name: /concluir pagamento/i })).toBeEnabled();
  });

  it("calcula total com order bump e cupom aplicado", async () => {
    const user = userEvent.setup();
    renderHubla();

    expect(await screen.findByRole("button", { name: /concluir pagamento - r\$\s*49,90/i })).toBeVisible();

    await user.click(screen.getAllByText(/checklist de lancamento/i)[0]);
    expect(await screen.findByRole("button", { name: /concluir pagamento - r\$\s*69,80/i })).toBeVisible();

    const summary = screen.getByText("Ebook Dominando Checkout").closest("div");
    const expandButton = within(summary!).getByRole("button");
    await user.click(expandButton);

    await user.type(await screen.findByPlaceholderText(/cupom/i), "PROMO10");
    await user.click(screen.getByRole("button", { name: /aplicar/i }));

    expect(await screen.findByText(/cupom aplicado/i)).toBeVisible();
    expect(await screen.findByRole("button", { name: /concluir pagamento - r\$\s*62,82/i })).toBeVisible();

    const [, init] = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes("/coupons/validate"))!;
    expect(JSON.parse(String(init?.body))).toEqual({
      offerSlug: "ebook-avancado",
      code: "PROMO10",
    });
  });

  it("envia pagamento com cupom e dispara AddPaymentInfo no Facebook Pixel", async () => {
    const user = userEvent.setup();
    window.fbq = vi.fn();

    renderHubla();

    await screen.findByRole("button", { name: /concluir pagamento/i });
    await user.type(input("name"), "Cliente Teste");
    await user.type(input("email"), "cliente@example.com");
    await user.type(input("phone"), "11999999999");
    await user.type(input("hubla-card-name"), "Cliente Teste");
    await user.type(input("document"), "12345678901");

    const summary = screen.getAllByText("Ebook Dominando Checkout")[0].closest("div");
    await user.click(within(summary!).getByRole("button"));
    await user.type(await screen.findByPlaceholderText(/cupom/i), "PROMO10");
    await user.click(screen.getByRole("button", { name: /aplicar/i }));

    await user.click(await screen.findByRole("button", { name: /concluir pagamento - r\$\s*44,91/i }));

    await waitFor(() => expect(stripeMock.confirmCardPayment).toHaveBeenCalled());
    expect(window.fbq).toHaveBeenCalledWith(
      "track",
      "AddPaymentInfo",
      expect.objectContaining({
        content_name: "Ebook Dominando Checkout",
        value: 44.91,
        currency: "BRL",
      }),
      { eventID: "session_test_add_payment_info" },
    );

    const [, init] = paymentIntentCalls()[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      couponCode: "PROMO10",
      contactInfo: {
        email: "cliente@example.com",
        name: "Cliente Teste",
      },
    });
  });
});
