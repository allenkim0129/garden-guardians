import { spawn } from "node:child_process";
import { once } from "node:events";

export async function isolatedServer(base = "/") {
  const child = spawn(process.execPath, ["scripts/server.mjs", "--port", "0", "--base", base], { stdio: ["ignore", "pipe", "pipe"] });
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error("검증용 서버 시작 시간 초과")); }, 10000);
    child.stdout.on("data", data => {
      const match = String(data).match(/http:\/\/[^\s]+/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.stderr.on("data", data => { clearTimeout(timer); reject(new Error(String(data))); });
  });
  return {
    url,
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = once(child, "exit");
      child.kill();
      await exited;
    },
  };
}
