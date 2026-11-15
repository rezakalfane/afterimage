import Link from "next/link";
import { headers } from "next/headers";
import { AdminClient } from "@/components/admin/AdminClient";
import { contextFromHeaders } from "@/server/dal/context";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administration — AFTERIMAGE" };

export default async function AdminPage() {
  let role: string | null = null;
  try {
    role = (await contextFromHeaders(await headers())).role;
  } catch {
    role = null;
  }
  if (role !== "owner" && role !== "admin") {
    return (
      <main className="page page--center">
        <h1>Accès réservé</h1>
        <p>Cette page est réservée aux administrateurs de l’espace.</p>
        <Link className="btn" href="/connexion">Se connecter</Link>
      </main>
    );
  }
  return <AdminClient />;
}
