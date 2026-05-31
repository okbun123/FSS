import type {
  Club,
  ClubTrainingFacilities,
  Competition,
  Fixture,
  League,
  LeagueTier,
} from "../domain/types";
import { getLeagueRuleSet } from "../domain/leagueRules";

export const K1_LEAGUE_ID = "k1_fictional" satisfies LeagueTier;
export const K2_LEAGUE_ID = "k2_fictional" satisfies LeagueTier;
export const K3_LEAGUE_ID = "k3_fictional" satisfies LeagueTier;
export const K4_LEAGUE_ID = "k4_fictional" satisfies LeagueTier;
export const K1_COMPETITION_ID = "competition-k1-fictional";
export const K2_COMPETITION_ID = "competition-k2-fictional";
export const K3_COMPETITION_ID = "competition-k3-fictional";
export const K4_COMPETITION_ID = "competition-k4-fictional";
export const DOMESTIC_CUP_COMPETITION_ID = "competition-korea-challenge-cup";
export const DOMESTIC_CUP_NAME = "코리아 챌린지컵";

export const K1_RULE_SET = getLeagueRuleSet(K1_LEAGUE_ID, 2027);
export const K2_RULE_SET = getLeagueRuleSet(K2_LEAGUE_ID, 2027);
export const K3_RULE_SET = getLeagueRuleSet(K3_LEAGUE_ID, 2027);
export const K4_RULE_SET = getLeagueRuleSet(K4_LEAGUE_ID, 2027);

function facilities(
  technicalTraining: number,
  physicalTraining: number,
  tacticalTraining: number,
  mentalTraining: number,
  youthDevelopment: number,
  medicalSupport: number,
): ClubTrainingFacilities {
  return {
    technicalTraining,
    physicalTraining,
    tacticalTraining,
    mentalTraining,
    youthDevelopment,
    medicalSupport,
  };
}

interface ClubInput {
  id: string;
  name: string;
  shortName: string;
  city: string;
  leagueId: LeagueTier;
  reputation: number;
  squadStrength: number;
  budgetLevel: number;
  primaryColor: string;
  trainingFacilities: ClubTrainingFacilities;
  playStyle: string;
  youthOpportunity: number;
  transferPolicy: string;
  depth: number;
  averageAge: number;
}

function club(input: ClubInput): Club {
  return {
    ...input,
    tier: input.leagueId,
    strength: input.squadStrength,
    squadLevel: input.squadStrength,
    secondaryColor: "보조색 없음",
    squadSummary: {
      averageOvr: input.squadStrength,
      averageAge: input.averageAge,
      depth: input.depth,
      style: input.playStyle,
    },
    seasonRecords: [],
  };
}

