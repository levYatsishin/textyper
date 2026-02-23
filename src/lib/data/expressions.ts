import { ALL_TOPIC_IDS } from "./topics";
import type { Difficulty, Expression, TopicId } from "../types";

type RawDifficulty = "easy" | "medium" | "hard";

interface RawExpression {
  latex: string;
  difficulty: RawDifficulty;
  expressionName?: string;
  isUserSubmitted?: boolean;
  submittedBy?: string;
}

const rawExpressions: RawExpression[] = [
  { latex: "E = mc^2", difficulty: "easy" },
  { latex: "a^2 + b^2 = c^2", difficulty: "easy" },
  { latex: "i = \\sqrt{-1}", difficulty: "easy" },
  { latex: "F - E + V = 2", difficulty: "easy" },
  { latex: "\\phi = \\frac{1 + \\sqrt{5}}{2}", difficulty: "easy" },
  { latex: "\\sin^2\\theta + \\cos^2\\theta = 1", difficulty: "easy" },
  { latex: "\\log(ab) = \\log a + \\log b", difficulty: "easy" },
  { latex: "c = \\pm \\sqrt{a^2 + b^2}", difficulty: "easy" },
  { latex: "\\frac{d}{dx} x^n = nx^{n-1}", difficulty: "easy" },
  { latex: "A \\subseteq B \\iff A \\cap B = A", difficulty: "easy" },
  { latex: "y = mx + b", difficulty: "easy" },
  { latex: "e^{i\\pi} + 1 = 0", difficulty: "medium" },
  { latex: "\\frac{a}{b} \\times \\frac{c}{d} = \\frac{ac}{bd}", difficulty: "easy" },
  { latex: "\\cos^2\\theta - \\sin^2\\theta = \\cos 2\\theta", difficulty: "easy" },
  { latex: "v = u + at", difficulty: "easy" },
  { latex: "s = ut + \\frac{1}{2}at^2", difficulty: "easy" },
  { latex: "\\frac{a^m}{a^n} = a^{m-n}", difficulty: "easy" },
  { latex: "P(A \\cap B) = P(A)P(B)", difficulty: "easy" },
  { latex: "\\frac{d}{dx}(uv) = u \\frac{dv}{dx} + v \\frac{du}{dx}", difficulty: "easy" },
  { latex: "\\neg ( \\forall x \\in S, P(x)) \\equiv \\exists x \\in S, ( \\neg P(x) )", difficulty: "medium" },
  { latex: "\\neg ( \\exists x \\in S, P(x)) \\equiv \\forall x \\in S, ( \\neg P(x) )", difficulty: "medium" },
  { latex: "y = e^{kt}", difficulty: "easy" },
  { latex: "\\sin 2\\theta = 2\\sin \\theta \\cos \\theta", difficulty: "easy" },
  { latex: "x \\times ( y \\times z ) + y \\times ( z \\times x ) + z \\times ( x \\times y ) = 0", difficulty: "easy" },
  { latex: "\\int_{0}^{1} \\ln x dx = -1", difficulty: "easy" },
  { latex: "\\text{Rank}(A) + \\text{Nullity}(A) = n", difficulty: "easy" },
  { latex: "\\neg (A \\vee B) \\equiv ( \\neg A ) \\wedge ( \\neg B )", difficulty: "easy" },
  { latex: "\\frac{1}{2} + \\frac{1}{3} = \\frac{5}{6}", difficulty: "medium" },
  { latex: "\\int_{0}^{1} x^n dx = \\frac{1}{n+1}", difficulty: "medium" },
  { latex: "\\int \\frac{1}{x} dx = \\ln|x| + C", difficulty: "medium" },
  { latex: "\\binom{n}{k} = \\frac{n!}{k!(n-k)!}", difficulty: "medium" },
  { latex: "F = G \\frac{m_1 m_2}{r^2}", difficulty: "medium" },
  { latex: "|A \\cup B| = |A| + |B| - |A \\cap B|", difficulty: "medium" },
  { latex: "\\sum_{k=0}^{n} \\binom{n}{k} = 2^n", difficulty: "medium" },
  { latex: "\\int e^{ax} dx = \\frac{1}{a} e^{ax} + C", difficulty: "medium" },
  { latex: "\\sin(x+y) = \\sin x \\cos y + \\cos x \\sin y", difficulty: "medium" },
  { latex: "\\cos(x+y) = \\cos x \\cos y - \\sin x \\sin y", difficulty: "medium" },
  { latex: "\\frac{d}{dx} \\sin x = \\cos x", difficulty: "medium" },
  { latex: "\\int \\sec^2 x dx = \\tan x + C", difficulty: "medium" },
  { latex: "\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1", difficulty: "medium" },
  { latex: "\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}", difficulty: "medium" },
  { latex: "\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}", difficulty: "medium" },
  { latex: "\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\epsilon_0}", difficulty: "medium" },
  { latex: "\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}", difficulty: "medium" },
  { latex: "\\neg (A \\wedge B) \\equiv ( \\neg A) \\vee (\\neg B)", difficulty: "medium" },
  { latex: "(1+x)^{n} = \\sum_{m=0}^{n} \\binom{n}{m} x^{m}", difficulty: "medium" },
  { latex: "\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s}", difficulty: "medium" },
  { latex: "\\lim_{x \\to \\infty} \\left (1 + \\frac{1}{x} \\right)^x = e", difficulty: "medium" },
  { latex: "x = r\\cos\\theta, y = r\\sin\\theta", difficulty: "medium" },
  { latex: "\\int_{0}^{\\pi} \\sin x dx = 2", difficulty: "medium" },
  { latex: "\\frac{d}{dx} \\ln x = \\frac{1}{x}", difficulty: "medium" },
  { latex: "\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}", difficulty: "medium" },
  { latex: "\\lim_{n \\to \\infty} \\frac{n^2 + 3n}{2n^2 + n} = \\frac{1}{2}", difficulty: "medium" },
  { latex: "\\int \\cos^2 x dx = \\frac{x}{2} + \\frac{1}{4} \\sin 2x + C", difficulty: "medium" },
  { latex: "\\int \\frac{1}{1+x^2}  dx = \\arctan x + C", difficulty: "medium" },
  { latex: "\\mathrm{Re}(z_1 z_2) = \\mathrm{Re}(z_1)\\mathrm{Re}(z_2) - \\mathrm{Im}(z_1)\\mathrm{Im}(z_2)", difficulty: "medium" },
  { latex: "\\oint_C \\frac{1}{z} dz = 2\\pi i", difficulty: "medium" },
  { latex: "\\det(A) = \\prod_{i=1}^n \\lambda_i", difficulty: "medium" },
  { latex: "\\nabla \\times \\nabla f = 0", difficulty: "medium" },
  { latex: "\\int_{a}^{b} f'(t) = f(b) - f(a)", difficulty: "medium" },
  { latex: "a^{p} \\equiv a \\pmod{p}", difficulty: "medium" },
  { latex: "\\int_{-\\infty}^{\\infty} \\frac{dx}{1+x^2} = \\pi", difficulty: "medium" },
  { latex: "\\oint_{|z|=1} \\frac{z^n}{z-2}  dz = 0, n \\neq -1", difficulty: "medium" },
  { latex: "\\sum_{n=1}^{\\infty} \\frac{H_n}{n^2} = \\frac{\\pi^4}{36}", difficulty: "medium" },
  { latex: "\\int_{0}^{1} \\frac{\\ln x}{1+x} dx = -\\frac{\\pi^2}{12}", difficulty: "medium" },
  { latex: "\\int_{0}^{2\\pi} \\ln|1+e^{i\\theta}| d\\theta = 0", difficulty: "medium" },
  { latex: "\\int_{0}^{\\infty} e^{-x^2} \\cos(2bx) dx = \\sqrt{\\pi} e^{-b^2}", difficulty: "medium" },
  { latex: "f(x) = \\sum_{n=1}^{\\infty} \\frac{\\sin(n x)}{n}", difficulty: "medium" },
  { latex: "\\int_{0}^{\\infty} \\frac{x^{a-1}}{1+x} dx = \\pi \\csc(a\\pi), 0 < a < 1", difficulty: "medium" },
  { latex: "\\lim_{x \\to \\infty} x \\sin\\left(\\frac{1}{x}\\right) = 1", difficulty: "medium" },
  { latex: "\\prod_{p \\text{ prime}} \\frac{1}{1-p^{-s}} = \\zeta(s)", difficulty: "medium" },
  { latex: "\\int_{0}^{\\infty} \\sin(x) e^{-ax} dx = \\frac{1}{1+a^2}", difficulty: "medium" },
  { latex: "\\int_{0}^{\\infty} \\frac{\\sin x}{x} dx = \\frac{\\pi}{2}", difficulty: "medium" },
  { latex: "\\frac{d}{dx} \\left( x^{x} \\right ) = x^{x}(\\ln x + 1)", difficulty: "medium" },
  { latex: "\\int \\frac{1}{(x-a)(x-b)} dx = \\frac{1}{a-b} \\ln \\left| \\frac{x-a}{x-b} \\right| + C", difficulty: "medium" },
  { latex: "\\nabla \\cdot (f\\mathbf{v}) = f\\nabla \\cdot \\mathbf{v} + \\mathbf{v} \\cdot \\nabla f", difficulty: "medium" },
  { latex: "\\sum_{n=1}^{\\infty} \\frac{(-1)^{n}}{n} = -\\ln 2", difficulty: "medium" },
  { latex: "\\int_{0}^{\\pi} \\ln(1 - 2a\\cos x + a^{2}) dx = 0", difficulty: "medium" },
  { latex: "\\frac{d}{dx} \\left( \\frac{u}{v} \\right ) = \\frac{u'v - uv'}{v^{2}}", difficulty: "medium" },
  { latex: "\\int x^{m}(1-x)^{n} dx = \\frac{m! n!}{(m+n+1)!}", difficulty: "medium" },
  { latex: "\\mathrm{Cov}(X,Y) = \\mathbb{E}[XY] - \\mathbb{E}[X]\\mathbb{E}[Y]", difficulty: "medium" },
  { latex: "\\int_{0}^{1} \\frac{x^{p-1}}{1+x} dx = H_{p} - \\ln 2", difficulty: "medium" },
  { latex: "\\partial_{x}(uv) = u\\partial_{x}v + v\\partial_{x}u", difficulty: "medium" },
  { latex: "f(x) = \\frac{1}{\\sqrt{2\\pi \\sigma^2}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}", difficulty: "hard" },
  { latex: "\\forall \\epsilon > 0, \\exists \\delta > 0 \\text{ such that } |x - c| < \\delta \\implies |f(x) - L| < \\epsilon", difficulty: "hard" },
  { latex: "\\oint_{\\partial \\Sigma} \\mathbf{F} \\cdot d\\mathbf{r} = \\int_{\\Sigma} \\nabla \\times \\mathbf{F} \\cdot d\\mathbf{A}", difficulty: "hard" },
  { latex: "\\frac{1}{\\Gamma(s)} \\int_{0}^{\\infty} x^{s-1} e^{-x} dx = 1", difficulty: "hard" },
  { latex: "\\int_{0}^{1} x^{m-1}(1-x)^{n-1} dx = \\frac{\\Gamma(m)\\Gamma(n)}{\\Gamma(m+n)}", difficulty: "hard" },
  { latex: "\\frac{\\partial^2 u}{\\partial x^2} + \\frac{\\partial^2 u}{\\partial y^2} = 0", difficulty: "hard" },
  { latex: "\\lim_{n \\to \\infty} n \\left( \\frac{1}{n} + \\frac{1}{n+1} + \\cdots + \\frac{1}{2n} \\right) = \\ln 2", difficulty: "hard" },
  { latex: "\\text{If } X \\sim \\text{Normal}(\\mu, \\sigma^2), \\text{ then } \\mathbb{E}[X^4] = 3\\sigma^4 + 6\\mu^2\\sigma^2 + \\mu^4.", difficulty: "hard" },
  { latex: "\\rho \\left( \\frac{\\partial \\mathbf{v}}{\\partial t} + (\\mathbf{v} \\cdot \\nabla)\\mathbf{v} \\right) = -\\nabla p + \\mu \\nabla^2 \\mathbf{v} + \\mathbf{f}", difficulty: "hard" },
  { latex: "\\zeta(2k) = (-1)^{k+1} \\frac{(2\\pi)^{2k} B_{2k}}{2(2k)!}", difficulty: "medium" },
  { latex: "\\int_{0}^{\\infty} x^{s-1} e^{-x^{2}} dx = \\frac{1}{2} \\Gamma\\left(\\frac{s}{2}\\right)", difficulty: "hard" },
  { latex: "\\nabla^{2} f = \\frac{\\partial^{2} f}{\\partial x^{2}} + \\frac{\\partial^{2} f}{\\partial y^{2}} + \\frac{\\partial^{2} f}{\\partial z^{2}}", difficulty: "hard" },
  { latex: "\\sum_{n=1}^{\\infty} \\frac{\\mu(n)}{n^{s}} = \\frac{1}{\\zeta(s)}", difficulty: "hard" },
  { latex: "\\int_{-\\infty}^{\\infty} e^{-\\pi x^{2}} e^{-2\\pi i k x} dx = e^{-\\pi k^{2}}", difficulty: "hard" },
  { latex: "\\frac{1}{2\\pi i} \\oint_{C} \\frac{f(z)}{(z-z_{0})^{n+1}} dz = \\frac{f^{(n)}(z_{0})}{n!}", difficulty: "hard" },
  { latex: "\\prod_{n=1}^{\\infty} \\left(1 + \\frac{x^{2}}{n^{2}\\pi^{2}} \\right) = \\frac{\\sinh x}{x}", difficulty: "hard" },
  { latex: "\\int_{0}^{\\infty} J_{\\nu}(ax) e^{-bx} x^{\\nu+1} dx = \\frac{a^{\\nu}}{(b^{2}+a^{2})^{\\nu+1}}", difficulty: "hard" },
  { latex: "\\int_{0}^{\\infty} x^{s-1} \\cos(ax) dx = \\Gamma(s) \\frac{\\cos(\\frac{\\pi s}{2})}{a^{s}}", difficulty: "hard" },
  { latex: "\\left( \\nabla \\times (\\nabla \\times \\mathbf{A}) \\right ) = \\nabla(\\nabla \\cdot \\mathbf{A}) - \\nabla^{2} \\mathbf{A}", difficulty: "hard" },
  { latex: "\\int_{0}^{2\\pi} \\ln|1 - re^{i\\theta}| d\\theta = 0, r < 1", difficulty: "hard" },
  { latex: "\\int_{0}^{\\infty} x^{m} e^{-\\alpha x^{2}} \\cos(\\beta x) dx = \\frac{\\Gamma(\\frac{m+1}{2})}{2\\alpha^{\\frac{m+1}{2}}} {}_{1}F_{1}\\left( \\frac{m+1}{2}; \\frac{1}{2}; -\\frac{\\beta^{2}}{4\\alpha} \\right)", difficulty: "hard" },
  { latex: "Y_{\\ell}^{m}(\\theta,\\phi) = (-1)^{m} \\sqrt{\\frac{(2\\ell+1)}{4\\pi} \\frac{(\\ell-m)!}{(\\ell+m)!}} P_{\\ell}^{m}(\\cos\\theta) e^{im\\phi}", difficulty: "hard" },
  { latex: "f(A)=\\{f(x)\\in Y:x\\in A\\}", difficulty: "medium", isUserSubmitted: true, expressionName: "Image of a function" },
  { latex: "f^{-1}(B)=\\{x\\in X:f(x)\\in B\\}", difficulty: "medium", isUserSubmitted: true, expressionName: "Preimage of a function" },
  { latex: "\\mathbb{E}[X]=\\sum xp_X(x)", difficulty: "medium", isUserSubmitted: true, expressionName: "Expectation of a discrete random variable" },
  { latex: "\\mathbb{Q}=\\left \\{\\frac{a}{b}:a,b\\in\\mathbb{Z} \\right \\}", difficulty: "medium", isUserSubmitted: true, expressionName: "Definition of Rationals" },
  { latex: "B_a(r) \\coloneqq \\{x\\in\\mathbb{R}^d:\\Vert x-a\\Vert<r\\}", difficulty: "hard", isUserSubmitted: true, expressionName: "Definition of a ball in R^d" },
  { latex: "f(x)=-\\frac{d}{dx} \\left ( \\frac{1}{x}\\frac{d}{dx} \\right )", difficulty: "medium", isUserSubmitted: true, submittedBy: "Honk Solo" },
  { latex: "\\frac{h}{2}(b_{1}+b_{2})", difficulty: "easy", isUserSubmitted: true, expressionName: "Area of trapezoid" },
  { latex: "\\pi r^{2}", difficulty: "easy", isUserSubmitted: true, expressionName: "Area of circle" },
  { latex: "\\frac{1}{3}\\pi r^{2}h", difficulty: "easy", isUserSubmitted: true, expressionName: "Volume of cone" },
  { latex: "\\frac{4}{3}\\pi r^{3}", difficulty: "easy", isUserSubmitted: true, expressionName: "Volume of sphere" },
  { latex: "\\frac{4}{3}\\pi r_{1}r_{2}r_{3}", difficulty: "easy", isUserSubmitted: true, expressionName: "Volume of ellipsoid" },
  { latex: "\\sigma(aX+b)=\\lvert a \\rvert \\sigma (X)", difficulty: "medium", isUserSubmitted: true, expressionName: "Standard deviation scaling" },
  { latex: "\\frac{d}{dt}\\left(\\frac{\\partial L}{\\partial \\dot{q}}\\right) = \\frac{\\partial L}{\\partial q}", difficulty: "hard", isUserSubmitted: true, submittedBy: "Yaoji", expressionName: "Euler Lagrange Equation" },
  { latex: "\\oint_C f(z) d z=2 \\pi i \\sum_{k=1}^n \\operatorname{Res}\\left(f, z_k\\right)", difficulty: "hard", isUserSubmitted: true, expressionName: "Residual Theorem", submittedBy: "Yaoji" },
  { latex: "0\\leq P(A)\\leq1", difficulty: "easy", isUserSubmitted: true, expressionName: "" },
  { latex: "P(\\Omega)=1", difficulty: "easy", isUserSubmitted: true, expressionName: "" },
  { latex: "P(\\emptyset)=0", difficulty: "easy", isUserSubmitted: true, expressionName: "" },
  { latex: "P(\\bar{A})=1-P(A)", difficulty: "easy", isUserSubmitted: true, expressionName: "" },
  { latex: "P(A|B)=\\frac{P(B|A)P(A)}{P(B)}", difficulty: "medium", isUserSubmitted: true, expressionName: "Bayes theorem" },
  { latex: "(f \\circ g)'(x)=g'(x) \\cdot f'(g(x))", difficulty: "medium", isUserSubmitted: true, expressionName: "Derivative of a composite function" },
  { latex: "\\tan(x)=\\frac{\\sin(x)}{\\cos(x)}", difficulty: "easy", isUserSubmitted: true, expressionName: "Tangent identity" },
  { latex: "f'(a)=\\lim\\limits_{h\\to 0}\\frac{f(a+h)-f(a)}{h}", difficulty: "hard", isUserSubmitted: true, expressionName: "Definition of the derivative" },
  { latex: "P(X = k) = C_n^k p^k (1-p)^{n-k}", difficulty: "medium", isUserSubmitted: true, expressionName: "Binomial PMF" },
  { latex: "P(X = k) = \\frac{e^{-\\lambda} \\lambda^k}{k!}", difficulty: "medium", isUserSubmitted: true, expressionName: "Poisson PMF" },
  { latex: "x=\\frac{-b\\pm \\sqrt{ b^{2}-4ac }}{2a}", difficulty: "medium", isUserSubmitted: true, expressionName: "Quadratic formula" },
  { latex: "\\sum_{n=a}^{b}u_{n}=(b-a+1) \\frac{u_{a}+u_{b}}{2}", difficulty: "medium", isUserSubmitted: true, expressionName: "Arithmetic progression sum" },
  { latex: "\\sum_{n=a}^{b}u_{n}=u_{a}\\times \\frac{1-q^{b-a+1}}{1-q}", difficulty: "medium", isUserSubmitted: true, expressionName: "Geometric progression sum" },
  { latex: "f(x)\\leq g(x)\\leq h(x) \\text{ and } \\lim_{ x \\to a }f(x)=\\lim_{ x \\to a }h(x)=l \\implies \\lim_{ x \\to a }g(x)=l", difficulty: "medium", isUserSubmitted: true, expressionName: "Squeeze Theorem" },
  { latex: "c_{ij}=\\sum_{k=1}^{n}a_{ik}\\times b_{kj}", difficulty: "medium", isUserSubmitted: true, expressionName: "Matrix multiplication rule" },
  { latex: "A^{-1}=\\frac{1}{\\det A}\\times \\begin{pmatrix}d & -b  \\\\ -c & a\\end{pmatrix}", difficulty: "medium", isUserSubmitted: true, expressionName: "Inverse of a 2x2 matrix" },
  { latex: "L(x,\\lambda)=f(x)-\\sum_{i \\in E\\cup I}\\lambda_{i}c_{i}(x)", difficulty: "medium", isUserSubmitted: true, expressionName: "Lagrange function" },
  { latex: "0=\\nabla_{x}L(x^{*},\\lambda^{*})=\\nabla f(x^{*})-\\sum \\limits_{i\\in A(x^{*})}\\lambda_{i}^{*}\\nabla c_{i}(x^{*})", difficulty: "medium", isUserSubmitted: true, expressionName: "KKT stationarity condition" },
  { latex: "c \\equiv m^e \\pmod{n}", difficulty: "medium", isUserSubmitted: true, expressionName: "RSA congruence", submittedBy: "Triode" },
  { latex: "G = \\bigsqcup_{w \\in W} BwB", difficulty: "hard", isUserSubmitted: true, expressionName: "Bruhat Decomposition" },
  { latex: "V(\\theta,t)=\\frac{1}{2}\\sum_{i=1}^{t} \\lambda^{t-i}\\lVert y(i)-\\rho^{T}(i)\\theta \\rVert ^{2}=\\dots", difficulty: "hard", isUserSubmitted: true, expressionName: "" },
  { latex: "\\varphi^{T}(t)   \\coloneqq  \\frac{ \\partial h(\\theta,t)  }{ \\partial \\theta  }  |_{\\hat{\\theta}(t-1)} = \\frac{ \\partial h(\\hat{\\theta}(t-1),t) }{ \\partial \\theta }", difficulty: "hard", isUserSubmitted: true, expressionName: "" },
  { latex: "M_{m+1}(N_{ij}) \\coloneqq M_{m}(N_{ij})-M_{m}^{*}\\exp \\{ -\\beta \\cdot d(N_{m}^{*}\\cdot N_{ij})\\}", difficulty: "hard", isUserSubmitted: true, expressionName: "" },
  { latex: "\\hat{y}=\\hat{f}(x)=\\frac{\\sum_{i=1}^{m} \\tau_{i} \\hat{y}_{i}}{\\sum_{i=1}^{m} \\tau_{i}}=\\sum_{i=1}^{m} \\tau_{i}^{*}\\hat{y}_{i}", difficulty: "hard", isUserSubmitted: true, expressionName: "" },
  { latex: "\\sum_{n=1}^{\\infty} \\frac{1}{n^s} = \\prod_{p} \\frac{1}{1 - p^{-s}}", difficulty: "medium", isUserSubmitted: true, expressionName: "Eulerian Product" },
  { latex: "\\frac{d^2 x^{\\mu}}{d\\tau^2} + \\Gamma^{\\mu}_{\\nu\\lambda} \\frac{dx^{\\nu}}{d\\tau} \\frac{dx^{\\lambda}}{d\\tau} = 0", difficulty: "hard", isUserSubmitted: true, expressionName: "Geodesic Equation" },
  { latex: "\\frac{\\partial V}{\\partial t} + \\frac{1}{2}\\sigma^2 S^2 \\frac{\\partial^2 V}{\\partial S^2} + rS \\frac{\\partial V}{\\partial S} - rV = 0", difficulty: "hard", isUserSubmitted: true, expressionName: "Black-Scholes Equation" },
  { latex: "R_{\\mu  \\nu} - \\frac{1}{2} g_{\\mu  \\nu} R = \\frac{8\\pi G}{c^4} T_{\\mu  \\nu}", difficulty: "hard", isUserSubmitted: true, expressionName: "Einstein field equations" },
  { latex: "\\frac{\\partial u}{\\partial t} + u \\frac{\\partial u}{\\partial x} + \\frac{\\partial^3 u}{\\partial x^3} = 0", difficulty: "hard", isUserSubmitted: true, expressionName: "Korteweg-de Vries Equation" },
  { latex: "\\hat{H} |\\psi\\rangle = 0", difficulty: "hard", isUserSubmitted: true, expressionName: "Wheeler-DeWitt Equation" },
  { latex: "f(a) = \\frac{1}{2\\pi i} \\oint_\\gamma \\frac{f(z)}{z-a} dz", difficulty: "medium", isUserSubmitted: true, expressionName: "Cauchy integral formula" },
  { latex: "\\text{ind}(D) = \\int_M \\hat{A}(TM) \\wedge \\text{ch}(E)", difficulty: "hard", isUserSubmitted: true, expressionName: "Atiyah-Singer Index Theorem" },
  { latex: "\\frac{\\partial f}{\\partial t} + \\mathbf{v} \\cdot \\nabla_{\\mathbf{r}} f + \\frac{\\mathbf{F}}{m} \\cdot \\nabla_{\\mathbf{v}} f = \\left(\\frac{\\partial f}{\\partial t}\\right)_{\\text{coll}}", difficulty: "hard", isUserSubmitted: true, expressionName: "Boltzmann Transport Equation" },
  { latex: "\\partial\\mu F^{\\mu  \\nu} + [A_\\mu, F^{\\mu  \\nu}] = J^\\nu", difficulty: "hard", isUserSubmitted: true, expressionName: "Yang-Mills Equations" },
  { latex: "Z = \\text{Tr} \\left( e^{-\\beta H} \\right)", difficulty: "medium", isUserSubmitted: true, expressionName: "Partition function in quantum statistical mechanics" }
];

