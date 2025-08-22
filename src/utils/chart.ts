import type { G2ChartOptions } from "@gjfleo/koishi-plugin-g2";
import type { OwHeroRoleEnum, OwRankEnum } from "../types";
import { ranks } from "./data";

interface PickRateChartOptions {
  leaderboardData: {
    name: string;
    pickRate: number;
    banRate: number;
    role: OwHeroRoleEnum;
  }[];
  seasonName: string;
  rankName: string;
}
export function getPickRateChart({
  leaderboardData,
  seasonName,
  rankName,
}: PickRateChartOptions): G2ChartOptions {
  return {
    width: 600,
    height: 1200,
    type: "view",
    data: {
      type: "inline",
      value: leaderboardData,
      transform: [
        { type: "rename", name: "英雄", pickRate: "选取率", banRate: "禁用率" },
        { type: "sortBy", fields: [["选取率", false]] },
        { type: "fold", fields: ["选取率", "禁用率"] },
      ],
    },
    paddingRight: 80,
    coordinate: { transform: [{ type: "transpose" }] },
    animate: false,
    interaction: { elementHighlight: { background: true } },
    children: [
      {
        type: "interval",
        encode: { x: "英雄", y: "选取率", color: "role" },
        scale: {
          color: {
            relations: [
              ["tank", "#FDBF6F"],
              ["damage", "#A6CEE3"],
              ["support", "#B2DF8A"],
            ],
          },
        },
        legend: { color: false },
        style: { maxWidth: 12 },
        animate: false,
        axis: {
          x: { title: false },
          y: {
            title: "选取率 (%)",
            position: "top",
            titlePosition: "right",
            titleOpacity: 0.5,
          },
        },
      },
      {
        type: "interval",
        encode: { x: "英雄", y: "禁用率" },
        scale: { y: { independent: true } },
        style: { fill: "#6A3D9A", maxWidth: 4 },
        animate: false,
        axis: {
          x: { title: false },
          y: {
            title: "禁用率 (%)",
            position: "bottom",
            titlePosition: "right",
            titleOpacity: 0.5,
            grid: false,
          },
        },
      },
    ],
    title: {
      title: "英雄选取率和禁用率",
      titleFontSize: 16,
      subtitle: `${seasonName} ${rankName}`,
      subtitleFontSize: 12,
      align: "center",
    },
    theme: {
      view: {
        viewFill: "white",
      },
    },
  };
}

interface HeroStatisticsChartOptions {
  data: {
    rank: OwRankEnum;
    pickRate: number;
    banRate: number;
    winRate: number;
  }[];
  heroName: string;
  width: number;
  height: number;
}
export function getHeroStatisticsChart({
  data,
  width,
  height,
}: HeroStatisticsChartOptions): G2ChartOptions {
  return {
    width,
    height,
    autoFit: true,
    type: "view",
    data: {
      type: "inline",
      value: data,
      transform: [
        { type: "rename", rank: "段位", pickRate: "选取率", banRate: "禁用率", winRate: "胜率" },
      ],
    },
    children: [
      {
        type: "interval",
        encode: {
          x: "段位",
          y: "选取率",
          color: "段位",
        },
        scale: {
          y: {
            domain: [0, 20],
          },
        },
        style: {
          fillOpacity: 0.75,
          columnWidthRatio: 0.5,
        },
        axis: {
          x: {
            title: false,
            labelFormatter: (v: OwRankEnum) => ranks[v],
            // labelFill: "white",
            labelFontSize: 20,
            labelOpacity: 0.75,
          },
          y: {
            // titleFill: "white",
            // labelFill: "white",
            // gridStroke: "white",
            // gridStrokeOpacity: 0.6,
          },
        },
      },
      {
        type: "point",
        encode: {
          x: "段位",
          y: "胜率",
          color: d => d["胜率"] >= 50 ? "high" : "low",
          shape: d => d["胜率"] >= 50 ? "high" : "low",
          size: 8,
        },
        scale: {
          y: {
            domain: [40, 60],
            independent: true,
          },
          shape: {
            relations: [
              ["high", "triangle"],
              ["low", "triangleDown"],
            ],
          },
        },
        axis: {
          y: {
            position: "right",
            // titleFill: "white",
            // labelFill: "white",
            grid: false,
          },
        },
      },
    ],
    scale: {
      color: {
        relations: [
          ["high", "#549E3F"],
          ["low", "#D0352B"],
          ["bronze", "#A25C37"],
          ["silver", "#727576"],
          ["gold", "#D9BC65"],
          ["platinum", "#A6C4D1"],
          ["diamond", "#ADC3E9"],
          ["master", "#C5DBD4"],
          ["grandmaster", "#A8ACD0"],
          ["grandmaster", "#C4B1D5"],
        ],
      },
    },
    legend: { color: false, shape: false },
    theme: {
      type: "dark",
      view: {
        viewFill: "rgba(0, 0, 0, 0.5)",
      },
    },
  };
}
