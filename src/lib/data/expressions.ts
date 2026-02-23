import formulasPayload from "./formulas.v1.json";
import { loadExpressionsFromJson } from "./expressionsLoader";

export const EXPRESSIONS = loadExpressionsFromJson(formulasPayload);
