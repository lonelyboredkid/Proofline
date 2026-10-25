import { execSync } from "node:child_process";
const sh = (c) => execSync(c, { stdio: "inherit" });
sh("npx esbuild proofline-mockup-studio.jsx --bundle --packages=external --format=esm --outfile=studio.built.mjs --log-level=warning");
sh("npx esbuild proofline-mockup-studio.jsx --bundle --format=iife --global-name=Proofline --outfile=tests/engine.iife.js --alias:react=./tests/stubs/react.js --alias:lucide-react=./tests/stubs/lucide.js --log-level=warning");
sh("npx esbuild tests/app-entry.jsx --bundle --format=iife --outfile=tests/app.iife.js --define:process.env.NODE_ENV='\"production\"' --log-level=warning");
