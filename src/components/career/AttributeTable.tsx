import {
  ATTRIBUTE_GROUP_KEYS,
  ATTRIBUTE_GROUP_LABELS,
  ATTRIBUTE_LABELS,
} from "../../domain/player";
import type { AttributeFocus, Attributes } from "../../domain/types";

export function AttributeTable({ attributes }: { attributes: Attributes }) {
  return (
    <div className="attribute-table-grid">
      {(Object.keys(ATTRIBUTE_GROUP_LABELS) as Array<keyof Attributes>).map((group) => (
        <section className="data-panel compact-panel" key={group}>
          <h3>{ATTRIBUTE_GROUP_LABELS[group]}</h3>
          <table>
            <tbody>
              {ATTRIBUTE_GROUP_KEYS[group].map((key) => {
                const focus = `${group}.${key}` as AttributeFocus;
                const values = attributes[group] as unknown as Record<string, number>;

                return (
                  <tr key={focus}>
                    <th scope="row">{ATTRIBUTE_LABELS[focus]}</th>
                    <td>{values[key].toFixed(0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
