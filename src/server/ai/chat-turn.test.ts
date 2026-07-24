import { describe, expect, it } from "vitest";
import {
  CHAT_PHOTO_MARKER,
  chatImageTurnText,
  persistedChatUserText,
} from "@/lib/chat-turn";
import {
  CHAT_IMAGE_MAX_BYTES,
  buildChatModelMessages,
  chatRequestSchema,
} from "./chat-turn";

const image = {
  base64: Buffer.from("imagen efímera").toString("base64"),
  mediaType: "image/jpeg",
};

describe("chatRequestSchema · F05 Fase 2", () => {
  it("acepta texto, foto + pregunta y solo foto", () => {
    expect(chatRequestSchema.safeParse({ message: "¿Cómo encaja?" }).success).toBe(
      true,
    );
    expect(
      chatRequestSchema.safeParse({ message: "¿Cómo encaja?", image }).success,
    ).toBe(true);
    expect(chatRequestSchema.safeParse({ message: "", image }).success).toBe(true);
  });

  it("rechaza un turno sin texto ni foto", () => {
    expect(chatRequestSchema.safeParse({ message: "" }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ message: "   " }).success).toBe(false);
  });

  it.each(["application/pdf", "image/svg+xml", "text/plain"])(
    "rechaza el MIME no permitido %s",
    (mediaType) => {
      expect(
        chatRequestSchema.safeParse({ message: "", image: { ...image, mediaType } })
          .success,
      ).toBe(false);
    },
  );

  it("rechaza base64 malformado", () => {
    expect(
      chatRequestSchema.safeParse({
        message: "",
        image: { ...image, base64: "esto no es base64 !!" },
      }).success,
    ).toBe(false);
  });

  it("rechaza más de 8 MB antes de persistir", () => {
    const oversized = Buffer.alloc(CHAT_IMAGE_MAX_BYTES + 1).toString("base64");
    expect(
      chatRequestSchema.safeParse({
        message: "",
        image: { ...image, base64: oversized },
      }).success,
    ).toBe(false);
  });

  it("acepta una imagen exactamente en el límite de 8 MB", () => {
    const atLimit = Buffer.alloc(CHAT_IMAGE_MAX_BYTES).toString("base64");
    expect(
      chatRequestSchema.safeParse({
        message: "",
        image: { ...image, base64: atLimit },
      }).success,
    ).toBe(true);
  });
});

describe("turno multimodal efímero", () => {
  const history = [
    {
      role: "user" as const,
      content: "Una pregunta anterior",
      turnId: "turno-anterior",
    },
    {
      role: "assistant" as const,
      content: "Una respuesta anterior",
      turnId: "turno-anterior",
    },
    {
      role: "user" as const,
      content: `${CHAT_PHOTO_MARKER}\n¿Qué opción elegirías?`,
      turnId: "turno-actual",
    },
  ];

  it("convierte solo el usuario del turno actual a file + text", () => {
    const messages = buildChatModelMessages(
      history,
      "turno-actual",
      image,
      "¿Qué opción elegirías?",
    );

    expect(messages.slice(0, 2)).toEqual([
      { role: "user", content: "Una pregunta anterior" },
      { role: "assistant", content: "Una respuesta anterior" },
    ]);
    expect(messages[2]).toEqual({
      role: "user",
      content: [
        {
          type: "file",
          mediaType: "image/jpeg",
          data: image.base64,
        },
        {
          type: "text",
          text: chatImageTurnText("¿Qué opción elegirías?"),
        },
      ],
    });
  });

  it("mantiene byte-funcionalmente el historial si no hay foto", () => {
    expect(
      buildChatModelMessages(history, "turno-actual", undefined, "texto ignorado"),
    ).toEqual(history.map(({ role, content }) => ({ role, content })));
  });

  it("persiste solo marcador y pregunta, nunca imagen ni instrucción interna", () => {
    const persisted = persistedChatUserText("¿Qué opción elegirías?", true);
    expect(persisted).toBe(`${CHAT_PHOTO_MARKER}\n¿Qué opción elegirías?`);
    expect(persisted).not.toContain(image.base64);
    expect(persisted).not.toContain("carta");
    expect(persistedChatUserText("", true)).toBe(CHAT_PHOTO_MARKER);
  });

  it("no altera el texto persistido cuando no hay foto", () => {
    expect(persistedChatUserText("  texto con espacios  ", false)).toBe(
      "  texto con espacios  ",
    );
  });
});