export const K1_CLUBS: Club[] = [
  club({
    id: "seoul-hangang-eclipse",
    name: "서울 한강 이클립스",
    shortName: "한강",
    city: "서울",
    leagueId: K1_LEAGUE_ID,
    reputation: 84,
    squadStrength: 77,
    budgetLevel: 88,
    primaryColor: "검정",
    trainingFacilities: facilities(86, 78, 87, 82, 80, 84),
    playStyle: "점유율 기반 전환 공격",
    youthOpportunity: 58,
    transferPolicy: "스타 영입과 수도권 유망주를 병행",
    depth: 84,
    averageAge: 26,
  }),
  club({
    id: "busan-harbor-blue",
    name: "부산 항만 블루",
    shortName: "항만",
    city: "부산",
    leagueId: K1_LEAGUE_ID,
    reputation: 76,
    squadStrength: 72,
    budgetLevel: 72,
    primaryColor: "항만 파랑",
    trainingFacilities: facilities(78, 81, 76, 74, 72, 79),
    playStyle: "측면 속도와 빠른 역습",
    youthOpportunity: 66,
    transferPolicy: "해외 경험자와 지역 선수 혼합",
    depth: 75,
    averageAge: 25,
  }),
  club({
    id: "incheon-gateway",
    name: "인천 게이트웨이",
    shortName: "게이트",
    city: "인천",
    leagueId: K1_LEAGUE_ID,
    reputation: 71,
    squadStrength: 69,
    budgetLevel: 64,
    primaryColor: "짙은 남색",
    trainingFacilities: facilities(71, 76, 75, 72, 76, 75),
    playStyle: "직선적인 압박과 세컨드볼",
    youthOpportunity: 70,
    transferPolicy: "실용적인 자유계약과 임대 활용",
    depth: 69,
    averageAge: 26,
  }),
  club({
    id: "daegu-palgong-red",
    name: "대구 팔공 레드",
    shortName: "팔공",
    city: "대구",
    leagueId: K1_LEAGUE_ID,
    reputation: 73,
    squadStrength: 70,
    budgetLevel: 68,
    primaryColor: "진홍",
    trainingFacilities: facilities(74, 78, 73, 76, 71, 76),
    playStyle: "강한 압박 후 빠른 마무리",
    youthOpportunity: 68,
    transferPolicy: "활동량 높은 국내 선수 선호",
    depth: 71,
    averageAge: 25,
  }),
  club({
    id: "daejeon-science-stars",
    name: "대전 사이언스 스타즈",
    shortName: "스타즈",
    city: "대전",
    leagueId: K1_LEAGUE_ID,
    reputation: 75,
    squadStrength: 72,
    budgetLevel: 78,
    primaryColor: "보라",
    trainingFacilities: facilities(81, 73, 83, 79, 84, 77),
    playStyle: "전술 실험과 유스 기용",
    youthOpportunity: 82,
    transferPolicy: "데이터 기반 영입과 재판매",
    depth: 73,
    averageAge: 24,
  }),
  club({
    id: "gwangju-mudeung-light",
    name: "광주 무등 라이트",
    shortName: "무등",
    city: "광주",
    leagueId: K1_LEAGUE_ID,
    reputation: 68,
    squadStrength: 68,
    budgetLevel: 58,
    primaryColor: "밝은 노랑",
    trainingFacilities: facilities(76, 72, 79, 80, 83, 72),
    playStyle: "젊은 선수 중심 빌드업",
    youthOpportunity: 86,
    transferPolicy: "아카데미 승격과 저비용 보강",
    depth: 68,
    averageAge: 24,
  }),
  club({
    id: "ulsan-shipyard-wave",
    name: "울산 조선 웨이브",
    shortName: "웨이브",
    city: "울산",
    leagueId: K1_LEAGUE_ID,
    reputation: 83,
    squadStrength: 78,
    budgetLevel: 86,
    primaryColor: "청록",
    trainingFacilities: facilities(83, 83, 85, 79, 76, 85),
    playStyle: "완성도 높은 조직 축구",
    youthOpportunity: 55,
    transferPolicy: "검증된 주전급 선수 영입",
    depth: 85,
    averageAge: 27,
  }),
  club({
    id: "suwon-hwaseong-knights",
    name: "수원 화성 나이츠",
    shortName: "화성",
    city: "수원",
    leagueId: K1_LEAGUE_ID,
    reputation: 76,
    squadStrength: 69,
    budgetLevel: 70,
    primaryColor: "왕실 파랑",
    trainingFacilities: facilities(73, 75, 75, 77, 81, 79),
    playStyle: "균형 잡힌 4백과 세트피스",
    youthOpportunity: 74,
    transferPolicy: "수도권 유망주와 베테랑 조합",
    depth: 70,
    averageAge: 25,
  }),
  club({
    id: "jeju-oreum-winds",
    name: "제주 오름 윈즈",
    shortName: "오름",
    city: "제주",
    leagueId: K1_LEAGUE_ID,
    reputation: 70,
    squadStrength: 68,
    budgetLevel: 63,
    primaryColor: "주황",
    trainingFacilities: facilities(74, 80, 71, 74, 75, 81),
    playStyle: "체력과 공간 침투",
    youthOpportunity: 72,
    transferPolicy: "기동력 있는 선수와 임대 영입",
    depth: 67,
    averageAge: 25,
  }),
  club({
    id: "jeonju-hanbyeok-city",
    name: "전주 한벽 시티",
    shortName: "한벽",
    city: "전주",
    leagueId: K1_LEAGUE_ID,
    reputation: 81,
    squadStrength: 75,
    budgetLevel: 84,
    primaryColor: "녹색",
    trainingFacilities: facilities(84, 79, 83, 82, 77, 81),
    playStyle: "정교한 패스 전개",
    youthOpportunity: 60,
    transferPolicy: "우승 경쟁용 즉시 전력 확보",
    depth: 81,
    averageAge: 27,
  }),
  club({
    id: "gangwon-seorak-snow",
    name: "강원 설악 스노우",
    shortName: "설악",
    city: "강원",
    leagueId: K1_LEAGUE_ID,
    reputation: 66,
    squadStrength: 66,
    budgetLevel: 52,
    primaryColor: "설백",
    trainingFacilities: facilities(68, 82, 68, 72, 74, 72),
    playStyle: "높은 활동량과 롱볼 전환",
    youthOpportunity: 78,
    transferPolicy: "저평가 자원 발굴",
    depth: 65,
    averageAge: 24,
  }),
  club({
    id: "cheongju-jikji-royals",
    name: "청주 직지 로얄즈",
    shortName: "직지",
    city: "청주",
    leagueId: K1_LEAGUE_ID,
    reputation: 65,
    squadStrength: 65,
    budgetLevel: 50,
    primaryColor: "자주",
    trainingFacilities: facilities(70, 70, 72, 74, 79, 70),
    playStyle: "촘촘한 수비 블록",
    youthOpportunity: 82,
    transferPolicy: "승격 유지형 실속 영입",
    depth: 64,
    averageAge: 25,
  }),
  club({
    id: "anyang-bisan-arrows",
    name: "안양 비산 애로우즈",
    shortName: "비산",
    city: "안양",
    leagueId: K1_LEAGUE_ID,
    reputation: 64,
    squadStrength: 64,
    budgetLevel: 48,
    primaryColor: "보라빛 남색",
    trainingFacilities: facilities(72, 72, 70, 76, 85, 70),
    playStyle: "유망주 중심 압박",
    youthOpportunity: 88,
    transferPolicy: "아카데미와 임대 시장 중시",
    depth: 63,
    averageAge: 23,
  }),
  club({
    id: "gimcheon-garam-phoenix",
    name: "김천 가람 피닉스",
    shortName: "가람",
    city: "김천",
    leagueId: K1_LEAGUE_ID,
    reputation: 67,
    squadStrength: 67,
    budgetLevel: 55,
    primaryColor: "적갈색",
    trainingFacilities: facilities(70, 76, 74, 76, 73, 77),
    playStyle: "전환 속도와 조직 압박",
    youthOpportunity: 76,
    transferPolicy: "시민 구단형 단기 보강",
    depth: 67,
    averageAge: 25,
  }),
];

