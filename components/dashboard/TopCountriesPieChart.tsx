'use client';

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface CountryData {
  country: string;
  count: number;
}

export interface TopCountriesPieChartProps {
  data: CountryData[];
  title?: string;
}

const COLORS = [
  '#2563EB', // primary blue
  '#0EA5E9', // sky blue
  '#0891B2', // cyan
  '#06B6D4', // teal-cyan
  '#3B82F6', // blue-400
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#14B8A6', // teal
];

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { country: string } }[];
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-white border border-border rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="font-semibold text-gray-700">{name}</p>
      <p className="text-gray-500">
        Quotations: <span className="font-bold text-gray-900">{value}</span>
      </p>
    </div>
  );
};

const CustomLegend = ({
  payload,
}: {
  payload?: { value: string; color: string }[];
}) => {
  if (!payload) return null;
  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3">
      {payload.map((entry, i) => (
        <li key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          {entry.value}
        </li>
      ))}
    </ul>
  );
};

const TopCountriesPieChart: React.FC<TopCountriesPieChartProps> = ({
  data,
  title = 'Top Countries by Quotations',
}) => {
  const chartData = data.map((d) => ({ name: d.country, value: d.count }));

  return (
    <div className="card p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TopCountriesPieChart;
