import { cn } from "@/lib/utils";

type StitchRuleProps = {
  className?: string;
};

/** Dashed divider: 4px dash, 6px gap, 1px, chalk at 50%. */
export function StitchRule({ className }: StitchRuleProps) {
  return (
    <hr
      aria-hidden
      className={cn("my-4 block-size-px w-full border-0", className)}
      style={{
        backgroundImage: `repeating-linear-gradient(to inline-end, color-mix(in srgb, var(--color-chalk) 50%, transparent) 0 4px, transparent 4px 10px)`,
        backgroundSize: "10px 1px",
        backgroundRepeat: "repeat-x",
        backgroundPosition: "center",
      }}
    />
  );
}
