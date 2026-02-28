import { MathMLToLaTeX } from "mathml-to-latex";

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", (error) => reject(error));
  });
}

function normalizeLatex(input) {
  let out = input;

  out = out.replace(/\\left\./g, "");
  out = out.replace(/\\right\./g, "");
  out = out.replace(/\\left/g, "");
  out = out.replace(/\\right/g, "");

  out = out.replace(/\\text\{([^{}]*)\}/g, "\\mathrm{$1}");
  out = out.replace(/\\Longrightarrow/g, "\\iff");

  // Normalize differentials: "d z" -> "\, dz".
  out = out.replace(/(^|[^\w\\])d\s+([A-Za-z])/g, "$1\\, d$2");

  out = out.replace(/\}\s+\(/g, "}(");
  out = out.replace(/\(\s+/g, "(");
  out = out.replace(/\s+\)/g, ")");
  out = out.replace(/\s+,/g, ",");
  out = out.replace(/,\s*/g, ", ");
  out = out.replace(/\s*:\s*/g, " : ");
  out = out.replace(/\s+/g, " ");

  return out.trim();
}

function toLatex(formula) {
  if (typeof formula !== "string") {
    return "";
  }

  const value = formula.trim();
  if (!value) {
    return "";
  }

  let latex = value;
  if (value.toLowerCase().includes("<math")) {
    try {
      latex = MathMLToLaTeX.convert(value).trim();
    } catch {
      return "";
    }
  }

  return normalizeLatex(latex);
}

async function main() {
  const raw = await readStdin();

  let formulas;
  try {
    formulas = JSON.parse(raw);
  } catch {
    process.stderr.write("Invalid JSON input. Expected an array of formula strings.\n");
    process.exit(1);
  }

  if (!Array.isArray(formulas)) {
    process.stderr.write("Invalid JSON input. Expected an array.\n");
    process.exit(1);
  }

  const converted = formulas.map((formula) => toLatex(formula));
  process.stdout.write(JSON.stringify(converted));
}

main().catch((error) => {
  process.stderr.write(`Conversion process failed: ${String(error)}\n`);
  process.exit(1);
});
