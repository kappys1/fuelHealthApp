import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveModel } from "./provider";

const ENV_KEYS = ["AI_PROVIDER", "AI_API_KEY", "AI_MODEL_TEXT"] as const;
const previousEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

describe("resolveModel", () => {
  beforeEach(() => {
    process.env.AI_PROVIDER = "anthropic";
    process.env.AI_API_KEY = "test-key";
    process.env.AI_MODEL_TEXT = "claude-sonnet-4-5-20250929";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = previousEnv[key];
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("crea un modelo Anthropic usando la clave agnóstica de Fuelboard", () => {
    const model = resolveModel("text");

    expect(model).toMatchObject({ modelId: "claude-sonnet-4-5-20250929" });
  });
});