export const K2_CLUBS: Club[] = [
  club({
    id: "bucheon-rose-banners",
    name: "부천 로즈 배너스",
    shortName: "로즈",
    city: "부천",
    leagueId: K2_LEAGUE_ID,
    reputation: 63,
    squadStrength: 62,
    budgetLevel: 49,
    primaryColor: "장미색",
    trainingFacilities: facilities(64, 60, 63, 62, 74, 60),
    playStyle: "자유로운 전방 압박",
    youthOpportunity: 82,
    transferPolicy: "젊은 공격수 발굴",
    depth: 62,
    averageAge: 24,
  }),
  club({
    id: "seongnam-tancheon-ravens",
    name: "성남 탄천 레이븐즈",
    shortName: "탄천",
    city: "성남",
    leagueId: K2_LEAGUE_ID,
    reputation: 66,
    squadStrength: 63,
    budgetLevel: 56,
    primaryColor: "검정",
    trainingFacilities: facilities(66, 64, 67, 64, 72, 63),
    playStyle: "수비 조직과 역습",
    youthOpportunity: 78,
    transferPolicy: "재도약형 베테랑 보강",
    depth: 65,
    averageAge: 26,
  }),
  club({
    id: "mokpo-maritime-anchors",
    name: "목포 해양 앵커스",
    shortName: "앵커스",
    city: "목포",
    leagueId: K2_LEAGUE_ID,
    reputation: 55,
    squadStrength: 58,
    budgetLevel: 40,
    primaryColor: "바다 청록",
    trainingFacilities: facilities(58, 59, 58, 60, 69, 58),
    playStyle: "낮은 블록 후 역습",
    youthOpportunity: 79,
    transferPolicy: "지역 선수와 자유계약 위주",
    depth: 56,
    averageAge: 24,
  }),
  club({
    id: "gyeongnam-namgang-crest",
    name: "경남 남강 크레스트",
    shortName: "남강",
    city: "경남",
    leagueId: K2_LEAGUE_ID,
    reputation: 61,
    squadStrength: 61,
    budgetLevel: 51,
    primaryColor: "선홍",
    trainingFacilities: facilities(62, 64, 62, 61, 70, 62),
    playStyle: "측면 크로스와 세트피스",
    youthOpportunity: 73,
    transferPolicy: "승격 경험자 선호",
    depth: 61,
    averageAge: 25,
  }),
  club({
    id: "ansan-choji-wave",
    name: "안산 초지 웨이브",
    shortName: "초지",
    city: "안산",
    leagueId: K2_LEAGUE_ID,
    reputation: 54,
    squadStrength: 56,
    budgetLevel: 38,
    primaryColor: "푸른 초록",
    trainingFacilities: facilities(58, 61, 58, 59, 75, 59),
    playStyle: "젊은 압박과 빠른 전진",
    youthOpportunity: 87,
    transferPolicy: "임대와 신인 계약 중심",
    depth: 55,
    averageAge: 23,
  }),
  club({
    id: "pohang-sunrise-forge",
    name: "포항 해돋이 포지",
    shortName: "포지",
    city: "포항",
    leagueId: K2_LEAGUE_ID,
    reputation: 65,
    squadStrength: 64,
    budgetLevel: 61,
    primaryColor: "강철 회색",
    trainingFacilities: facilities(67, 69, 66, 64, 68, 66),
    playStyle: "강한 피지컬과 직선 전개",
    youthOpportunity: 66,
    transferPolicy: "산업 도시형 실전파 영입",
    depth: 65,
    averageAge: 26,
  }),
  club({
    id: "chuncheon-lake-rangers",
    name: "춘천 호반 레인저스",
    shortName: "호반",
    city: "춘천",
    leagueId: K2_LEAGUE_ID,
    reputation: 53,
    squadStrength: 55,
    budgetLevel: 35,
    primaryColor: "하늘색",
    trainingFacilities: facilities(56, 62, 56, 59, 71, 58),
    playStyle: "수비 집중과 역습",
    youthOpportunity: 80,
    transferPolicy: "저비용 유망주 육성",
    depth: 54,
    averageAge: 24,
  }),
  club({
    id: "yeosu-bay-lights",
    name: "여수 베이 라이트",
    shortName: "베이",
    city: "여수",
    leagueId: K2_LEAGUE_ID,
    reputation: 55,
    squadStrength: 57,
    budgetLevel: 42,
    primaryColor: "청록",
    trainingFacilities: facilities(59, 63, 58, 61, 70, 60),
    playStyle: "빠른 측면 전개",
    youthOpportunity: 77,
    transferPolicy: "기동력 있는 선수 선호",
    depth: 56,
    averageAge: 24,
  }),
  club({
    id: "goyang-starfield",
    name: "고양 별무리",
    shortName: "별무리",
    city: "고양",
    leagueId: K2_LEAGUE_ID,
    reputation: 58,
    squadStrength: 60,
    budgetLevel: 52,
    primaryColor: "남보라",
    trainingFacilities: facilities(64, 59, 66, 63, 82, 61),
    playStyle: "전술 유연성과 유스 활용",
    youthOpportunity: 90,
    transferPolicy: "아카데미 중심 성장 모델",
    depth: 60,
    averageAge: 23,
  }),
  club({
    id: "asan-oncheon-volt",
    name: "아산 온천 볼트",
    shortName: "온천",
    city: "아산",
    leagueId: K2_LEAGUE_ID,
    reputation: 59,
    squadStrength: 61,
    budgetLevel: 50,
    primaryColor: "황동",
    trainingFacilities: facilities(61, 66, 62, 61, 69, 65),
    playStyle: "직선 전개와 중거리 슈팅",
    youthOpportunity: 68,
    transferPolicy: "승격 도전용 즉시 전력",
    depth: 61,
    averageAge: 26,
  }),
  club({
    id: "guri-bridge-builders",
    name: "구리 브릿지 빌더스",
    shortName: "브릿지",
    city: "구리",
    leagueId: K2_LEAGUE_ID,
    reputation: 51,
    squadStrength: 54,
    budgetLevel: 32,
    primaryColor: "초록",
    trainingFacilities: facilities(55, 57, 56, 58, 76, 56),
    playStyle: "유스 중심 점유 시도",
    youthOpportunity: 92,
    transferPolicy: "신인 계약과 장기 육성",
    depth: 53,
    averageAge: 22,
  }),
  club({
    id: "paju-peace-runners",
    name: "파주 평화 러너스",
    shortName: "평화",
    city: "파주",
    leagueId: K2_LEAGUE_ID,
    reputation: 52,
    squadStrength: 53,
    budgetLevel: 34,
    primaryColor: "인디고",
    trainingFacilities: facilities(55, 60, 57, 59, 73, 57),
    playStyle: "중원 압박과 빠른 회복",
    youthOpportunity: 83,
    transferPolicy: "군 전역 선수와 신인 혼합",
    depth: 52,
    averageAge: 24,
  }),
  club({
    id: "gunsan-porters",
    name: "군산 포트러스",
    shortName: "포트",
    city: "군산",
    leagueId: K2_LEAGUE_ID,
    reputation: 53,
    squadStrength: 55,
    budgetLevel: 37,
    primaryColor: "먹색",
    trainingFacilities: facilities(56, 62, 58, 58, 68, 59),
    playStyle: "압박과 롱킥 전환",
    youthOpportunity: 74,
    transferPolicy: "예산 제한형 단기 계약",
    depth: 54,
    averageAge: 25,
  }),
  club({
    id: "wonju-mountain-green",
    name: "원주 산맥 그린",
    shortName: "산맥",
    city: "원주",
    leagueId: K2_LEAGUE_ID,
    reputation: 54,
    squadStrength: 56,
    budgetLevel: 39,
    primaryColor: "진녹색",
    trainingFacilities: facilities(57, 64, 57, 59, 72, 60),
    playStyle: "체력 기반 압박",
    youthOpportunity: 79,
    transferPolicy: "저평가 피지컬 자원 발굴",
    depth: 55,
    averageAge: 24,
  }),
  club({
    id: "yangsan-nakdong-rivers",
    name: "양산 낙동 리버스",
    shortName: "낙동",
    city: "양산",
    leagueId: K2_LEAGUE_ID,
    reputation: 50,
    squadStrength: 52,
    budgetLevel: 30,
    primaryColor: "물빛",
    trainingFacilities: facilities(54, 56, 55, 57, 74, 55),
    playStyle: "낮은 라인과 빠른 역습",
    youthOpportunity: 85,
    transferPolicy: "지역 유망주 우선",
    depth: 51,
    averageAge: 23,
  }),
  club({
    id: "suncheon-garden-guardians",
    name: "순천 정원 가디언즈",
    shortName: "정원",
    city: "순천",
    leagueId: K2_LEAGUE_ID,
    reputation: 52,
    squadStrength: 54,
    budgetLevel: 33,
    primaryColor: "연두",
    trainingFacilities: facilities(58, 57, 59, 61, 78, 57),
    playStyle: "패스 전개와 조직 수비",
    youthOpportunity: 86,
    transferPolicy: "아카데미 승격 중심",
    depth: 53,
    averageAge: 23,
  }),
  club({
    id: "icheon-ceramic-crowns",
    name: "이천 도예 크라운",
    shortName: "도예",
    city: "이천",
    leagueId: K2_LEAGUE_ID,
    reputation: 51,
    squadStrength: 53,
    budgetLevel: 31,
    primaryColor: "흙갈색",
    trainingFacilities: facilities(56, 56, 58, 60, 77, 56),
    playStyle: "균형형 4-4-2",
    youthOpportunity: 84,
    transferPolicy: "장기 성장형 저비용 영입",
    depth: 52,
    averageAge: 23,
  }),
];

