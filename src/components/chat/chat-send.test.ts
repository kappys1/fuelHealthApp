import { describe, expect, it } from "vitest";
import { createChatTurnId, planChatSend } from "./chat-send";

describe("createChatTurnId · compatibilidad móvil", () => {
  it("conserva randomUUID cuando el navegador lo expone", () => {
    const expected = "f05ccbb7-0de2-47b5-bbe9-169d17487633";

    expect(
      createChatTurnId({
        randomUUID: () => expected,
        getRandomValues: () => {
          throw new Error("No debe usar el fallback");
        },
      }),
    ).toBe(expected);
  });

  it("genera un UUID v4 si Web Crypto no expone randomUUID", () => {
    const bytes = Uint8Array.from({ length: 16 }, (_, index) => index);
    const mobileCrypto = {
      getRandomValues<T extends ArrayBufferView | null>(array: T): T {
        if (array instanceof Uint8Array) array.set(bytes);
        return array;
      },
    };

    expect(() => createChatTurnId(mobileCrypto)).not.toThrow();
    expect(createChatTurnId(mobileCrypto)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe("planChatSend · regresión export 21-jul", () => {
  const message = "Como verías si cierro el dia así?";
  const image = {
    base64: "aW1hZ2Vu",
    mediaType: "image/jpeg",
  };

  it("reutiliza el turno fallido si Alex reenvía el mismo texto", () => {
    expect(
      planChatSend({
        message,
        failedTurn: {
          retryText: message,
          turnId: "f05ccbb7-0de2-47b5-bbe9-169d17487633",
        },
        candidateTurnId: "10f1090c-30b1-403f-8fbd-8e6cc3fdea30",
      }),
    ).toEqual({
      turnId: "f05ccbb7-0de2-47b5-bbe9-169d17487633",
      appendUserMessage: false,
      image: null,
    });
  });

  it("permite repetir una pregunta una vez completado el turno anterior", () => {
    expect(
      planChatSend({
        message,
        failedTurn: null,
        candidateTurnId: "nuevo-turno",
      }),
    ).toEqual({
      turnId: "nuevo-turno",
      appendUserMessage: true,
      image: null,
    });
  });

  it("reintenta la foto fallida en memoria con el mismo turnId", () => {
    expect(
      planChatSend({
        message: "",
        retryTurnId: "turno-foto",
        failedTurn: {
          retryText: "",
          turnId: "turno-foto",
          image,
        },
        candidateTurnId: "turno-nuevo",
      }),
    ).toEqual({
      turnId: "turno-foto",
      appendUserMessage: false,
      image,
    });
  });

  it("un envío nuevo usa la foto elegida y un turnId nuevo", () => {
    expect(
      planChatSend({
        message: "Lee la etiqueta",
        image,
        failedTurn: null,
        candidateTurnId: "turno-nuevo",
      }),
    ).toEqual({
      turnId: "turno-nuevo",
      appendUserMessage: true,
      image,
    });
  });
});
