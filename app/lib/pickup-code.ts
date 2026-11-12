// lib/pickup-code.ts
import { randomInt } from "crypto";

// Sem 0/O, 1/I/L para evitar confusão na leitura
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generatePickupCode(length = 5): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

// Comparação de nome sem acento e sem diferença de maiúsculas
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
