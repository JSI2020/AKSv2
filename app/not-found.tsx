import Link from "next/link";
import { headers } from "next/headers";

export default async function NotFound() {
  const path = (await headers()).get("x-aks-pathname") ?? "";
  if (path.startsWith("/admin")) return <AdminMiss />;
  return <ShopMiss />;
}

function ShopMiss() {
  return (
    <main
      style={{
        background: "#F4EEE1",
        color: "#2B2926",
        minHeight: "100dvh",
        padding: "4.5rem 1.5rem",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <p
          style={{
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontSize: 11,
          }}
        >
          AKS
        </p>
        <h1
          style={{
            fontWeight: 300,
            fontSize: "2.6rem",
            marginTop: "0.75rem",
          }}
        >
          This page isn’t here
        </h1>
        <p style={{ marginTop: "0.75rem", maxWidth: "36rem", lineHeight: 1.5 }}>
          The address may have changed. The shop, your account, and shipping
          notes are still where they were.
        </p>
        <nav
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
            marginTop: "1.5rem",
            fontSize: 14,
          }}
        >
          <Link href="/">Home</Link>
          <Link href="/collections">Shop</Link>
          <Link href="/account/login">Sign in</Link>
          <Link href="/pages/shipping-returns">Shipping & returns</Link>
        </nav>
      </div>
    </main>
  );
}

function AdminMiss() {
  return (
    <main
      style={{
        background: "#1B2547",
        color: "#DCD9CF",
        minHeight: "100dvh",
        padding: "4.5rem 1.5rem",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <p
          style={{
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontSize: 11,
            color: "#8FA6B2",
          }}
        >
          AKS · Admin
        </p>
        <h1
          style={{
            fontWeight: 300,
            fontSize: "2.6rem",
            marginTop: "0.75rem",
          }}
        >
          This page isn’t in the admin
        </h1>
        <p style={{ marginTop: "0.75rem", color: "#8FA6B2" }}>
          Check the address, or go back to a section you use.
        </p>
        <nav
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
            marginTop: "1.5rem",
            fontSize: 14,
          }}
        >
          <Link href="/admin">Overview</Link>
          <Link href="/admin/orders">Orders</Link>
          <Link href="/admin/designs">Designs</Link>
          <Link href="/admin/settings">Settings</Link>
          <Link href="/admin/login">Sign in</Link>
        </nav>
      </div>
    </main>
  );
}
