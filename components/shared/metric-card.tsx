"use client"

import { LucideIcon } from "lucide-react"

interface MetricCardProps {
  title: string
  value: string | number
  description: string
  icon: LucideIcon
  trend?: string
  className?: string
}

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className = ""
}: MetricCardProps) {
  return (
    <div className={`group bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:scale-105 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl group-hover:scale-110 transition-transform duration-300">
          <Icon className="w-6 h-6 text-white" />
        </div>
        {trend && (
          <div className="flex items-center text-emerald-400 text-xs font-medium">
            <span className="mr-1">↗</span>
            {trend}
          </div>
        )}
      </div>
      <h3 className="text-2xl font-bold text-white mb-1">{value}</h3>
      <p className="text-slate-400 text-sm mb-2">{title}</p>
      <p className="text-slate-500 text-xs">{description}</p>
    </div>
  )
}