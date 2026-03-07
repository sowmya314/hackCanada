"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [locationState, setLocationState] = useState("Using current location if allowed.");

  async function readCurrentLocation() {
    if (typeof window === "undefined" || !navigator.geolocation) return null;
    setLocationState("Requesting location permission...");
    return new Promise<{ lat: number; lng: number } | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationState("Location captured.");
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          setLocationState("Location blocked. You can still continue.");
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
    const location = mode === "register" ? await readCurrentLocation() : null;
    const payload =
      mode === "register"
        ? {
            name,
            email,
            password,
            homeLat: location?.lat,
            homeLng: location?.lng,
          }
        : { email, password };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Authentication failed.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <button
          type="button"
          className={mode === "register" ? "" : "secondary"}
          onClick={() => setMode("register")}
        >
          Register
        </button>
        <button
          type="button"
          className={mode === "login" ? "" : "secondary"}
          onClick={() => setMode("login")}
        >
          Login
        </button>
      </div>

      <form onSubmit={submit} className="grid">
        {mode === "register" && (
          <>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              required
            />
            <p className="meta">{locationState}</p>
          </>
        )}
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          required
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (8+ chars)"
          type="password"
          required
          minLength={8}
        />

        <button type="submit">{mode === "register" ? "Create Account" : "Sign In"}</button>
      </form>

      {error ? <p className="meta" style={{ color: "#b42318" }}>{error}</p> : null}
    </div>
  );
}
