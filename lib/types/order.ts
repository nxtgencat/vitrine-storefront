import { z } from "zod";

import { epochMsSchema, listSchema, paiseSchema } from "@/lib/types/common";

/**
 * Checkout & order wire shapes (api.md §4), written from the backend
 * sources in phase 1: `../backend/services/checkout.ts` (result, list,
 * detail, cancel), `../backend/services/sales.ts` (`InvoiceWithLines`),
 * and `../backend/db/schema/{orders,facts,payments}.ts` (row columns).
 */

/** Invoice summary as embedded in an order row (`CustomerOrderWithItems`). */
export const orderInvoiceSummarySchema = z
  .object({
    id: z.string().uuid(),
    invoiceNumber: z.string(),
    status: z.string(),
    subtotalPaise: paiseSchema,
    taxPaise: paiseSchema,
    totalPaise: paiseSchema,
  })
  .strict();

/** Orders list row. */
export const customerOrderRowSchema = z
  .object({
    id: z.string().uuid(),
    orderNumber: z.string(),
    orderType: z.string(),
    status: z.string(),
    totalPaise: paiseSchema,
    createdAt: epochMsSchema,
    invoice: orderInvoiceSummarySchema.nullable(),
  })
  .strict();

/** Orders list response: `{ data: CustomerOrderRow[] }`, newest first. */
export const customerOrderListSchema = listSchema(customerOrderRowSchema);

/** `invoice_items` row (also the order detail's `items`). */
export const invoiceItemRowSchema = z
  .object({
    id: z.string().uuid(),
    invoiceId: z.string().uuid(),
    variantId: z.string().uuid().nullable(),
    name: z.string(),
    quantity: z.number().int().min(1),
    unitPricePaise: paiseSchema,
    taxRatePct: z.number().int(),
    taxAmountPaise: paiseSchema,
    lineTotalPaise: paiseSchema,
    isCustomItem: z.number().int(),
    allocations: z.array(z.object({ batchId: z.string().uuid(), qty: z.number().int() }).strict()),
  })
  .strict();

/** `invoice_charges` row. */
export const invoiceChargeRowSchema = z
  .object({
    id: z.string().uuid(),
    invoiceId: z.string().uuid(),
    name: z.string(),
    amountPaise: paiseSchema,
  })
  .strict();

/** Invoice row + lines + charges (checkout result's `invoice`). */
export const invoiceWithLinesSchema = z
  .object({
    id: z.string().uuid(),
    invoiceNumber: z.string(),
    orderId: z.string().uuid().nullable(),
    customerId: z.string().uuid().nullable(),
    outletId: z.string().uuid(),
    status: z.string(),
    subtotalPaise: paiseSchema,
    taxPaise: paiseSchema,
    totalPaise: paiseSchema,
    pdfPath: z.string().nullable(),
    supersedesId: z.string().uuid().nullable(),
    version: z.number().int(),
    createdAt: epochMsSchema,
    updatedAt: epochMsSchema,
    items: z.array(invoiceItemRowSchema),
    charges: z.array(invoiceChargeRowSchema),
  })
  .strict();

/** `payments` row (checkout result's `payment`; the gateway pending row). */
export const paymentRowSchema = z
  .object({
    id: z.string().uuid(),
    paymentNumber: z.string(),
    direction: z.string(),
    partyType: z.string(),
    partyId: z.string(),
    invoiceId: z.string().uuid().nullable(),
    purchaseBillId: z.string().uuid().nullable(),
    returnId: z.string().uuid().nullable(),
    outletId: z.string().uuid(),
    amountPaise: paiseSchema,
    mode: z.string(),
    gateway: z.string().nullable(),
    gatewayPaymentId: z.string().nullable(),
    gatewayEventId: z.string().nullable(),
    status: z.string(),
    createdAt: epochMsSchema,
  })
  .strict();

/** `POST /api/storefront/checkout` response (api.md §4). */
export const storefrontCheckoutResultSchema = z
  .object({
    order: z
      .object({
        id: z.string().uuid(),
        orderNumber: z.string(),
        status: z.string(),
        totalPaise: paiseSchema,
        createdAt: epochMsSchema,
      })
      .strict(),
    invoice: invoiceWithLinesSchema,
    payment: paymentRowSchema.nullable(),
    checkoutReference: z.string().nullable(),
  })
  .strict();

/** `order_events` row — the timeline on the order detail. */
export const orderEventRowSchema = z
  .object({
    id: z.string().uuid(),
    orderId: z.string().uuid(),
    type: z.string(),
    payload: z.record(z.string(), z.unknown()),
    actorId: z.string().nullable(),
    actorType: z.string(),
    createdAt: epochMsSchema,
  })
  .strict();

/** Order detail = row + invoice summary + timeline + items. */
export const customerOrderDetailSchema = customerOrderRowSchema
  .extend({
    events: z.array(orderEventRowSchema),
    items: z.array(invoiceItemRowSchema),
  })
  .strict();

/** `POST /api/storefront/orders/:id/cancel` → `{ id, status: "cancelled" }`. */
export const cancelOrderResponseSchema = z
  .object({
    id: z.string().uuid(),
    status: z.literal("cancelled"),
  })
  .strict();

export type CustomerOrderRow = z.infer<typeof customerOrderRowSchema>;
export type CustomerOrderDetail = z.infer<typeof customerOrderDetailSchema>;
export type InvoiceWithLines = z.infer<typeof invoiceWithLinesSchema>;
export type InvoiceItemRow = z.infer<typeof invoiceItemRowSchema>;
export type PaymentRow = z.infer<typeof paymentRowSchema>;
export type StorefrontCheckoutResult = z.infer<typeof storefrontCheckoutResultSchema>;
export type OrderEventRow = z.infer<typeof orderEventRowSchema>;