import { vsStandard } from "../core/standard";
import { formatLength } from "../core/units";
import type { GeneratedRow } from "../core/types";
import { POM_LABELS } from "../ui/labels";

export function ChangeTable({ rows }: { rows: GeneratedRow[] }) {
  const diffs = vsStandard(rows);
  return <section className="border border-indigo-lift p-3">
    <h2 className="mb-2 font-display text-xl text-greige">Standard vs this style</h2>
    <table className="w-full text-[12px] text-greige"><tbody>{diffs.map((row) => <tr key={row.pomKey} className="border-t border-indigo-lift">
      <td className="py-1">{POM_LABELS[row.pomKey]}</td><td className="text-end">{formatLength(row.standardHundredths)}</td>
      <td className="text-end">{formatLength(row.styleHundredths)}</td><td className="text-end text-chalk">{formatLength(Math.abs(row.deltaHundredths))}</td>
    </tr>)}</tbody></table>
  </section>;
}
