<script lang="ts">
  import katex from "katex";
  import type { Expression } from "../types";

  export let expression: Expression | null = null;
  export let revealLatex = false;

  function renderLatex(latex: string): string {
    try {
      return katex.renderToString(latex, { displayMode: true, throwOnError: true });
    } catch {
      return "<span class='formula-error'>Unable to render formula.</span>";
    }
  }

  $: renderedExpression = expression ? renderLatex(expression.latex) : "";
</script>

<section class="formula-stage">
  {#if expression}
    <div class="formula-topic">{expression.topic}</div>
    <div class="formula-card">
      <div class="formula-output" aria-live="polite">
        {@html renderedExpression}
      </div>
      {#if revealLatex}
        <pre class="latex-reveal">{expression.latex}</pre>
      {/if}
    </div>
  {:else}
    <div class="formula-card empty">
      <p>No formula loaded. Press Start to begin.</p>
    </div>
  {/if}
</section>
