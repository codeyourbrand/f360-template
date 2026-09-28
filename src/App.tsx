import { useEffect, useState } from "react";
import { createAppClient, F360Error } from "@founder360/sdk";

// One client for the whole app: createAppClient() auto-detects localhost (the
// `f360 dev` proxy) vs. production (a same-origin /_session JWT). See
// AGENTS.md / .claude/skills/founder360/SKILL.md for the full SDK surface.
const f = createAppClient();

type Inventory = { connectors: string[]; mcp: string[] };

type SampleCall = { connector: string; command: string; result: unknown };

function errorMessage(err: unknown): string {
  if (err instanceof F360Error) return err.hint ?? err.message;
  return err instanceof Error ? err.message : String(err);
}

type Operation = {
  post?: {
    "x-ecom-write"?: boolean;
    requestBody?: { content?: { "application/json"?: { schema?: { required?: string[] } } } };
  };
};

// Finds the first read-only command that needs no arguments in the company's
// OpenAPI document — just enough to prove `f.call(...)` works, without
// hardcoding a connector name every company may not have. Commands with
// required args (e.g. a date range) are skipped: `{}` would be rejected.
function firstReadCommand(openapi: unknown): { connector: string; command: string } | null {
  const paths = (openapi as { paths?: Record<string, Operation> } | null)?.paths;
  if (!paths) return null;
  for (const [path, ops] of Object.entries(paths)) {
    const match = /^\/([a-z0-9_-]+)\/([a-z0-9_-]+)$/i.exec(path);
    if (!match || ops.post?.["x-ecom-write"] !== false) continue;
    const required = ops.post.requestBody?.content?.["application/json"]?.schema?.required ?? [];
    if (required.length === 0) return { connector: match[1], command: match[2] };
  }
  return null;
}

export default function App() {
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [sample, setSample] = useState<SampleCall | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [sampleChecked, setSampleChecked] = useState(false);

  useEffect(() => {
    f.inventory()
      .then(setInventory)
      .catch((err) => setInventoryError(errorMessage(err)));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const openapi = await f.openapi();
        const found = firstReadCommand(openapi);
        if (!found) return;
        const result = await f.call(found.connector, found.command, {});
        setSample({ ...found, result });
      } catch (err) {
        setSampleError(errorMessage(err));
      } finally {
        setSampleChecked(true);
      }
    })();
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Moja aplikacja</h1>

      <section>
        <h2>Connected</h2>
        {!inventory && !inventoryError && <p>Loading…</p>}
        {inventoryError && <p role="alert">Error: {inventoryError}</p>}
        {inventory && (
          <ul>
            {inventory.connectors.map((c) => (
              <li key={c}>{c}</li>
            ))}
            {inventory.mcp.map((m) => (
              <li key={`mcp-${m}`}>{m} (MCP)</li>
            ))}
            {inventory.connectors.length === 0 && inventory.mcp.length === 0 && <li>Nothing connected yet.</li>}
          </ul>
        )}
      </section>

      <section>
        <h2>Sample call</h2>
        {!sampleChecked && <p>Loading…</p>}
        {sampleError && <p role="alert">Error: {sampleError}</p>}
        {sampleChecked && !sample && !sampleError && <p>No argument-free read-only command to sample yet.</p>}
        {sample && (
          <div>
            <p>
              <code>{`call("${sample.connector}", "${sample.command}")`}</code>
            </p>
            <pre style={{ overflow: "auto", background: "#f4f4f4", padding: "0.75rem" }}>
              {JSON.stringify(sample.result, null, 2)}
            </pre>
          </div>
        )}
      </section>
    </main>
  );
}