const K3_CLUB_INPUTS = [
  ["cheon-an-skyworks", "천안 스카이웍스", "스카이", "천안", 49, 50, 36, 76],
  ["gimhae-river-steel", "김해 리버스틸", "리버", "김해", 48, 51, 38, 72],
  ["pocheon-granite", "포천 그래나이트", "포천", "포천", 44, 48, 32, 70],
  ["gyeongju-moonlight", "경주 문라이트", "문라이트", "경주", 52, 53, 41, 66],
  ["siheung-wave-tech", "시흥 웨이브테크", "시흥", "시흥", 47, 49, 35, 78],
  ["gangneung-pine-city", "강릉 파인시티", "파인", "강릉", 45, 47, 31, 74],
  ["dangjin-tide", "당진 타이드", "타이드", "당진", 43, 46, 30, 73],
  ["yangpyeong-hill", "양평 힐스", "힐스", "양평", 42, 45, 29, 79],
  ["changwon-machine", "창원 머신", "머신", "창원", 50, 52, 40, 68],
  ["ulsan-port-juniors", "울산 포트 주니어스", "포트", "울산", 46, 50, 37, 81],
  ["mokpo-horizon", "목포 호라이즌", "호라이즌", "목포", 44, 47, 33, 75],
  ["chungju-lake-city", "충주 레이크시티", "레이크", "충주", 41, 44, 27, 80],
  ["namyang-forest", "남양 포레스트", "포레스트", "남양", 40, 43, 26, 82],
  ["jinju-namriver", "진주 남리버", "남리버", "진주", 43, 45, 28, 78],
  ["seosan-flight", "서산 플라이트", "플라이트", "서산", 42, 44, 29, 76],
] as const;

