import "./app.css";
import "katex/dist/katex.min.css";
import App from "./App.svelte";
import { loadExpressionsClient } from "./lib/data/expressionsClient";
import { mount } from "svelte";

const target = document.getElementById("app");

if (!target) {
  throw new Error("App mount target was not found.");
}

const mountTarget = target;
let app;

async function bootstrap(): Promise<void> {
  try {
    const expressions = await loadExpressionsClient();
    app = mount(App, {
      target: mountTarget,
      props: {
        expressions
      }
    });
  } catch (error) {
    console.error("Failed to bootstrap app", error);
    mountTarget.textContent = "Failed to load app data. Please reload.";
  }
}

void bootstrap();

export default app;
