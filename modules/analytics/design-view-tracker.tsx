"use client";

import { useEffect } from "react";

import { trackViewDesign } from "@/modules/analytics";

export function DesignViewTracker(props: {
  designId: string;
  designSlug: string;
  designName: string;
}) {
  useEffect(() => {
    trackViewDesign(props);
  }, [props.designId, props.designSlug, props.designName]);

  return null;
}
