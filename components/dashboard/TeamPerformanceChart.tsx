import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface TeamMember {
  name: string;
  total: number;
  approved: number;
  pending: number;
  draft: number;
}

interface TeamPerformanceChartProps {
  data: TeamMember[];
}

export function TeamPerformanceChart({ data }: TeamPerformanceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Team Performance</h3>
        <p className="text-gray-500 text-center py-8">No data available</p>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold mb-4">Team Performance</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="approved" fill="#10b981" name="Approved" />
          <Bar dataKey="pending" fill="#f59e0b" name="Pending" />
          <Bar dataKey="draft" fill="#6b7280" name="Draft" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
