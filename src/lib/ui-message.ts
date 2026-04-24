import { isTextUIPart, type UIMessage } from "ai";

export function getTextFromUIMessage(message: UIMessage): string {
  return message.parts.filter(isTextUIPart).map((p) => p.text).join("");
}
