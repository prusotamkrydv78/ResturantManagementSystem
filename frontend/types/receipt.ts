import type { PaymentMethod } from "@/types/billing";

/** One line on a receipt, at the price it was actually charged. */
export interface ReceiptLine {
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  note: string | null;
}

/**
 * A record of what a table was charged and how they paid.
 *
 * Assembled by the server from the order, its lines and its payment. Nothing is
 * stored, so asking twice produces the same document rather than a second one.
 *
 * Not an invoice: no tax, no discount, no service charge and no sequence of its own,
 * because none of those exist in this product.
 */
export interface Receipt {
  restaurantName: string;
  restaurantAddressLine: string | null;
  restaurantCity: string | null;
  restaurantCountry: string | null;
  restaurantContactPhone: string | null;
  restaurantContactEmail: string | null;
  orderNumber: number;
  tableName: string;
  placedByName: string;
  openedAtUtc: string;
  closedAtUtc: string;
  lines: ReceiptLine[];
  itemCount: number;
  total: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  paidAtUtc: string;
  recordedByName: string;
}