const K4_CLUB_INPUTS = [
  ["pyeongtaek-breeze", "평택 브리즈", "브리즈", "평택", 36, 39, 24, 77],
  ["geojin-breakers", "거진 브레이커스", "거진", "거진", 34, 37, 22, 80],
  ["jecheon-sparks", "제천 스파크스", "스파크", "제천", 35, 38, 23, 83],
  ["geumsan-herbs", "금산 허브스", "허브스", "금산", 33, 36, 21, 84],
  ["haman-ironfield", "함안 아이언필드", "아이언", "함안", 34, 37, 22, 75],
  ["jincheon-beacons", "진천 비컨스", "비컨스", "진천", 36, 39, 25, 78],
  ["sejong-roads", "세종 로드스", "로드스", "세종", 38, 41, 27, 82],
  ["jungnang-metro", "중랑 메트로", "메트로", "중랑", 37, 40, 26, 79],
  ["pyeongchang-peak", "평창 피크", "피크", "평창", 32, 35, 20, 86],
  ["gijang-coast", "기장 코스트", "코스트", "기장", 35, 37, 22, 81],
  ["namhae-sunrise", "남해 선라이즈", "선라이즈", "남해", 31, 34, 19, 87],
  ["andong-paper", "안동 페이퍼", "페이퍼", "안동", 33, 36, 21, 83],
  ["boryeong-mudcity", "보령 머드시티", "머드", "보령", 34, 36, 21, 80],
  ["yeongwol-ridge", "영월 리지", "리지", "영월", 30, 33, 18, 88],
  ["miryang-arirang", "밀양 아리랑", "아리랑", "밀양", 32, 35, 19, 84],
  ["sacheon-aero", "사천 에어로", "에어로", "사천", 35, 38, 24, 79],
  ["gwangmyeong-lanterns", "광명 랜턴스", "랜턴스", "광명", 37, 39, 25, 81],
  ["naju-orchard", "나주 오차드", "오차드", "나주", 31, 34, 18, 86],
] as const;

