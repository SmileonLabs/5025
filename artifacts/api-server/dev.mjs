import { spawn } from "node:child_process";

const env = { ...process.env, NODE_ENV: "development" };
const executable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawn(executable, ["run", "build"], {
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code) => {
  if (code !== 0) process.exit(code ?? 1);
  const server = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
    env,
    stdio: "inherit",
  });
  server.on("exit", (serverCode) => process.exit(serverCode ?? 0));
});
