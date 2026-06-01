import { describe, expect, it } from "vitest";
import {
  ATTRIBUTE_TABLE_LAYOUT_CONTRACT,
  getAttributeTableRows,
} from "../components/career/AttributeTable";
import {
  getAttributeValueBandClass,
  getAttributeValueBandLabel,
} from "../components/career/AttributeValue";
import type { Attributes } from "../domain/types";

const attributes: Attributes = {
  technical: {
    finishing: 72,
    shooting: 74,
    passing: 58,
    dribbling: 61,
    defending: 44,
    firstTouch: 68,
    crossing: 52,
    tackling: 46,
    marking: 43,
    heading: 71,
  },
  physical: {
    pace: 66,
    speed: 76,
    acceleration: 70,
    stamina: 60,
    strength: 73,
    agility: 63,
  },
  mental: {
    decisions: 56,
    composure: 75,
    concentration: 64,
    workRate: 59,
    teamwork: 57,
  },
  career: {
    professionalism: 62,
    adaptability: 55,
    leadership: 41,
    marketability: 48,
  },
};

describe("attribute table", () => {
  it("marks selected-position key attributes as primary or secondary", () => {
    const rows = getAttributeTableRows({
      attributes,
      selectedPosition: "ST",
      leftFoot: 20,
      rightFoot: 8,
    });

    expect(rows.find((row) => row.id === "technical.finishing")?.role).toBe("primary");
    expect(rows.find((row) => row.id === "technical.shooting")?.role).toBe("primary");
    expect(rows.find((row) => row.id === "technical.heading")?.role).toBe("secondary");
    expect(rows.find((row) => row.id === "technical.dribbling")?.role).toBeUndefined();
  });

  it("marks wing footedness as a secondary key attribute", () => {
    const rows = getAttributeTableRows({
      attributes,
      selectedPosition: "LW",
      leftFoot: 18,
      rightFoot: 12,
    });

    expect(rows.find((row) => row.id === "physical.speed")?.role).toBe("primary");
    expect(rows.find((row) => row.id === "leftFoot")?.value).toBe(18);
    expect(rows.find((row) => row.id === "rightFoot")?.value).toBe(12);
    expect(rows.find((row) => row.id === "footedness")?.role).toBe("secondary");
  });

  it("returns expected value band class names and labels", () => {
    expect(getAttributeValueBandClass(39)).toBe("attr-very-poor");
    expect(getAttributeValueBandClass(40)).toBe("attr-poor");
    expect(getAttributeValueBandClass(50)).toBe("attr-average");
    expect(getAttributeValueBandClass(60)).toBe("attr-decent");
    expect(getAttributeValueBandClass(70)).toBe("attr-good");
    expect(getAttributeValueBandClass(80)).toBe("attr-excellent");
    expect(getAttributeValueBandClass(90)).toBe("attr-elite");
    expect(getAttributeValueBandLabel(70)).toBe("우수");
    expect(getAttributeValueBandLabel(90)).toBe("엘리트");
  });

  it("uses fixed value columns and overflow-safe label rules", () => {
    expect(ATTRIBUTE_TABLE_LAYOUT_CONTRACT.rowTemplate).toContain("minmax(0, 1fr)");
    expect(ATTRIBUTE_TABLE_LAYOUT_CONTRACT.rowTemplate).toContain("minmax(44px, 48px)");
    expect(ATTRIBUTE_TABLE_LAYOUT_CONTRACT.valueWidthPx).toBe(44);
    expect(ATTRIBUTE_TABLE_LAYOUT_CONTRACT.labelOverflow).toContain("overflow-hidden");
    expect(ATTRIBUTE_TABLE_LAYOUT_CONTRACT.labelOverflow).toContain("ellipsis");
    expect(ATTRIBUTE_TABLE_LAYOUT_CONTRACT.labelOverflow).toContain("overflow-wrap");
  });
});
