export type AttributeValueBand =
  | "very-poor"
  | "poor"
  | "average"
  | "decent"
  | "good"
  | "excellent"
  | "elite";

const BAND_CLASS_NAMES: Record<AttributeValueBand, string> = {
  "very-poor": "attr-very-poor",
  poor: "attr-poor",
  average: "attr-average",
  decent: "attr-decent",
  good: "attr-good",
  excellent: "attr-excellent",
  elite: "attr-elite",
};

const BAND_LABELS: Record<AttributeValueBand, string> = {
  "very-poor": "매우 낮음",
  poor: "낮음",
  average: "평균",
  decent: "준수",
  good: "우수",
  excellent: "탁월",
  elite: "엘리트",
};

function getAttributeValueBand(value: number): AttributeValueBand {
  if (value >= 90) {
    return "elite";
  }

  if (value >= 80) {
    return "excellent";
  }

  if (value >= 70) {
    return "good";
  }

  if (value >= 60) {
    return "decent";
  }

  if (value >= 50) {
    return "average";
  }

  if (value >= 40) {
    return "poor";
  }

  return "very-poor";
}

export function getAttributeValueBandClass(value: number): string {
  return BAND_CLASS_NAMES[getAttributeValueBand(value)];
}

export function getAttributeValueBandLabel(value: number): string {
  return BAND_LABELS[getAttributeValueBand(value)];
}

export function AttributeValue({ value }: { value: number }) {
  const rounded = Math.round(value);
  const bandLabel = getAttributeValueBandLabel(rounded);

  return (
    <span
      aria-label={`${rounded}, ${bandLabel}`}
      className={`attribute-value ${getAttributeValueBandClass(rounded)}`}
      title={bandLabel}
    >
      {rounded}
    </span>
  );
}
