import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, ReferenceLine,
} from 'recharts';
import { api } from '../api/client';

const SLA_COLORS = {
  true:  { bar: '#C23934', bg: '#FDECEA', text: '#C23934' },
  false: { bar: '#0176D3', bg: 'transparent', text: '#3E3E3C' },
};

// Custom Tooltip for bar chart
function CustomBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-[#DDDBDA] shadow-card rounded-[4px] px-3 py-2 text-xs">
      <div className="font-semibold text-[#181818] mb-1">{d.label}</div>
      <div>Avg time: <strong>{d.avg_hours}h</strong></div>
      <div>SLA limit: {d.sla_threshold_hours ? `${d.sla_threshold_hours}h` : '—'}</div>
      <div>Sample size: {d.count}</div>
      {d.exceeds_sla && <div className="text-[#C23934] font-medium mt-1">⚠ Exceeds SLA</div>}
    </div>
  );
}

function CustomLineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#DDDBDA] shadow-card rounded-[4px] px-3 py-2 text-xs">
      <div className="font-semibold text-[#181818] mb-1">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey}>{p.name}: <strong>{p.value}h</strong></div>
      ))}
    </div>
  );
}

// Summary stat card
function StatCard({ label, value, sub, accent }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-[#706E6B] font-medium mb-1">{label}</div>
      <div className={`text-2xl font-bold ${accent || 'text-[#181818]'}`}>{value}</div>
      {sub && <div className="text-xs text-[#706E6B] mt-0.5">{sub}</div>}
    </div>
  );
}

