import { createHash } from "node:crypto";
import type { Transaction } from "@german-bank/shared-types";

export interface ParsedStatement {
  transactions: Array<Omit<Transaction, "id" | "category" | "tag" | "ruleSource" | "createdAt" | "updatedAt">>;
  openingBalance?: number;
  closingBalance?: number;
  warnings: string[];
  confidence: number;
}

export abstract class BaseGermanBankParser {
  abstract parseText(text: string, fileName: string, importBatchId: string, sourceFileId: string): ParsedStatement;

  protected normalizeDescription(raw: string): string {
    return raw
      .replace(/\s+/g, " ")
      .replace(/[ä]/gi, "ae")
      .replace(/[ö]/gi, "oe")
      .replace(/[ü]/gi, "ue")
      .replace(/[ß]/g, "ss")
      .trim()
      .toLowerCase();
  }

  protected stableTransactionId(accountType: string, bookingDate: string, amount: number, normalizedDescription: string): string {
    const input = `${accountType}|${bookingDate}|${amount.toFixed(2)}|${normalizedDescription}`;
    return createHash("sha256").update(input).digest("hex");
  }
}

export class GenericGermanGiroParser extends BaseGermanBankParser {
  parseText(text: string, fileName: string, importBatchId: string, sourceFileId: string): ParsedStatement {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const warnings: string[] = [];
    const transactions: ParsedStatement["transactions"] = [];

    const txPattern = /^(\d{2}\.\d{2}\.\d{4})\s+(\d{2}\.\d{2}\.\d{4})?\s*(.*?)\s+(-?\d+[,.]\d{2})$/;
    for (const line of lines) {
      const match = txPattern.exec(line);
      if (!match) continue;
      const amount = Number(match[4].replace(".", "").replace(",", "."));
      if (Number.isNaN(amount)) {
        warnings.push(`Suspicious amount parse: ${line}`);
        continue;
      }
      const description = match[3] || "Unknown";
      transactions.push({
        accountId: "default-giro",
        accountType: "german-bank-giro",
        bookingDate: match[1],
        valueDate: match[2] || undefined,
        description,
        normalizedDescription: this.normalizeDescription(description),
        amount,
        currency: "EUR",
        sourceFileId,
        sourceFileName: fileName,
        importBatchId
      });
    }

    if (transactions.length === 0) warnings.push("Unsupported statement layout or empty extracted text");

    const openingMatch = text.match(/Opening\s+Balance\s*:?\s*(-?\d+[,.]\d{2})/i);
    const closingMatch = text.match(/Closing\s+Balance\s*:?\s*(-?\d+[,.]\d{2})/i);
    const openingBalance = openingMatch ? Number(openingMatch[1].replace(".", "").replace(",", ".")) : undefined;
    const closingBalance = closingMatch ? Number(closingMatch[1].replace(".", "").replace(",", ".")) : undefined;

    if (openingBalance === undefined) warnings.push("Missing opening balance");
    if (closingBalance === undefined) warnings.push("Missing closing balance");

    return { transactions, openingBalance, closingBalance, warnings, confidence: Math.max(0.3, Math.min(0.95, transactions.length / 20)) };
  }

  hydrateTransactionIds(parsed: ParsedStatement["transactions"]): Transaction[] {
    const now = new Date().toISOString();
    return parsed.map((tx) => ({
      ...tx,
      id: this.stableTransactionId(tx.accountType, tx.bookingDate, tx.amount, tx.normalizedDescription),
      category: "Other",
      tag: "Variable",
      ruleSource: "fallback",
      createdAt: now,
      updatedAt: now
    }));
  }
}
