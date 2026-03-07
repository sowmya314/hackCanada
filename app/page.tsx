import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AuthPanel } from "@/components/auth-panel";

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <main className="mobile-shell" style={{ padding: 14 }}>
      <section className="mobile-hero">
        <h1 style={{ marginTop: 6, marginBottom: 8 }}>BulkBridge</h1>
        <p style={{ margin: 0, color: "#d2ece8" }}>
          Community Costco planning and bulk splitting in one mobile flow.
        </p>
      </section>
      <div style={{ marginTop: 14 }}>
        <AuthPanel />
      </div>
    </main>
  );
}