export default function Analytics() {
  const [severity, setSeverity] = useState('all');
  const [period, setPeriod]     = useState('month');
  const [stageData, setStageData]   = useState([]);
  const [cycleData, setCycleData]   = useState([]);
  const [varData, setVarData]       = useState([]);
  const [summary, setSummary]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [sd, cd, vd, sm] = await Promise.all([
          api.stageAverages({ severity }),
          api.cycleTime({ period, severity }),
          api.variance({ severity }),
          api.slaSummary(),
        ]);
        setStageData(sd);
        setCycleData(cd);
        setVarData(vd);
        setSummary(sm);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [severity, period]);

  if (error) return <div className="p-8 pill-red text-sm">{error}</div>;

  const breachingStages = stageData.filter(d => d.exceeds_sla);
  const highestVariance = varData.reduce((max, d) => d.cv_percent > (max?.cv_percent || 0) ? d : max, null);

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#181818]">Bottleneck Analytics</h1>
          <p className="text-sm text-[#706E6B] mt-0.5">Stage performance across all closed RCAs</p>
        </div>
        <div className="flex gap-2">
          <select
            className="border border-[#DDDBDA] rounded-[4px] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
            value={severity}
            onChange={e => setSeverity(e.target.value)}
          >
            <option value="all">All Severities</option>
            <option value="Sev1">Sev1 Only</option>
            <option value="Sev2">Sev2 Only</option>
          </select>
          <select
            className="border border-[#DDDBDA] rounded-[4px] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
            value={period}
            onChange={e => setPeriod(e.target.value)}
          >
            <option value="month">By Month</option>
            <option value="week">By Week</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-[#706E6B] text-sm">Loading…</div>
      ) : (
        <div className="space-y-5">
          {/* Summary stats */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total RCAs" value={summary.total} />
              <StatCard label="Published" value={summary.published} accent="text-[#2E7D32]" />
              <StatCard label="In Progress" value={summary.in_progress} accent="text-[#0176D3]" />
              <StatCard
                label="VP Review Breaches"
                value={summary.vp_review_breaches}
                sub="> 48h in VP Review"
                accent={summary.vp_review_breaches > 0 ? 'text-[#C23934]' : 'text-[#181818]'}
              />
            </div>
          )}

          {/* SLA breach alert */}
          {breachingStages.length > 0 && (
            <div className="rounded-[4px] border border-[#FDECEA] bg-[#FDECEA] px-4 py-3 flex items-start gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="#C23934" strokeWidth="2" className="w-4 h-4 flex-shrink-0 mt-0.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div className="text-sm text-[#C23934]">
                <strong>SLA exceeded</strong> in {breachingStages.map(s => s.label).join(', ')}.
                Average time in these stages exceeds configured thresholds.
              </div>
            </div>
          )}

          {/* Bar chart: avg time per stage */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-[#181818] mb-1">Average Time per Stage</h2>
            <p className="text-xs text-[#706E6B] mb-4">Hours spent in each stage (closed RCAs only). Red bars exceed SLA threshold.</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stageData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DDDBDA" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#706E6B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#706E6B' }} unit="h" />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="avg_hours" radius={[2, 2, 0, 0]}
                  fill="#0176D3"
                  // Color bars individually
                  label={false}
                >
                  {stageData.map((entry, index) => (
                    <rect key={index} />
                  ))}
                </Bar>
                {/* Render per-bar colors via individual shapes */}
                <Bar
                  dataKey="avg_hours"
                  radius={[2, 2, 0, 0]}
                  fill="#0176D3"
                  isAnimationActive={true}
                  shape={(props) => {
                    const { x, y, width, height, payload } = props;
                    const color = payload.exceeds_sla ? '#C23934' : '#0176D3';
                    return <rect x={x} y={y} width={width} height={height} fill={color} rx={2} />;
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Line chart: cycle time trend */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-[#181818] mb-1">RCA Cycle Time Trend</h2>
            <p className="text-xs text-[#706E6B] mb-4">Average total hours from requested → published, grouped by {period}.</p>
            {cycleData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-[#AEAEAE]">No data for selected filters</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={cycleData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#DDDBDA" />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#706E6B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#706E6B' }} unit="h" />
                  <Tooltip content={<CustomLineTooltip />} />
                  <ReferenceLine y={120} stroke="#C23934" strokeDasharray="4 4" label={{ value: '5d SLA', position: 'insideTopRight', fontSize: 10, fill: '#C23934' }} />
                  <Line
                    type="monotone"
                    dataKey="avg_hours"
                    name="Avg Cycle Time"
                    stroke="#0176D3"
                    strokeWidth={2}
                    dot={{ fill: '#0176D3', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Variance table */}
          <div className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-[#181818]">Stage Variance Analysis</h2>
                <p className="text-xs text-[#706E6B] mt-0.5">
                  High coefficient of variation (CV%) = inconsistent stage = bottleneck signal.
                  {highestVariance && (
                    <> <strong className="text-[#C23934]">{highestVariance.label}</strong> has the highest variance ({highestVariance.cv_percent}%).</>
                  )}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F3F3F3] border-b border-[#DDDBDA]">
                    {['Stage', 'Avg (h)', 'Std Dev (h)', 'CV%', 'Samples', 'SLA Limit', 'Status'].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-[#3E3E3C] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {varData.map((row, i) => {
                    const isHighVar  = row.cv_percent > 60;
                    const exceedsSla = row.exceeds_sla;
                    const isHighlight = row === highestVariance;
                    return (
                      <tr
                        key={row.stage}
                        className={`border-b border-[#DDDBDA] ${i % 2 === 1 ? 'bg-[#F9F9F9]' : 'bg-white'} ${isHighlight ? 'ring-1 ring-inset ring-[#C23934]' : ''}`}
                      >
                        <td className="px-3 py-2.5 font-medium text-[#181818]">{row.label}</td>
                        <td className={`px-3 py-2.5 ${exceedsSla ? 'text-[#C23934] font-semibold' : 'text-[#3E3E3C]'}`}>{row.avg_hours}</td>
                        <td className="px-3 py-2.5 text-[#3E3E3C]">{row.std_dev_hours}</td>
                        <td className="px-3 py-2.5">
                          <span className={`font-medium ${isHighVar ? 'text-[#C23934]' : 'text-[#3E3E3C]'}`}>
                            {row.cv_percent}%
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[#706E6B]">{row.count}</td>
                        <td className="px-3 py-2.5 text-[#706E6B]">{row.sla_threshold_hours ? `${row.sla_threshold_hours}h` : '—'}</td>
                        <td className="px-3 py-2.5">
                          {exceedsSla ? (
                            <span className="pill-red">Over SLA</span>
                          ) : (
                            <span className="pill-green">OK</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
