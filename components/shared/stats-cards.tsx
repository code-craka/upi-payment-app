'use client';

import { LucideIcon } from 'lucide-react';
import { MetricCard } from './metric-card';

export interface MetricData {
  id: string;
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  trend?: string;
}

interface StatsCardsProps {
  metrics: MetricData[];
  className?: string;
}

export function StatsCards({ metrics, className = '' }: StatsCardsProps) {
  return (
    <div className={`grid gap-6 md:grid-cols-2 lg:grid-cols-4 ${className}`}>
      {metrics.map((metric) => (
        <MetricCard
          key={metric.id}
          title={metric.title}
          value={metric.value}
          description={metric.description}
          icon={metric.icon}
          trend={metric.trend}
        />
      ))}
    </div>
  );
}
