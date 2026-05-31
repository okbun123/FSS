import {
  ATTRIBUTE_GROUP_KEYS,
  ATTRIBUTE_GROUP_LABELS,
  ATTRIBUTE_LABELS,
} from "../../domain/player";
import {
  getPositionKeyAttributeRole,
  type PositionAttributeKey,
} from "../../domain/positionKeyAttributes";
import type { AttributeFocus, Attributes, Position } from "../../domain/types";
import { AttributeValue } from "./AttributeValue";
import { PositionKeyAttributeBadge } from "./PositionKeyAttributeBadge";

export interface AttributeTableProps {
  attributes: Attributes;
  selectedPosition?: Position;
  leftFoot?: number;
  rightFoot?: number;
}

export interface AttributeTableRowModel {
  id: PositionAttributeKey;
  group: keyof Attributes;
  label: string;
  value: number;
  role?: ReturnType<typeof getPositionKeyAttributeRole>;
}

export const ATTRIBUTE_TABLE_LAYOUT_CONTRACT = {
  rowTemplate: "minmax(0, 1fr) minmax(42px, 46px) minmax(44px, 48px)",
  valueWidthPx: 44,
  labelOverflow: ["overflow-hidden", "ellipsis", "overflow-wrap"] as const,
};

function average(...values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function readAttributeValue(attributes: Attributes, focus: AttributeFocus): number {
  const [group, key] = focus.split(".") as [keyof Attributes, string];
  const values = attributes[group] as unknown as Record<string, number | undefined>;
  const value = values[key];

  if (typeof value === "number") {
    return value;
  }

  switch (focus) {
    case "technical.shooting":
      return average(attributes.technical.finishing, attributes.mental.composure);
    case "technical.crossing":
      return attributes.technical.passing;
    case "technical.tackling":
    case "technical.marking":
      return attributes.technical.defending;
    case "technical.heading":
      return average(attributes.technical.defending, attributes.physical.strength);
    case "physical.speed":
      return attributes.physical.pace;
    case "physical.acceleration":
      return average(attributes.physical.pace, attributes.physical.agility);
    case "mental.concentration":
      return average(attributes.mental.decisions, attributes.mental.composure, attributes.mental.workRate);
    default:
      return 0;
  }
}

function getFootednessScore(leftFoot?: number, rightFoot?: number): number | undefined {
  if (typeof leftFoot !== "number" || typeof rightFoot !== "number") {
    return undefined;
  }

  const strongFoot = Math.max(leftFoot, rightFoot);
  const weakFoot = Math.min(leftFoot, rightFoot);

  return Math.round(((strongFoot + weakFoot * 0.75) / 35) * 100);
}

export function getAttributeTableRows({
  attributes,
  selectedPosition,
  leftFoot,
  rightFoot,
}: AttributeTableProps): AttributeTableRowModel[] {
  const rows = (Object.keys(ATTRIBUTE_GROUP_LABELS) as Array<keyof Attributes>).flatMap((group) =>
    ATTRIBUTE_GROUP_KEYS[group].map((key) => {
      const focus = `${group}.${key}` as AttributeFocus;

      return {
        id: focus,
        group,
        label: ATTRIBUTE_LABELS[focus],
        value: readAttributeValue(attributes, focus),
        role: getPositionKeyAttributeRole(selectedPosition, focus),
      };
    }),
  );
  const footednessScore = getFootednessScore(leftFoot, rightFoot);

  if (typeof footednessScore !== "number") {
    return rows;
  }

  return [
    ...rows,
    {
      id: "footedness",
      group: "technical",
      label: "발 활용도",
      value: footednessScore,
      role: getPositionKeyAttributeRole(selectedPosition, "footedness"),
    },
  ];
}

export function AttributeTable(props: AttributeTableProps) {
  const rows = getAttributeTableRows(props);

  return (
    <div className="attribute-table-grid">
      {(Object.keys(ATTRIBUTE_GROUP_LABELS) as Array<keyof Attributes>).map((group) => {
        const groupRows = rows.filter((row) => row.group === group);

        return (
          <section className="attribute-card" key={group}>
            <h3>{ATTRIBUTE_GROUP_LABELS[group]}</h3>
            <div className="attribute-grid" role="table" aria-label={`${ATTRIBUTE_GROUP_LABELS[group]} 능력치`}>
              {groupRows.map((row) => (
                <div
                  className={row.role ? `attribute-row key-${row.role}` : "attribute-row"}
                  data-attribute-id={row.id}
                  key={row.id}
                  role="row"
                >
                  <span className="attribute-label" role="rowheader" title={row.label}>
                    {row.label}
                  </span>
                  <PositionKeyAttributeBadge role={row.role} />
                  <AttributeValue value={row.value} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
      <section className="attribute-legend" aria-label="능력치 범례">
        <span><span className="position-key-badge primary">주요</span> 선택 포지션 핵심 능력치</span>
        <span><span className="position-key-badge secondary">보조</span> 선택 포지션 보조 능력치</span>
      </section>
    </div>
  );
}
