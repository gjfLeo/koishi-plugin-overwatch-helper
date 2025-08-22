import type {} from "@koishijs/cache";
import z from "zod";

export const zSeason = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
});
export type OwSeason = z.infer<typeof zSeason>;

export const zHeroRole = z.enum(["tank", "damage", "support"]);
export const zHero = z.object({
  id: z.string(),
  name: z.string(),
  role: zHeroRole,
  avatar: z.url(),
  pictures: z.object({
    "960x666": z.url(),
    "1600x760": z.url(),
    "2600x760": z.url(),
  }),
});
export type OwHeroRoleEnum = z.infer<typeof zHeroRole>;
export type OwHero = z.infer<typeof zHero>;

export const zRank = z.enum(["bronze", "silver", "gold", "platinum", "diamond", "master", "grandmaster", "champion"]);
export type OwRankEnum = z.infer<typeof zRank>;
