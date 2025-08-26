import type Cache from "@koishijs/cache";
import type { OwHero, OwRankEnum } from "../types";
import { ofetch } from "ofetch";
import { z } from "zod";
import { zHero, zSeason } from "../types";
import { zRank } from "./../types";

const fetchArmory = ofetch.create({
  baseURL: "https://webapi.blizzard.cn/ow-armory-server/",
});

const zArmoryResponse = z.object({
  code: z.number(),
  message: z.string(),
});

const zArmoryIndex = zArmoryResponse
  .extend({
    data: z.object({
      hero_configs: z.url(),
      seasons: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          desc: z.string(),
        }).transform(v => zSeason.parse({
          id: v.id,
          name: v.name,
          startDate: v.desc.substring(1, 11),
          endDate: v.desc.substring(12, 22),
        })),
      ),
    }).transform(v => ({
      heroConfigsUrl: v.hero_configs,
      seasons: v.seasons,
    })),
  })
  .transform(v => v.data);

const zHeroConfigs = z.object({
  heroConfigs: z.object({
    id: z.string(),
    name: z.string(),
    headSrc: z.url(),
    type: z.enum(["Tank", "Damage", "Support"]),
    picList: z.array(z.string()),
    // isNew: z.boolean().optional(),
  }).transform(v => zHero.parse({
    id: v.id,
    name: v.name,
    role: v.type.toLowerCase(),
    avatar: v.headSrc,
    pictures: {
      "960x666": v.picList[0],
      "1600x760": v.picList[1],
      "2600x760": v.picList[2],
    },
  } as OwHero)).array(),
}).transform(v => v.heroConfigs);

export async function fetchBaseData() {
  const res = await fetchArmory("/index");
  const data = zArmoryIndex.parse(res);

  const heroesRes = await ofetch(data.heroConfigsUrl);
  const heroes = zHeroConfigs.parse(heroesRes);

  return {
    seasons: data.seasons,
    heroes,
  };
}

const zArmoryLeaderboard = zArmoryResponse
  .extend({
    data: z.array(
      z.object({
        hero_id: z.string(),
        hero_type: z.enum(["1", "2", "3"]),
        selection_ratio: z.number(),
        ban_ratio: z.number(),
        win_ratio: z.number(),
        kda: z.number(),
        ds: z.string(),
      })
        .transform(v => ({
          heroId: v.hero_id,
          selectionRatio: v.selection_ratio,
          banRatio: v.ban_ratio,
          winRatio: v.win_ratio,
          kda: v.kda,
          date: v.ds,
        })),
    ),
  })
  .transform(v => v.data);
type ArmoryLeaderboardData = z.infer<typeof zArmoryLeaderboard>;

declare module "@koishijs/cache" {
  interface Tables {
    ow_leaderboard: ArmoryLeaderboardData;
  }
}

const zLeaderboardOptions = z.object({
  season: zSeason.shape.id,
  rank: zRank.optional(),
});
type LeaderboardOptions = z.infer<typeof zLeaderboardOptions>;
export async function fetchLeaderboard(options: LeaderboardOptions, cache: Cache) {
  const { season, rank } = options;

  const cacheKey = [season, rank].filter(Boolean).join(":");
  const cached = await cache.get("ow_leaderboard", cacheKey);
  if (cached) {
    return cached;
  }

  const query = zLeaderboardOptions
    .transform(v => ({
      season: v.season,
      mmr: v.rank ? (v.rank.charAt(0).toLocaleUpperCase() + v.rank.substring(1)) : "-127",
      game_mode: "jingji",
    }))
    .parse(options);
  const res = await fetchArmory("/hero_leaderboard", { query });
  const data = zArmoryLeaderboard.parse(res);

  await cache.set("ow_leaderboard", cacheKey, data, 12 * 60 * 60 * 1000);
  return data;
}

export const ranks: Record<OwRankEnum, string> = {
  bronze: "青铜",
  silver: "白银",
  gold: "黄金",
  platinum: "白金",
  diamond: "钻石",
  master: "大师",
  grandmaster: "宗师",
  champion: "英杰",
};
export function normalizeRank(rank?: string): z.infer<typeof zRank> | undefined {
  if (!rank || rank === "全段位") {
    return undefined;
  }
  if (rank.toLocaleUpperCase() in zRank.enum) {
    return rank.toLocaleUpperCase() as z.infer<typeof zRank>;
  }
  for (const [key, value] of Object.entries(ranks)) {
    if (value === rank) {
      return key as OwRankEnum;
    }
  }
  return undefined;
}

const heroAlias: Record<string, string> = {
  麦克雷: "卡西迪",
  士兵76: "士兵：76",
};
export function normalizeHeroId(keyword: string, heroes: Record<string, OwHero>) {
  if (heroAlias[keyword]) {
    return normalizeHeroId(heroAlias[keyword], heroes);
  }
  for (const [heroId, hero] of Object.entries(heroes)) {
    if (heroId === keyword.toLocaleLowerCase()) {
      return heroId;
    }
    if (hero.name.toLocaleLowerCase() === keyword.toLocaleLowerCase()) {
      return heroId;
    }
  }
  return undefined;
}
