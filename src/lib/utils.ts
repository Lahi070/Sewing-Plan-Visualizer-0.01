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
        badgeClass: "bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-emerald-glow",
        pillClass: "bg-emerald-500",
        textClass: "text-emerald-400",
        borderClass: "border-emerald-500",
        iconName: "CheckCircle2",
        hexColor: "#10b981",
        description: "Both Knitting fabric and Trims are verified and complete.",
      };
    case "AT_RISK":
      return {
        label: "At Risk",
        badgeClass: "bg-amber-950/80 text-amber-300 border-amber-500/40 shadow-amber-glow animate-pulse",
        pillClass: "bg-amber-500",
        textClass: "text-amber-400",
        borderClass: "border-amber-500",
        iconName: "AlertTriangle",
        hexColor: "#f59e0b",
        description: "Not yet ready, but planned sewing date is within 3 days.",
      };
    case "NOT_READY":
      return {
        label: "Not Ready / Delayed",
        badgeClass: "bg-rose-950/80 text-rose-300 border-rose-500/40 shadow-rose-glow",
        pillClass: "bg-rose-500",
        textClass: "text-rose-400",
        borderClass: "border-rose-500",
        iconName: "XCircle",
        hexColor: "#f43f5e",
        description: "Prerequisites missing and planned sewing date is today or in the past.",
      };
    case "UPCOMING":
      return {
        label: "Upcoming",
        badgeClass: "bg-sky-950/80 text-sky-300 border-sky-500/40 shadow-cyan-glow",
        pillClass: "bg-sky-400",
        textClass: "text-sky-400",
        borderClass: "border-sky-500",
        iconName: "Clock",
        hexColor: "#38bdf8",
        description: "Not ready yet, but planned sewing date is more than 3 days away.",
      };
    case "NO_DATA":
      return {
        label: "No Data",
        badgeClass: "bg-slate-900/90 text-slate-400 border-slate-700/60 shadow-navy-glow",
        pillClass: "bg-slate-500",
        textClass: "text-slate-400",
        borderClass: "border-slate-600",
        iconName: "HelpCircle",
        hexColor: "#94a3b8",
        description: "SO_LI not found in Knitting and/or Trims readiness datasets.",
      };
  }
}