function lowerDivisionClub(
  [id, name, shortName, city, reputation, squadStrength, budgetLevel, youthOpportunity]: readonly [
    string,
    string,
    string,
    string,
    number,
    number,
    number,
    number,
  ],
  leagueId: LeagueTier,
  index: number,
): Club {
  const isK3 = leagueId === K3_LEAGUE_ID;
  const baseFacilities = isK3 ? 48 : 38;
  const depth = isK3 ? 46 + (index % 5) : 34 + (index % 5);

  return club({
    id,
    name,
    shortName,
    city,
    leagueId,
    reputation,
    squadStrength,
    budgetLevel,
    primaryColor: isK3 ? "지역 청록" : "지역 초록",
    trainingFacilities: facilities(
      baseFacilities + (index % 7),
      baseFacilities + ((index + 2) % 7),
      baseFacilities + ((index + 3) % 7),
      baseFacilities + ((index + 4) % 7),
      Math.min(92, youthOpportunity + 4),
      baseFacilities + ((index + 5) % 7),
    ),
    playStyle: isK3 ? "조직적인 압박과 빠른 전환" : "활동량 중심의 지역 축구",
    youthOpportunity,
    transferPolicy: isK3 ? "지역 유망주와 저비용 계약 중심" : "승격 의지가 있는 유망주 육성 중심",
    depth,
    averageAge: isK3 ? 24 + (index % 3) : 22 + (index % 4),
  });
}

