import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "../i18n";

export interface Point { name: string; value: number; value2?: number }
const COLORS = ["#34d399", "#fbbf24", "#60a5fa", "#a78bfa", "#fb7185", "#94a3b8"];

/**
 * Grafik responsif (Recharts) + tabel tersembunyi untuk pembaca layar.
 * Warna tidak menjadi satu-satunya pembeda: ada label sumbu/legenda & tabel alternatif.
 */
export function StatisticsChart({ title, type, data, unit, series2Label, height = 240 }: {
  title: string; type: "bar" | "line" | "donut"; data: Point[]; unit?: string; series2Label?: string; height?: number;
}) {
  const { t, n } = useI18n();
  const axis = { stroke: "var(--text-faint)", fontSize: 12, tickLine: false, axisLine: false } as const;
  const tip = { contentStyle: { background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)" }, formatter: (v: number) => n(v) + (unit ? ` ${unit}` : "") };
  return (
    <figure className="m-0">
      <figcaption className="mb-2 text-sm font-bold">{title}</figcaption>
      <div role="img" aria-label={`${title}: ${data.map((d) => `${d.name} ${d.value}`).join(", ")}`} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {type === "donut" ? (
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={3} stroke="none" label={(e) => e.name}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip {...tip} />
            </PieChart>
          ) : type === "line" ? (
            <LineChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
              <CartesianGrid stroke="var(--border-soft)" vertical={false} />
              <XAxis dataKey="name" {...axis} /><YAxis {...axis} allowDecimals={false} /><Tooltip {...tip} />
              <Line type="monotone" dataKey="value" stroke="#34d399" strokeWidth={2.500} dot={{ r: 3 }} />
              {series2Label && <Line type="monotone" dataKey="value2" name={series2Label} stroke="#fbbf24" strokeWidth={2} strokeDasharray="5 4" dot={false} />}
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
              <CartesianGrid stroke="var(--border-soft)" vertical={false} />
              <XAxis dataKey="name" {...axis} /><YAxis {...axis} allowDecimals={false} /><Tooltip {...tip} cursor={{ fill: "hsl(0 0% 100% / .04)" }} />
              <Bar dataKey="value" fill="#34d399" radius={[8, 8, 0, 0]} />
              {series2Label && <Bar dataKey="value2" name={series2Label} fill="#fbbf24" radius={[8, 8, 0, 0]} />}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead><tr><th>{t("common.name")}</th><th>{t("common.value")}</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.name}><td>{d.name}</td><td>{d.value}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
