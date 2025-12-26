'use client';

import { LineChart } from './LineChart';
import { BarChart } from './BarChart';
import { DoughnutChart } from './DoughnutChart';
import { PieChart } from './PieChart';
import type { ChartData } from '@/types/api';

interface ChartRendererProps {
  readonly chart: ChartData;
}

export function ChartRenderer({ chart }: ChartRendererProps) {
  const { type, data, options } = chart;

  // Default height for charts
  const chartHeight = '400px';

  switch (type) {
    case 'line':
      return (
        <div style={{ height: chartHeight }}>
          <LineChart data={data} options={options} />
        </div>
      );
    case 'bar':
      return (
        <div style={{ height: chartHeight }}>
          <BarChart data={data} options={options} />
        </div>
      );
    case 'doughnut':
      return (
        <div style={{ height: chartHeight }}>
          <DoughnutChart data={data} options={options} />
        </div>
      );
    case 'pie':
      return (
        <div style={{ height: chartHeight }}>
          <PieChart data={data} options={options} />
        </div>
      );
    default:
      return (
        <div className="p-4 text-sm text-gray-500 bg-gray-50 rounded">
          Unsupported chart type: {type}
        </div>
      );
  }
}