export const K3_CLUBS: Club[] = K3_CLUB_INPUTS.map((input, index) => ({
  ...lowerDivisionClub(input, K3_LEAGUE_ID, index),
  licenseEligible: index < 8,
  promotionIntent: index < 10,
}));

export const K4_CLUBS: Club[] = K4_CLUB_INPUTS.map((input, index) => ({
  ...lowerDivisionClub(input, K4_LEAGUE_ID, index),
  licenseEligible: index < 11,
  promotionIntent: index < 12,
}));

export const FICTIONAL_LEAGUES: Record<LeagueTier, League> = {
  [K1_LEAGUE_ID]: {
    id: K1_LEAGUE_ID,
    name: "코리아 프리미어 1",
    country: "대한민국",
    tier: K1_LEAGUE_ID,
    level: 1,
    competitionId: K1_COMPETITION_ID,
    ruleSet: K1_RULE_SET,
    seasonStartMonth: 1,
    seasonEndMonth: 12,
    clubs: K1_CLUBS,
  },
  [K2_LEAGUE_ID]: {
    id: K2_LEAGUE_ID,
    name: "코리아 챌린지 2",
    country: "대한민국",
    tier: K2_LEAGUE_ID,
    level: 2,
    competitionId: K2_COMPETITION_ID,
    ruleSet: K2_RULE_SET,
    seasonStartMonth: 1,
    seasonEndMonth: 12,
    clubs: K2_CLUBS,
  },
  [K3_LEAGUE_ID]: {
    id: K3_LEAGUE_ID,
    name: "코리아 내셔널 3",
    country: "대한민국",
    tier: K3_LEAGUE_ID,
    level: 3,
    competitionId: K3_COMPETITION_ID,
    ruleSet: K3_RULE_SET,
    seasonStartMonth: 1,
    seasonEndMonth: 12,
    clubs: K3_CLUBS,
  },
  [K4_LEAGUE_ID]: {
    id: K4_LEAGUE_ID,
    name: "코리아 커뮤니티 4",
    country: "대한민국",
    tier: K4_LEAGUE_ID,
    level: 4,
    competitionId: K4_COMPETITION_ID,
    ruleSet: K4_RULE_SET,
    seasonStartMonth: 1,
    seasonEndMonth: 12,
    clubs: K4_CLUBS,
  },
};

