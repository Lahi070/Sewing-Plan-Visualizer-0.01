import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { ReadinessStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return "0";
  return new Intl.NumberFormat("en-US").format(Math.round(num));
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "-";
  try {
    const parts = dateStr.split("T")[0].split("-");
    if (parts.length === 3) {
      const year = parts[0];
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${day} ${months[month - 1]} ${year}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export function getStatusConfig(status: ReadinessStatus) {
  switch (status) {
    case "READY":
      return {
        label: "Ready",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-600/20",
        pillClass: "bg-emerald-500",
        textClass: "text-emerald-700",
        borderClass: "border-emerald-500",
        iconName: "CheckCircle2",
        hexColor: "#10b981",
        description: "Both Knitting fabric and Trims are verified and complete.",
      };
    case "AT_RISK":
      return {
        label: "At Risk",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-300 ring-amber-600/20 animate-pulse",
        pillClass: "bg-amber-500",
        textClass: "text-amber-700",
        borderClass: "border-amber-500",
        iconName: "AlertTriangle",
        hexColor: "#f59e0b",
        description: "Not yet ready, but planned sewing date is within 3 days.",
      };
    case "NOT_READY":
      return {
        label: "Not Ready / Delayed",
        badgeClass: "bg-rose-50 text-rose-800 border-rose-300 ring-rose-600/20",
        pillClass: "bg-rose-500",
        textClass: "text-rose-700",
        borderClass: "border-rose-500",
        iconName: "XCircle",
        hexColor: "#ef4444",
        description: "Prerequisites missing and planned sewing date is today or in the past.",
      };
    case "UPCOMING":
      return {
        label: "Upcoming",
        badgeClass: "bg-slate-100 text-slate-700 border-slate-200 ring-slate-600/10",
        pillClass: "bg-slate-400",
        textClass: "text-slate-600",
        borderClass: "border-slate-400",
        iconName: "Clock",
        hexColor: "#64748b",
        description: "Not ready yet, but planned sewing date is more than 3 days away.",
      };
    case "NO_DATA":
      return {
        label: "No Data",
        badgeClass: "bg-gray-100 text-gray-600 border-gray-300 ring-gray-600/10",
        pillClass: "bg-gray-400",
        textClass: "text-gray-500",
        borderClass: "border-gray-400",
        iconName: "HelpCircle",
        hexColor: "#94a3b8",
        description: "SO_LI not found in Knitting and/or Trims readiness datasets.",
      };
  }
}
