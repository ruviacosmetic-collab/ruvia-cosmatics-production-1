"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function DashboardCharts({
  series = [],
  ordersByStatus = [],
  paymentBreakdown = [],
  currency,
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      <div className="xl:col-span-8 bg-white rounded-xl shadow-sm border border-brand-dark/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-serif text-xl font-bold text-brand-dark">Revenue & Orders</h2>
            <p className="text-xs text-brand-dark/50 font-medium">Daily trend (selected range)</p>
          </div>
        </div>

        <div className="h-80 min-h-[20rem]">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <AreaChart data={series} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF4FA3" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#FF4FA3" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="ordFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#111827" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#111827" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickMargin={8} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `${Math.round(Number(v || 0) / 1000)}k`}
              />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === "revenue") return [currency ? currency(value) : value, "Revenue"];
                  return [value, "Orders"];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="#FF4FA3"
                fill="url(#revFill)"
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="orders"
                name="Orders"
                stroke="#111827"
                fill="url(#ordFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="xl:col-span-4 grid grid-cols-1 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-brand-dark/10 p-6">
          <h2 className="font-serif text-xl font-bold text-brand-dark">Order status</h2>
          <p className="text-xs text-brand-dark/50 font-medium">Distribution</p>
          <div className="h-64 min-h-[16rem] mt-4">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <PieChart>
                <Tooltip />
                <Pie
                  data={ordersByStatus}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={48}
                  outerRadius={88}
                  paddingAngle={2}
                  fill="#FF4FA3"
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-brand-dark/10 p-6">
          <h2 className="font-serif text-xl font-bold text-brand-dark">Payment mix</h2>
          <p className="text-xs text-brand-dark/50 font-medium">COD vs Razorpay vs UPI</p>
          <div className="h-56 min-h-[14rem] mt-4">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <BarChart data={paymentBreakdown}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="method" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#111827" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

