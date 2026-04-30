import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

const stripeMocks = vi.hoisted(() => {
  const paymentRequestMock = {
    canMakePayment: vi.fn(() => Promise.resolve(null)),
    on: vi.fn(),
    update: vi.fn(),
  };

  const stripeMock = {
    paymentRequest: vi.fn(() => paymentRequestMock),
    confirmCardPayment: vi.fn(() =>
      Promise.resolve({
        paymentIntent: { id: "pi_test_checkout", status: "succeeded" },
      }),
    ),
  };

  const elementsMock = {
    getElement: vi.fn(() => ({ id: "card-element-test-double" })),
  };

  return { elementsMock, paymentRequestMock, stripeMock };
});

export const { elementsMock, paymentRequestMock, stripeMock } = stripeMocks;

beforeEach(() => {
  if (!document.getElementsByTagName("script")[0]) {
    document.head.appendChild(document.createElement("script"));
  }
});

vi.mock("@stripe/stripe-js", () => ({
  loadStripe: vi.fn(() => Promise.resolve(stripeMock)),
}));

vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useStripe: () => stripeMock,
  useElements: () => elementsMock,
  CardNumberElement: ({ id }: { id?: string }) => <input id={id} data-testid="stripe-card-number" aria-label="Stripe card number" />,
  CardExpiryElement: ({ id }: { id?: string }) => <input id={id} data-testid="stripe-card-expiry" aria-label="Stripe card expiry" />,
  CardCvcElement: ({ id }: { id?: string }) => <input id={id} data-testid="stripe-card-cvc" aria-label="Stripe card cvc" />,
  PaymentRequestButtonElement: () => <button type="button">Digital wallet</button>,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  document.body.innerHTML = "";
  delete (window as any).fbq;
  delete (window as any)._fbq;
  delete (window as any).paypal;
  sessionStorage.clear();
});
