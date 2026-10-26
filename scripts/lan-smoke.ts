import assert from "node:assert/strict";
import { createServer } from "node:http";
import { lanAddress, lanRequest } from "../src/services/lan";

async function main() {
  assert.equal(lanAddress(" http://192.168.0.93:4173/ "), "http://192.168.0.93:4173");
  assert.throws(() => lanAddress("file:///tmp"));
  assert.throws(() => lanAddress("http://localhost:4173/api/settings"));
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/expired") { res.writeHead(400); res.end(JSON.stringify({ error: "配对码已过期" })); }
    else res.end(JSON.stringify({ method: req.method, body: raw ? JSON.parse(raw) : null }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await lanRequest(base, "/context")).method, "GET");
    assert.deepEqual((await lanRequest(base, "/candidate", { content: "中文候选稿" })).body, { content: "中文候选稿" });
    await assert.rejects(lanRequest(base, "/expired"), /配对码已过期/);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  await assert.rejects(lanRequest(base, "/context"), /手机浏览器/);
  console.log("局域网请求检查通过：GET、中文 POST、配对过期、断线错误提示");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
