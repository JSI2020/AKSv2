"use client";

import { captureEvent } from "./posthog";

export function trackViewDesign(props: {
  designId: string;
  designSlug: string;
  designName?: string;
}) {
  captureEvent("view_design", {
    designId: props.designId,
    designSlug: props.designSlug,
    designName: props.designName,
  });
}

export function trackAddToCart(props: {
  designId: string;
  designSlug: string;
  sizeMode: string;
  quantity: number;
}) {
  captureEvent("add_to_cart", {
    designId: props.designId,
    designSlug: props.designSlug,
    sizeMode: props.sizeMode,
    quantity: props.quantity,
  });
}

export function trackCheckoutStarted(props: { itemCount: number; totalMinor: number }) {
  captureEvent("checkout_started", {
    itemCount: props.itemCount,
    totalMinor: props.totalMinor,
  });
}

export function trackOrderPlaced(props: {
  orderNumber: string;
  designIds: string[];
  totalMinor: number;
}) {
  captureEvent("order_placed", {
    orderNumber: props.orderNumber,
    designId: props.designIds[0] ?? null,
    designIds: props.designIds.join(","),
    totalMinor: props.totalMinor,
  });
}

export function trackPageView(path: string) {
  captureEvent("$pageview", { path });
}
