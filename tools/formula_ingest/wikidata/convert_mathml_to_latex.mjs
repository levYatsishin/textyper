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

function toLatex(formula) {
  if (typeof formula !== "string") {
    return "";
  }

  const value = formula.trim();
  if (!value) {
    return "";
  }

  if (!value.toLowerCase().includes("<math")) {
    return value;
  }

  try {
    return MathMLToLaTeX.convert(value).trim();
  } catch {
    return "";
  }
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
