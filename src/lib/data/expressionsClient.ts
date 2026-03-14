import formulasPayloadUrl from "./formulas.v1.json?url";
import { loadExpressionsFromJson } from "./expressionsLoader";
import type { Expression, ExpressionsJsonPayload } from "../types";

let expressionsPromise: Promise<Expression[]> | null = null;

async function fetchExpressionsPayload(): Promise<ExpressionsJsonPayload> {
  const response = await fetch(formulasPayloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to load formulas payload: ${response.status}`);
  }
  return response.json() as Promise<ExpressionsJsonPayload>;
}

export function loadExpressionsClient(): Promise<Expression[]> {
  if (!expressionsPromise) {
    expressionsPromise = fetchExpressionsPayload().then((payload) => loadExpressionsFromJson(payload));
  }
  return expressionsPromise;
}
