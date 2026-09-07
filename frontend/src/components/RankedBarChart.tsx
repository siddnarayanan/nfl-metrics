import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const IMAGE_SIZE = 16;
const IMAGE_GAP = 4;

export interface RankedBarEntry {
  key: string;
  label: string;
  tooltipLabel?: string;
  value: number;
  color?: string | null;
  imageUrl?: string | null;
}

interface BarEndImageProps {
  x?: unknown;
  y?: unknown;
  width?: unknown;
  height?: unknown;
  value?: unknown;
  index?: number;
  images: (string | null | undefined)[];
}

function BarEndImage(props: BarEndImageProps) {
  const { index = 0, images } = props;
  const image = images[index];
  if (!image) return null;

  const x = Number(props.x);
  const y = Number(props.y);
  const width = Number(props.width);
  const height = Number(props.height);
  const value = Number(props.value);

  // x is the zero-baseline anchor, not the bar's visual left edge; width is
  // signed (negative for negative values) — so the bar's far tip, away from
  // zero, is always x + width regardless of sign.
  const tip = x + width;
  const isPositive = value >= 0;
  const imageX = isPositive ? tip + IMAGE_GAP : tip - IMAGE_GAP - IMAGE_SIZE;
  const imageY = y + height / 2 - IMAGE_SIZE / 2;
  return <image href={image} x={imageX} y={imageY} width={IMAGE_SIZE} height={IMAGE_SIZE} />;
}

interface RankedBarChartProps {
  title: string;
  data: RankedBarEntry[];
  allowNegative: boolean;
  onBarClick?: (entry: RankedBarEntry) => void;
  footnote?: string;
  yAxisWidth?: number;
}

export function RankedBarChart({
  title,
  data,
  allowNegative,
  onBarClick,
  footnote,
  yAxisWidth = 70,
}: RankedBarChartProps) {
  const values = data.map((d) => d.value);
  let domain: [number, number];
  let ticks: number[];
  if (allowNegative) {
    // Symmetric around 0, so 0 always sits dead center rather than wherever
    // the data's own min/max happen to fall, and is always an explicit
    // labeled tick rather than left to auto-generated ticks.
    const absMax = Math.max(...values.map((v) => Math.abs(v)), 0.01);
    const bound = absMax * 1.15;
    domain = [-bound, bound];
    ticks = [-bound, -bound / 2, 0, bound / 2, bound];
  } else {
    const max = Math.max(...values, 0.01) * 1.15;
    domain = [0, max];
    ticks = [0, max / 2, max];
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-4 text-sm font-semibold text-slate-700">{title}</h2>
      <ResponsiveContainer width="100%" height={Math.max(320, data.length * 24)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 30, bottom: 5 }}
          onClick={(state) => {
            const index = state?.activeTooltipIndex;
            if (onBarClick && typeof index === "number" && data[index]) onBarClick(data[index]);
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => (typeof v === "number" ? v.toFixed(2) : v)}
            domain={domain}
            ticks={ticks}
          />
          <YAxis type="category" dataKey="label" width={yAxisWidth} interval={0} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value) => (typeof value === "number" ? value.toFixed(3) : value)}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.tooltipLabel ?? ""}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} cursor={onBarClick ? "pointer" : undefined}>
            {data.map((entry) => (
              <Cell key={entry.key} fill={entry.color ?? "#64748b"} />
            ))}
            <LabelList
              dataKey="value"
              content={(props) => <BarEndImage {...props} images={data.map((d) => d.imageUrl)} />}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {footnote && <p className="mt-2 text-xs text-slate-400">{footnote}</p>}
    </div>
  );
}
