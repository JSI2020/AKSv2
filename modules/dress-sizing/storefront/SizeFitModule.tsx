import type { FitIntent, GarmentType, LengthBand, PomKey, StandardSize } from "../db/enums";
import { MINI_TABLE_POMS, inchCell, miniPomLabel, sizeFitBlurb, snippetSizes } from "./size-fit";

type Row = { size: StandardSize; pomKey: PomKey; valueHundredths: number };
export function SizeFitModule({ garmentType: _garmentType, lengthBand, fitIntent, baseSize, rows }: {
  garmentType: GarmentType; lengthBand: LengthBand; fitIntent: FitIntent; baseSize: StandardSize; rows: Row[];
}) {
  void _garmentType;
  const sizes = snippetSizes(baseSize);
  const poms = MINI_TABLE_POMS.filter((pom) => rows.some((row) => row.pomKey === pom));
  return <section className="border border-indigo-lift p-3">
    <h2 className="font-display text-xl text-greige">Size &amp; fit</h2>
    <p className="mb-3 text-[12px] text-chalk">{sizeFitBlurb(fitIntent, lengthBand, baseSize)}</p>
    <table className="w-full text-[12px] text-greige"><thead><tr><th className="text-start">Measurement</th>{sizes.map((s) => <th key={s} className="text-end">{s}</th>)}</tr></thead>
      <tbody>{poms.map((pom) => <tr key={pom} className="border-t border-indigo-lift"><td className="py-1">{miniPomLabel(pom)}</td>{sizes.map((size) => <td key={size} className="text-end font-data">{inchCell(rows.find((r) => r.pomKey === pom && r.size === size)?.valueHundredths)}</td>)}</tr>)}</tbody>
    </table>
  </section>;
}
