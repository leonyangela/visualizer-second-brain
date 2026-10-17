import { Suspense } from "react";
import { connection } from "next/server";
import { readVault } from "@/lib/vault/read-vault";
import { BrainApp } from "@/components/BrainApp";

async function Brain() {
  // Read the vault on every request so new pages show up on refresh.
  await connection();
  const result = await readVault().then(
    (data) => ({ data }),
    (error: unknown) => ({ error: error instanceof Error ? error.message : "Could not read the vault." }),
  );
  if ("error" in result) {
    return (
      <div className="hud-panel m-8 max-w-xl">
        <h2 className="hud-card-title">VAULT / not found</h2>
        <p className="text-white">{result.error}</p>
        <p className="hud-dim mt-2">Set VAULT_PATH in .env.local and restart the dev server.</p>
      </div>
    );
  }
  return <BrainApp data={result.data} />;
}

export default function Page() {
  return (
    <Suspense fallback={<p className="hud-dim p-8 text-sm">loading brain...</p>}>
      <Brain />
    </Suspense>
  );
}
