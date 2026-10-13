import { describe, expect, it } from "vitest";
import { isAdmin, parseAdminEmails } from "@/lib/admins";

describe("parseAdminEmails", () => {
  it("leest een lijst gescheiden door komma's, puntkomma's of spaties", () => {
    expect(parseAdminEmails("a@example.com,b@example.com; c@example.com  d@example.com")).toEqual([
      "a@example.com",
      "b@example.com",
      "c@example.com",
      "d@example.com",
    ]);
  });

  it("maakt adressen klein en haalt spaties weg", () => {
    expect(parseAdminEmails("  Jan@Example.COM , ")).toEqual(["jan@example.com"]);
  });

  it("geeft een lege lijst zonder waarde of zonder geldige adressen", () => {
    for (const value of [undefined, "", "  ", ",,;", "geen-adres"]) {
      expect(parseAdminEmails(value), String(value)).toEqual([]);
    }
  });
});

describe("isAdmin", () => {
  const env = { GAME_MANAGER_ADMINS: "beheer@example.com, Jan@Example.com" };

  it("laat adressen uit de lijst toe, ongeacht hoofdletters en spaties", () => {
    expect(isAdmin("beheer@example.com", env)).toBe(true);
    expect(isAdmin(" BEHEER@example.com ", env)).toBe(true);
    expect(isAdmin("jan@example.com", env)).toBe(true);
  });

  it("weigert adressen die niet in de lijst staan", () => {
    expect(isAdmin("piet@example.com", env)).toBe(false);
    expect(isAdmin("beheer@example.com.evil.nl", env)).toBe(false);
    expect(isAdmin("example.com", env)).toBe(false);
  });

  it("weigert zonder adres", () => {
    for (const email of [undefined, null, "", "  "]) expect(isAdmin(email, env), String(email)).toBe(false);
  });

  it("laat niemand toe als de lijst leeg is of ontbreekt", () => {
    expect(isAdmin("beheer@example.com", {})).toBe(false);
    expect(isAdmin("beheer@example.com", { GAME_MANAGER_ADMINS: "" })).toBe(false);
    expect(isAdmin("beheer@example.com", { GAME_MANAGER_ADMINS: " , " })).toBe(false);
  });
});
