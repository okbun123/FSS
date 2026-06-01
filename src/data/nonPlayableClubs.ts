import type { NonPlayableClub } from "../domain/types";

const POOL_INPUTS = [
  ["d5-gapyeong-valley", "가평 밸리", "경기"],
  ["d5-goesan-rangers", "괴산 레인저스", "충북"],
  ["d5-haenam-bay", "해남 베이", "전남"],
  ["d5-yecheon-arrows", "예천 애로우즈", "경북"],
  ["d5-hongcheon-rivers", "홍천 리버스", "강원"],
  ["d5-goseong-tide", "고성 타이드", "경남"],
  ["d5-muan-wings", "무안 윙스", "전남"],
  ["d5-taebaek-miners", "태백 마이너스", "강원"],
  ["d5-jangsu-peak", "장수 피크", "전북"],
  ["d5-uiryeong-field", "의령 필드", "경남"],
  ["d5-gunwi-cloud", "군위 클라우드", "경북"],
  ["d5-yeonggwang-light", "영광 라이트", "전남"],
  ["d5-hapcheon-lake", "합천 레이크", "경남"],
  ["d5-damyang-bamboo", "담양 밤부", "전남"],
  ["d5-inje-forest", "인제 포레스트", "강원"],
  ["d5-buan-salt", "부안 솔트", "전북"],
  ["d5-uiseong-grain", "의성 그레인", "경북"],
  ["d5-cheorwon-plain", "철원 플레인", "강원"],
  ["d5-sunchang-peppers", "순창 페퍼스", "전북"],
  ["d5-sancheong-herons", "산청 헤론스", "경남"],
  ["d5-gokseong-rail", "곡성 레일", "전남"],
  ["d5-jeongseon-slope", "정선 슬로프", "강원"],
  ["d5-okcheon-garden", "옥천 가든", "충북"],
  ["d5-hamyang-pines", "함양 파인스", "경남"],
  ["d5-bonghwa-stars", "봉화 스타즈", "경북"],
  ["d5-seocheon-marsh", "서천 마시", "충남"],
  ["d5-jindo-harbor", "진도 하버", "전남"],
  ["d5-eumseong-core", "음성 코어", "충북"],
  ["d5-yeongam-motors", "영암 모터스", "전남"],
  ["d5-uljin-wave", "울진 웨이브", "경북"],
] as const;

function getPoolResult(index: number): string {
  const position = (index % 10) + 1;
  const group = ["중부", "남부", "동부", "서부"][index % 4];

  return `5부 ${group} 권역 ${position}위`;
}

export const NON_PLAYABLE_D5_CLUBS: NonPlayableClub[] = POOL_INPUTS.map(([id, name, region], index) => {
  const reputationStars = 1 + (index % 3);
  const squadStrengthStars = 1 + ((index + 1) % 3);
  const budgetStars = 1 + ((index + 2) % 3);
  const youthOpportunityStars = 2 + (index % 4 === 0 ? 2 : index % 3);
  const trainingFacilityStars = 2 + ((index + 1) % 3);

  return {
    id,
    name,
    region,
    reputationStars,
    squadStrengthStars,
    budgetStars,
    youthOpportunityStars: Math.min(5, youthOpportunityStars),
    trainingFacilityStars,
    licenseEligible: index % 4 !== 0,
    promotionWeight: 8 + reputationStars * 2 + squadStrengthStars * 3 + (index % 5),
    lastPoolResult: getPoolResult(index),
  };
});
