import { describe, expect, it } from "vitest";
import { sealData } from "iron-session";

// sessionOptions lee AUTH_SECRET al evaluarse el módulo → hay que fijarlo ANTES
// de importar proxy/session (lo hacemos con imports dinámicos dentro de los tests).
const SECRET = "test-secret-0123456789-abcdefghij-32";
process.env.AUTH_SECRET = SECRET;

const COOKIE = "fuelboard_session";

async function loadProxy() {
  const { proxy } = await import("./proxy");
  return proxy;
}

async function makeRequest(path: string, cookieValue?: string) {
  const { NextRequest } = await import("next/server");
  const headers = new Headers();
  if (cookieValue !== undefined) headers.set("cookie", `${COOKIE}=${cookieValue}`);
  return new NextRequest(new URL(`https://fuelboard.test${path}`), { headers });
}

/** Sello válido con la misma password que el proxy. */
function validSeal() {
  return sealData({ authenticated: true }, { password: SECRET });
}

function location(res: Response) {
  return res.headers.get("location");
}

describe("proxy — sesión autoritativa", () => {
  it("sin cookie en ruta protegida → redirige a /login", async () => {
    const proxy = await loadProxy();
    const res = await proxy(await makeRequest("/hoy"));
    expect(res.status).toBe(307);
    expect(location(res)).toContain("/login");
  });

  it("cookie válida en ruta protegida → deja pasar", async () => {
    const proxy = await loadProxy();
    const res = await proxy(await makeRequest("/hoy", await validSeal()));
    // NextResponse.next() no es un redirect.
    expect(location(res)).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("cookie válida en /login → redirige a /hoy", async () => {
    const proxy = await loadProxy();
    const res = await proxy(await makeRequest("/login", await validSeal()));
    expect(res.status).toBe(307);
    expect(location(res)).toContain("/hoy");
  });

  it("cookie inválida en ruta protegida → redirige a /login y borra la cookie muerta", async () => {
    const proxy = await loadProxy();
    const res = await proxy(await makeRequest("/hoy", "cookie-corrupta"));
    expect(res.status).toBe(307);
    expect(location(res)).toContain("/login");
    // Set-Cookie que expira la cookie muerta (auto-sana).
    expect(res.headers.get("set-cookie")).toMatch(/fuelboard_session=;/i);
  });

  it("REGRESIÓN bucle: cookie inválida en /login NO rebota a /hoy", async () => {
    const proxy = await loadProxy();
    const res = await proxy(await makeRequest("/login", "cookie-corrupta"));
    // Debe renderizar el login (next), no redirigir → sin bucle ERR_TOO_MANY_REDIRECTS.
    expect(location(res)).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
