import type {} from "@gjfleo/koishi-plugin-g2";
import type { Context, Session } from "koishi";

import type { OwHero, OwRankEnum, OwSeason } from "./types";

import { h, Schema } from "koishi";
import { Extension, Failed, Success, Tool, withInnerThoughts } from "koishi-plugin-yesimbot/services";
import { Services } from "koishi-plugin-yesimbot/shared";
import { zRank } from "./types";
import { getHeroStatisticsChart, getPickRateChart } from "./utils/chart";
import { fetchBaseData, fetchLeaderboard, normalizeHeroId, normalizeRank, ranks } from "./utils/data";

interface ConfigType {}

@Extension({
  name: "ow-helper",
  display: "守望先锋助手",
  description: "提供《守望先锋》相关的功能。",
  author: "gjfleo",
  version: "1.0.0",
})
export default class OverwatchHelper {
  static name = "ow-helper";
  static inject = {
    required: ["cache", "g2", "skia"],
    optional: [Services.Tool],
  };

  static Config: Schema<ConfigType> = Schema.object({});

  latestSeason: OwSeason | null = null;

  heroes: Record<string, OwHero> = {};
  seasons: Record<string, OwSeason> = {};

  constructor(public ctx: Context, public config: ConfigType) {
    ctx.on("ready", async () => {
      await this.initData();
    });

    ctx.command("ow", "守望先锋助手");

    ctx.command("ow.选取率 [段位]", "根据段位（可选）查询选取率统计图")
      .alias("ow.使用率")
      .action(async ({ session }, rank) => {
        this.sendPickRateActionChart({ session, rank });
      });

    ctx.command("ow.英雄 <英雄>", "查询指定英雄的统计数据")
      .action(async ({ session }, hero) => {
        this.sendHeroStatisticsChart({ session, hero });
      });
  }

  private async initData() {
    const data = await fetchBaseData();
    this.heroes = Object.fromEntries(
      data.heroes.map(hero => [hero.id, hero]),
    );
    this.seasons = Object.fromEntries(
      data.seasons.map(season => [season.id, season]),
    );
    this.latestSeason = data.seasons[0];

    this.ctx.logger.info(
      "初始化数据完成，最新赛季：%s，英雄数量：%d",
      this.latestSeason?.name,
      data.heroes.length,
    );
  }

  @Tool({
    name: "ow-helper-pick-rate",
    description: "发送《守望先锋》英雄选取率和禁用率统计图。",
    parameters: withInnerThoughts({
      rank: Schema
        .string()
        .required(false)
        .description("要查询的段位，不填则不限段位"),
    }),
  })
  private async sendPickRateActionChart({
    session,
    rank,
  }: { session: Session; rank?: string }) {
    if (!session) {
      return Failed("只能在会话上下文中使用");
    }
    const normalizedRank = normalizeRank(rank);
    const rankName = rank ? ranks[rank] : "全段位";

    const leaderboard = await fetchLeaderboard({
      season: this.latestSeason?.id,
      rank: normalizedRank,
    }, this.ctx.cache);
    const leaderboardData = leaderboard.map((item) => {
      const hero = this.heroes[item.heroId];
      return {
        id: hero.id,
        name: hero.name,
        role: hero.role,
        pickRate: item.selectionRatio,
        banRate: item.banRatio,
      };
    });

    const chart = await this.ctx.g2.createChart(
      getPickRateChart({
        leaderboardData,
        seasonName: this.latestSeason?.name,
        rankName,
      }),
    );
    const dataUrl = await chart.toDataURL("png");
    session.send(h("img", { src: dataUrl }));
    return Success();
  }

  @Tool({
    name: "ow-helper-hero-statistics",
    description: "发送《守望先锋》特定英雄的各段位统计信息图。",
    parameters: withInnerThoughts({
      hero: Schema
        .string()
        .required(true)
        .description("要查询的英雄"),
    }),
  })
  private async sendHeroStatisticsChart({
    session,
    hero,
  }) {
    if (!session) {
      return Failed("只能在会话上下文中使用");
    }
    const heroId = normalizeHeroId(hero, this.heroes);
    if (!heroId) {
      return Failed("未找到指定英雄");
    }
    const heroData = this.heroes[heroId];

    const data: {
      rank: OwRankEnum;
      pickRate: number;
      banRate: number;
      winRate: number;
    }[] = [];
    let date: string;
    for (const rank of zRank.options) {
      const leaderboard = await fetchLeaderboard({
        season: this.latestSeason?.id,
        rank,
      }, this.ctx.cache);
      const item = leaderboard.find(item => item.heroId === heroId);
      if (item) {
        date = item.date;
        data.push({
          rank,
          pickRate: item.selectionRatio,
          banRate: item.banRatio,
          winRate: item.winRatio,
        });
      }
    }

    const canvas = new this.ctx.skia.Canvas(800, 450);
    const backgroundImage = await this.ctx.skia.loadImage(heroData.pictures["960x666"]);
    const canvasContext = canvas.getContext("2d");
    canvasContext.drawImage(backgroundImage, -80, 0);
    // {
    //   const [x, y, w, h, r] = [30, 30, 900, 300, 10];
    //   canvasContext.save();
    //   canvasContext.beginPath();
    //   canvasContext.moveTo(x + r, y);
    //   canvasContext.lineTo(x + w - r, y);
    //   canvasContext.arcTo(x + w, y, x + w, y + r, r);
    //   canvasContext.lineTo(x + w, y + h - r);
    //   canvasContext.arcTo(x + w, y + h, x + w - r, y + h, r);
    //   canvasContext.lineTo(x + r, y + h);
    //   canvasContext.arcTo(x, y + h, x, y + h - r, r);
    //   canvasContext.lineTo(x, y + r);
    //   canvasContext.arcTo(x, y, x + r, y, r);
    //   canvasContext.closePath();
    //   canvasContext.clip();
    //   canvasContext.drawCanvas(chart, x, y, w, h);
    //   canvasContext.restore();
    // }

    const chart = await this.ctx.g2.createChart(
      getHeroStatisticsChart({
        data,
        heroName: this.heroes[heroId].name,
        width: canvas.width,
        height: canvas.height,
      }),
    );
    canvasContext.drawCanvas(chart, 0, 0, canvas.width, canvas.height);

    canvasContext.textAlign = "center";
    canvasContext.textBaseline = "top";
    canvasContext.fillStyle = "rgba(255, 255, 255, 0.25)";
    canvasContext.fillText(`国服 ${date} 数据来源于官网`, canvas.width / 2, 10);

    const dataUrl = await canvas.toDataURL("png");
    session.send(h("img", { src: dataUrl }));
    return Success();
  }
}