const difficultyMap: Record<RawDifficulty, Difficulty> = {
  easy: "beginner",
  medium: "intermediate",
  hard: "advanced"
};

const inferredNames: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /^E = mc\^2$/, name: "Mass-energy equivalence" },
  { pattern: /a\^2 \+ b\^2 = c\^2/, name: "Pythagorean theorem" },
  { pattern: /\\sqrt\{-1\}/, name: "Imaginary unit definition" },
  { pattern: /F - E \+ V = 2/, name: "Euler characteristic formula" },
  { pattern: /\\phi = \\frac\{1 \+ \\sqrt\{5\}\}\{2\}/, name: "Golden ratio definition" },
  { pattern: /\\sin\^2\\theta \+ \\cos\^2\\theta = 1/, name: "Pythagorean trigonometric identity" },
  { pattern: /\\log\(ab\)/, name: "Log product rule" },
  { pattern: /^y = mx \+ b$/, name: "Slope-intercept form" },
  { pattern: /e\^\{i\\pi\} \+ 1 = 0/, name: "Euler identity" },
  { pattern: /\\cos 2\\theta/, name: "Cosine double-angle identity" },
  { pattern: /v = u \+ at/, name: "First equation of motion" },
  { pattern: /s = ut \+ \\frac\{1\}\{2\}at\^2/, name: "Second equation of motion" },
  { pattern: /\\sum_\{k=1\}\^\{n\} k/, name: "Sum of first n integers" },
  { pattern: /\\int_0\^\{1\} \\ln x/, name: "Log integral on unit interval" },
  { pattern: /\\text\{Rank\}\(A\) \+ \\text\{Nullity\}\(A\)/, name: "Rank-nullity theorem" },
  { pattern: /\\frac\{1\}\{2\} \+ \\frac\{1\}\{3\}/, name: "Fraction addition example" },
  { pattern: /\\binom\{n\}\{k\}/, name: "Binomial coefficient formula" },
  { pattern: /F = G \\frac\{m_1 m_2\}\{r\^2\}/, name: "Newton law of gravitation" },
  { pattern: /\\nabla \\cdot \\mathbf\{E\}/, name: "Gauss law (electrostatics)" },
  { pattern: /\\oint_C \\frac\{1\}\{z\} dz = 2\\pi i/, name: "Cauchy integral over 1/z" },
  { pattern: /\\det\(A\) = \\prod_\{i=1\}\^n \\lambda_i/, name: "Determinant-eigenvalue product" },
  { pattern: /\\nabla \\times \\nabla f = 0/, name: "Curl of gradient identity" },
  { pattern: /\\frac\{d\}\{dx\} \\left\( x\^\{x\} \\right \)/, name: "Derivative of x^x" },
  { pattern: /\\sum_\{n=1\}\^\{\\infty\} \\frac\{\(-1\)\^\{n\}\}\{n\} = -\\ln 2/, name: "Alternating harmonic series" },
  { pattern: /\\mathrm\{Cov\}\(X,Y\)/, name: "Covariance identity" },
  { pattern: /\\partial_\{x\}\(uv\)/, name: "Partial product rule" },
  { pattern: /\\frac\{1\}\{\\sqrt\{2\\pi \\sigma\^2\}\}/, name: "Normal distribution density" },
  { pattern: /\\forall \\epsilon > 0, \\exists \\delta > 0/, name: "Epsilon-delta limit definition" },
  { pattern: /\\Gamma\(s\)/, name: "Gamma integral identity" },
  { pattern: /\\frac\{\\partial\^2 u\}\{\\partial x\^2\} \+ \\frac\{\\partial\^2 u\}\{\\partial y\^2\}/, name: "Laplace equation" },
  { pattern: /\\text\{If \} X \\sim \\text\{Normal\}/, name: "Fourth moment of normal distribution" },
  { pattern: /\\rho \\left\( \\frac\{\\partial \\mathbf\{v\}\}\{\\partial t\}/, name: "Navier-Stokes momentum equation" },
  { pattern: /\\sum_\{n=1\}\^\{\\infty\} \\frac\{\\mu\(n\)\}\{n\^\{s\}\}/, name: "Möbius-zeta identity" },
  { pattern: /\\frac\{1\}\{2\\pi i\} \\oint_\{C\}/, name: "General Cauchy differentiation formula" },
  { pattern: /\\frac\{\\sinh x\}\{x\}/, name: "Infinite product for sinh(x)/x" },
  { pattern: /Y_\{\\ell\}\^\{m\}/, name: "Spherical harmonics" },
  { pattern: /^0\\leq P\(A\)\\leq1$/, name: "Probability bounds axiom" },
  { pattern: /^P\(\\Omega\)=1$/, name: "Probability of sample space" },
  { pattern: /^P\(\\emptyset\)=0$/, name: "Probability of empty set" },
  { pattern: /^P\(\\bar\{A\}\)=1-P\(A\)$/, name: "Complement probability rule" },
  { pattern: /V\(\\theta,t\)=\\frac\{1\}\{2\}\\sum/, name: "Exponentially weighted least squares cost" },
  { pattern: /\\varphi\^\{T\}\(t\)/, name: "Jacobian linearization vector" },
  { pattern: /M_\{m\+1\}\(N_\{ij\}\)/, name: "Neighborhood update rule" },
  { pattern: /\\hat\{y\}=\\hat\{f\}\(x\)=\\frac\{\\sum_\{i=1\}\^\{m\} \\tau_\{i\} \\hat\{y\}_\{i\}\}/, name: "Weighted prediction aggregation" }
];

