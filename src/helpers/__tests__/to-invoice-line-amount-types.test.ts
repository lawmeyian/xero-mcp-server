import { describe, expect, it } from "vitest";
import { LineAmountTypes } from "xero-node";
import {
  invoiceLineAmountTypeNames,
  toInvoiceLineAmountTypes,
} from "../to-invoice-line-amount-types.js";

describe("toInvoiceLineAmountTypes", () => {
  it("maps EXCLUSIVE", () => {
    expect(toInvoiceLineAmountTypes("EXCLUSIVE")).toBe(
      LineAmountTypes.Exclusive,
    );
  });

  it("maps INCLUSIVE", () => {
    expect(toInvoiceLineAmountTypes("INCLUSIVE")).toBe(
      LineAmountTypes.Inclusive,
    );
  });

  it("maps NO_TAX onto the NoTax value Xero expects", () => {
    expect(toInvoiceLineAmountTypes("NO_TAX")).toBe(LineAmountTypes.NoTax);
  });

  it("returns undefined when nothing is supplied, so Xero applies its default", () => {
    expect(toInvoiceLineAmountTypes(undefined)).toBeUndefined();
  });

  it("accepts every name offered by the invoice tools", () => {
    for (const name of invoiceLineAmountTypeNames) {
      expect(toInvoiceLineAmountTypes(name)).toBeDefined();
    }
  });

  it("does not use the quote spelling of the no tax value", () => {
    expect(toInvoiceLineAmountTypes("NO_TAX")).not.toBe("NOTAX");
  });
});
