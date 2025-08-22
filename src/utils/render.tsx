import type { OwHero } from "../types";

export function renderHeroData(hero: OwHero, heroData: any) {
  return (
    <>
      <b>{hero.name}</b>
      <br />
      17赛季 竞技模式 黄金
      <br />
      <br />
      <text content={`禁用率：\t${heroData.banRatio}%`} />
      <br />
      <text content={`选择率：\t${heroData.selectionRatio}%`} />
      <br />
      <text content={`胜率：\t${heroData.winRatio}%`} />
      <br />
      <text content={`KDA：\t${heroData.kda}`} />
    </>
  );
}
