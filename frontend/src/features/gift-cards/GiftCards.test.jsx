import { act } from "react";
import { createRoot } from "react-dom/client";
import { GiftCardsProvider, GiftCardPurchase, GiftCardView, GiftCardsAdmin } from "./index";

let container, root;
const card = { code: "CADEAU-TEST-TEST", type: "montant", amount: 100, balance: 100,
  recipient_name: "Alice", buyer_name: "Bob", expires: "2027-11-11", status: "active", email_sent: false };

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.restoreAllMocks();
});

function api(overrides = {}) {
  return { get: jest.fn(async () => ({ data: { transfer: false } })), post: jest.fn(), patch: jest.fn(), delete: jest.fn(), ...overrides };
}

async function render(component, config = {}) {
  await act(async () => root.render(<GiftCardsProvider config={{ api: api(), ...config }}>{component}</GiftCardsProvider>));
}

test("another brand, currency and expiry can be rendered without the host site", async () => {
  await render(<GiftCardView g={card} />, { brandName: "Autre projet", currency: "USD", locale: "en-US" });
  expect(container.textContent).toContain("Autre projet");
  expect(container.textContent).toContain("$100.00");
  expect(container.textContent).toContain("November");
  expect(container.textContent).not.toContain("La Cabane du Chêne");
});

test("stay cards clearly display a monetary credit", async () => {
  await render(<GiftCardView g={{ ...card, type: "sejour", nights: 2, amount: 305 }} />);
  expect(container.textContent).toContain("Crédit séjour");
  expect(container.textContent).toContain("Complément éventuel");
});

test("confirmation does not promise an e-mail if sending failed", async () => {
  const transport = api({ get: jest.fn(async () => ({ data: card })) });
  await render(<GiftCardPurchase sessionId="cs_test" />, { api: transport });
  expect(container.querySelector('[data-testid="gift-success"]')).not.toBeNull();
  expect(container.textContent).toContain("L’envoi par e-mail n’est pas confirmé");
  expect(container.textContent).not.toContain("La carte a été envoyée");
});

test("confirmed e-mail uses the successful message", async () => {
  await render(<GiftCardPurchase sessionId="cs_test" />, { api: api({ get: jest.fn(async () => ({ data: { ...card, email_sent: true } })) }) });
  expect(container.textContent).toContain("La carte a été envoyée");
});

test("a refunded card cannot display a purchase-success message", async () => {
  await render(<GiftCardPurchase sessionId="cs_test" />, { api: api({ get: jest.fn(async () => ({ data: { ...card, status: "annulee" } })) }) });
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.querySelector('[data-testid="gift-success"]')).toBeNull();
});

test("a response after unmount does not start another poll", async () => {
  let resolve;
  const transport = api({ get: jest.fn(() => new Promise((r) => { resolve = r; })) });
  await render(<GiftCardPurchase sessionId="cs_test" />, { api: transport });
  await act(async () => root.render(null));
  const timer = jest.spyOn(global, "setTimeout");
  await act(async () => resolve({ data: { status: "en_attente" } }));
  expect(timer).not.toHaveBeenCalled();
});

test("an admin loading error is visible rather than shown as an empty list", async () => {
  await render(<GiftCardsAdmin />, { api: api({ get: jest.fn(async () => { throw new Error("offline"); }) }) });
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.textContent).toContain("Réessayer");
  expect(container.textContent).not.toContain("Aucune carte cadeau");
});

test("activated cards have no delete button", async () => {
  await render(<GiftCardsAdmin />, { api: api({ get: jest.fn(async () => ({ data: [{ ...card, id: "paid", uses: [] }] })) }) });
  expect(container.querySelector('[data-testid="gift-delete-CADEAU-TEST-TEST"]')).toBeNull();
});

test("refunded cards show review information and cannot be reactivated in the UI", async () => {
  await render(<GiftCardsAdmin />, { api: api({ get: jest.fn(async () => ({ data: [{ ...card, id: "refund", refund_received: true, status: "annulee" }] })) }) });
  expect(container.textContent).toContain("Remboursement Stripe détecté");
  expect(container.textContent).not.toContain("Réactiver");
  expect(container.textContent).not.toContain("Corriger le solde");
});

