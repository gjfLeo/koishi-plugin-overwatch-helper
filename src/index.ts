import type {} from "@gjfleo/koishi-plugin-g2";
import type { Context, Session } from "koishi";

import type { OwHero, OwRankEnum, OwSeason } from "./types";

import { h, Schema } from "koishi";
import { zRank } from "./types";
import { getHeroStatisticsChart, getPickRateChart } from "./utils/chart";
import { fetchBaseData, fetchLeaderboard, normalizeHeroId, normalizeRank, ranks } from "./utils/data";

interface ConfigType {}

export default class OverwatchHelper {
  static name = "ow-helper";
  static inject = {
    required: ["cache", "g2", "skia"],
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

    ctx.command("ow.使用率 [段位]", "根据段位（可选）查询选取率统计图")
      .alias("ow.选取率")
      .action(async ({ session }, rank) => {
        this.sendPickRateActionChart({ session, rank });
      });

    ctx.command("ow.英雄 <英雄名称>", "查询指定英雄的统计数据")
      .action(async ({ session }, hero) => {
        this.sendHeroStatisticsChart({ session, heroName: hero });
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

  private async sendPickRateActionChart({ session, rank }: {
    session: Session;
    rank?: string;
  }) {
    if (!session) {
      throw new Error("只能在会话上下文中使用");
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
  }

  private async sendHeroStatisticsChart({ session, heroName }: {
    session: Session;
    heroName?: string;
  }) {
    if (!session) {
      throw new Error("只能在会话上下文中使用");
    }
    const heroId = normalizeHeroId(heroName, this.heroes);
    if (!heroId) {
      session.send(`未找到指定英雄。全部英雄：${Object.values(this.heroes).map(hero => hero.name).join("、")}`);
      return;
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
    canvasContext.fillText(`统计于${date} 数据来源于国服官网`, canvas.width / 2, 10);

    const dataUrl = await canvas.toDataURL("png");
    session.send(h("img", { src: dataUrl }));
  }
}
