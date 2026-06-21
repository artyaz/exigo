import type { IPaymentProvider } from "./types";
import { PaddleProvider } from "./providers/paddle";

let _provider: IPaymentProvider | null = null;

export function getPaymentProvider(): IPaymentProvider {
  _provider ??= new PaddleProvider();
  return _provider;
}

export type { IPaymentProvider, CheckoutResult } from "./types";