const manualTopicOverrides: Array<{ pattern: RegExp; topics: TopicId[] }> = [
  { pattern: /\\sin|\\cos|\\tan/, topics: ["trigonometry"] },
  { pattern: /\\int|\\frac\{d\}\{dx\}|\\lim/, topics: ["calculus"] },
  { pattern: /\\partial|\\dot\{q\}|\\nabla\^2 u/, topics: ["differential-equations"] },
  { pattern: /\\nabla|\\mathbf\{|\\times|\\cdot/, topics: ["vector-calculus"] },
  { pattern: /\\det|\\lambda|\\text\{Rank\}|\\text\{Nullity\}|\\begin\{pmatrix\}|c_\{ij\}|A\^\{-1\}/, topics: ["linear-algebra"] },
  { pattern: /P\(|\\mathbb\{E\}|\\mathrm\{Cov\}|\\sigma\(|X \\sim/, topics: ["probability", "statistics"] },
  { pattern: /\\subseteq|\\forall|\\exists|\\neg|\\iff|\\emptyset|\\Omega|\\wedge|\\vee/, topics: ["set-logic"] },
  { pattern: /\\zeta|\\mu\(n\)|\\pmod|prime|a\^\{p\}|\\sum_\{n=1\}\^\{\\infty\} \\frac\{1\}\{n\^s\}/, topics: ["number-theory"] },
  { pattern: /\\Gamma|J_\{\\nu\}|Y_\{\\ell\}\^\{m\}|\\sinh|\\csc|F_\{1\}/, topics: ["special-functions"] },
  { pattern: /\\oint|\\mathrm\{Re\}|\\mathrm\{Im\}|i\\theta|z\}|\\operatorname\{Res\}|\\oint_\{\\|z\\|=1\}/, topics: ["complex-analysis"] },
  { pattern: /mc\^2|\\epsilon_0|Navier|Boltzmann|Einstein|Yang-Mills|Black-Scholes|Wheeler-DeWitt|\\hat\{H\}/, topics: ["mathematical-physics"] },
  { pattern: /\\pi r\^\{2\}|cone|sphere|ellipsoid|B_a\(r\)|Pythagorean/, topics: ["geometry"] },
  { pattern: /L\(x,\\lambda\)|KKT|Lagrange|\\lambda\^\{t-i\}/, topics: ["optimization"] }
];

const topicByDifficulty: Record<RawDifficulty, TopicId> = {
  easy: "algebra",
  medium: "calculus",
  hard: "mathematical-physics"
};

function inferName(entry: RawExpression, index: number): string {
  if (entry.expressionName && entry.expressionName.trim().length > 0) {
    return entry.expressionName.trim();
  }

  const matched = inferredNames.find((rule) => rule.pattern.test(entry.latex));
  if (matched) {
    return matched.name;
  }

  if (entry.latex.includes("\\int")) {
    return "Integral formula";
  }
  if (entry.latex.includes("\\sum")) {
    return "Series formula";
  }
  if (entry.latex.includes("\\lim")) {
    return "Limit identity";
  }
  if (entry.latex.includes("\\nabla") || entry.latex.includes("\\partial")) {
    return "Vector calculus relation";
  }
  if (entry.latex.includes("\\frac{d}{dx}") || entry.latex.includes("f'(x)") || entry.latex.includes("f'(a)")) {
    return "Derivative formula";
  }
  if (entry.latex.includes("\\Gamma") || entry.latex.includes("\\zeta")) {
    return "Special function identity";
  }
  if (entry.latex.includes("\\det") || entry.latex.includes("\\lambda")) {
    return "Linear algebra relation";
  }
  if (entry.latex.includes("\\Pr") || entry.latex.includes("P(") || entry.latex.includes("\\mathbb{E}")) {
    return "Probability identity";
  }

  return entry.isUserSubmitted ? `User submitted formula ${index + 1}` : `Math formula ${index + 1}`;
}

function inferTopics(entry: RawExpression): TopicId[] {
  const topics = new Set<TopicId>();

  for (const rule of manualTopicOverrides) {
    if (rule.pattern.test(entry.latex)) {
      for (const topic of rule.topics) {
        topics.add(topic);
      }
    }
  }

  if (entry.latex.includes("\\sum") || entry.latex.includes("\\prod")) {
    topics.add("algebra");
  }

  if (entry.latex.includes("\\phi") || entry.latex.includes("\\sqrt{5}")) {
    topics.add("number-theory");
  }

  if (entry.latex.includes("\\sin") || entry.latex.includes("\\cos") || entry.latex.includes("\\tan")) {
    topics.add("trigonometry");
  }

  if (entry.latex.includes("\\int") || entry.latex.includes("\\lim") || entry.latex.includes("\\frac{d}{dx}")) {
    topics.add("calculus");
  }

  if (entry.latex.includes("\\partial") || entry.latex.includes("\\nabla^2") || entry.latex.includes("\\frac{\\partial")) {
    topics.add("differential-equations");
  }

  if (entry.latex.includes("\\nabla") || entry.latex.includes("\\mathbf{")) {
    topics.add("vector-calculus");
  }

  if (entry.latex.includes("\\det") || entry.latex.includes("\\lambda") || entry.latex.includes("\\text{Rank}")) {
    topics.add("linear-algebra");
  }

  if (entry.latex.includes("P(") || entry.latex.includes("\\mathbb{E}") || entry.latex.includes("\\mathrm{Cov}")) {
    topics.add("probability");
  }

  if (entry.latex.includes("\\sigma") || entry.latex.includes("X \\sim")) {
    topics.add("statistics");
  }

  if (entry.latex.includes("\\pmod") || entry.latex.includes("\\zeta") || entry.latex.includes("prime")) {
    topics.add("number-theory");
  }

  if (
    entry.latex.includes("\\subseteq") ||
    entry.latex.includes("\\forall") ||
    entry.latex.includes("\\exists") ||
    entry.latex.includes("\\neg")
  ) {
    topics.add("set-logic");
  }

  if (entry.latex.includes("\\Gamma") || entry.latex.includes("J_{\\nu}") || entry.latex.includes("Y_{\\ell}^{m}")) {
    topics.add("special-functions");
  }

  if (
    entry.latex.includes("\\oint") ||
    entry.latex.includes("\\mathrm{Re}") ||
    entry.latex.includes("\\mathrm{Im}") ||
    entry.latex.includes("\\operatorname{Res}")
  ) {
    topics.add("complex-analysis");
  }

  if (
    entry.latex.includes("mc^2") ||
    entry.latex.includes("\\epsilon_0") ||
    entry.latex.includes("\\hat{H}") ||
    entry.latex.includes("R_{\\mu") ||
    entry.latex.includes("\\rho \\left")
  ) {
    topics.add("mathematical-physics");
  }

  if (entry.latex.includes("\\pi r") || entry.latex.includes("B_a(r)") || entry.latex.includes("a^2 + b^2 = c^2")) {
    topics.add("geometry");
  }

  if (entry.latex.includes("L(x,\\lambda)") || entry.latex.includes("\\nabla_{x}L") || entry.latex.includes("\\lambda^{t-i}")) {
    topics.add("optimization");
  }

  if (topics.size === 0) {
    topics.add(topicByDifficulty[entry.difficulty]);
  }

  const normalized = ALL_TOPIC_IDS.filter((topic) => topics.has(topic));
  return normalized.length > 0 ? normalized : ["algebra"];
}

export const EXPRESSIONS: Expression[] = rawExpressions.map((entry, index) => ({
  id: `expr-${String(index + 1).padStart(3, "0")}`,
  latex: entry.latex,
  difficulty: difficultyMap[entry.difficulty],
  name: inferName(entry, index),
  topics: inferTopics(entry)
}));
