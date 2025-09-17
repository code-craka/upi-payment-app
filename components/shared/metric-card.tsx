'use client';

import { 
  CreditCard, 
  ShoppingCart, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Activity,
  Package,
  Target,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';

// Icon mapping
const iconMap = {
  CreditCard,
  ShoppingCart,
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  Package,
  Target,
  Clock,
  CheckCircle,
  XCircle,
};

interface MetricCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: string; // Changed from LucideIcon to string
  trend?: string;
  className?: string;
}

export function MetricCard({
  title,
  value,
  description,
  icon,
  trend,
  className = '',
}: MetricCardProps) {
  // Get the icon component from the string name
  const IconComponent = iconMap[icon as keyof typeof iconMap] || CreditCard;

  return (
    <div
      className={`group rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-indigo-500/10 ${className}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 p-3 transition-transform duration-300 group-hover:scale-110">
          <IconComponent className="h-6 w-6 text-white" />
        </div>
        {trend && (
          <div className="flex items-center text-xs font-medium text-emerald-400">
            <span className="mr-1">↗</span>
            {trend}
          </div>
        )}
      </div>
      <h3 className="mb-1 text-2xl font-bold text-white">{value}</h3>
      <p className="mb-2 text-sm text-slate-400">{title}</p>
      <p className="text-xs text-slate-500">{description}</p>
    </div>
  );
}