export const STARTER_CLUBS = [
  ...K4_CLUBS.filter((club) => club.youthOpportunity >= 82).slice(0, 8),
  ...K3_CLUBS.filter((club) => club.youthOpportunity >= 76).slice(0, 8),
  ...K2_CLUBS.filter((club) => club.youthOpportunity >= 78).slice(0, 8),
  ...K1_CLUBS.filter((club) => club.youthOpportunity >= 74).slice(0, 4),
];

export function getAllClubs(): Club[] {
  return [...K1_CLUBS, ...K2_CLUBS, ...K3_CLUBS, ...K4_CLUBS];
}

export function getClubsById(): Record<string, Club> {
  return Object.fromEntries(getAllClubs().map((club) => [club.id, club]));
}

export function createFictionalCompetitions(
  seasonNumber: number,
  fixtures: readonly Fixture[] = [],
): Record<string, Competition> {
  const leagueCompetitions = Object.fromEntries(
    Object.values(FICTIONAL_LEAGUES).map((league) => [
      league.competitionId,
      {
        id: league.competitionId,
        name: league.name,
        type: "league" as const,
        country: league.country,
        seasonNumber,
        leagueIds: [league.id],
        fixtureIds: fixtures
          .filter((fixture) => fixture.competitionId === league.competitionId)
          .map((fixture) => fixture.id),
      },
    ]),
  );
  const playoffCompetitionIds = [...new Set(
    fixtures
      .filter((fixture) => fixture.playoff && !(fixture.competitionId in leagueCompetitions))
      .map((fixture) => fixture.competitionId),
  )];
  const playoffCompetitions = Object.fromEntries(
    playoffCompetitionIds.map((competitionId) => {
      const competitionFixtures = fixtures.filter((fixture) => fixture.competitionId === competitionId);
      const leagueIds = [...new Set(competitionFixtures.map((fixture) => fixture.leagueId))];

      return [
        competitionId,
        {
          id: competitionId,
          name: "승강 플레이오프",
          type: "playoff" as const,
          country: FICTIONAL_LEAGUES[K1_LEAGUE_ID].country,
          seasonNumber,
          leagueIds,
          fixtureIds: competitionFixtures.map((fixture) => fixture.id),
        },
      ];
    }),
  );
  const cupFixtures = fixtures.filter((fixture) => fixture.competitionId === DOMESTIC_CUP_COMPETITION_ID);
  const cupCompetitions: Record<string, Competition> = cupFixtures.length > 0
    ? {
        [DOMESTIC_CUP_COMPETITION_ID]: {
          id: DOMESTIC_CUP_COMPETITION_ID,
          name: DOMESTIC_CUP_NAME,
          type: "cup" as const,
          country: FICTIONAL_LEAGUES[K1_LEAGUE_ID].country,
          seasonNumber,
          leagueIds: Object.keys(FICTIONAL_LEAGUES) as LeagueTier[],
          fixtureIds: cupFixtures.map((fixture) => fixture.id),
        },
      }
    : {};

  return {
    ...leagueCompetitions,
    ...cupCompetitions,
    ...playoffCompetitions,
  };
}

export function getClubById(clubId: string): Club | undefined {
  return getAllClubs().find((club) => club.id === clubId);
}

export function getClubName(clubId: string): string {
  return getClubById(clubId)?.name ?? "소속 없음";
}

export function getLeagueName(leagueId: LeagueTier): string {
  return FICTIONAL_LEAGUES[leagueId].name;
}
