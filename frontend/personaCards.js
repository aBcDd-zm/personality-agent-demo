window.PERSONA_CARDS = [
  {
    code: "MOOD",
    name: "读空气选手",
    formalName: "共情感知者",
    image: "/static/assets/persona_cards/mood_read_air.png",
    slogan: "别人还在听内容，你已经开始分析语气、表情和沉默时长了。",
    tags: ["察言观色", "情绪感知", "冷场预警"],
    accent: "#66765f",
  },
  {
    code: "DONE",
    name: "进度条本人",
    formalName: "稳健执行官",
    image: "/static/assets/persona_cards/done_progress_person.png",
    slogan: "事情到你手里，就开始稳定地往100%走。",
    tags: ["稳定交付", "靠谱推进", "deadline亲属"],
    accent: "#52677f",
  },
  {
    code: "IDEA",
    name: "点子批发商",
    formalName: "灵感点火器",
    image: "/static/assets/persona_cards/idea_idea_wholesaler.png",
    slogan: "需求还没定，你已经脑补出三个版本和两个副业。",
    tags: ["脑洞外溢", "方案扩散", "灵感过载"],
    accent: "#d58a20",
  },
  {
    code: "MIC",
    name: "会议嘴替",
    formalName: "推进发言者",
    image: "/static/assets/persona_cards/mic_meeting_mouthpiece.png",
    slogan: "大家都在沉默时，你负责把“所以怎么定”说出口。",
    tags: ["主动发言", "节奏推进", "结论召唤"],
    accent: "#d77a3d",
  },
  {
    code: "GLUE",
    name: "群聊调停员",
    formalName: "团队润滑剂",
    image: "/static/assets/persona_cards/glue_groupchat_mediator.png",
    slogan: "产品和技术快吵起来时，你是群里最后一层缓冲垫。",
    tags: ["关系缓冲", "团队不散", "沟通润滑"],
    accent: "#7fb4d5",
  },
  {
    code: "RISK",
    name: "背锅预言家",
    formalName: "风险预警员",
    image: "/static/assets/persona_cards/risk_blame_prophet.png",
    slogan: "方案刚起飞，你已经看到谁会背锅了。",
    tags: ["风险前置", "坑位侦察", "事故复盘预演"],
    accent: "#77658a",
  },
  {
    code: "DIVE",
    name: "工位潜水员",
    formalName: "安静攻坚手",
    image: "/static/assets/persona_cards/dive_workstation_diver.png",
    slogan: "群里不冒泡，交付时突然带着完整文件浮出水面。",
    tags: ["静默交付", "低调产能", "群聊已读"],
    accent: "#3e5065",
  },
  {
    code: "CTRL",
    name: "颗粒度阎王",
    formalName: "全局掌控者",
    image: "/static/assets/persona_cards/ctrl_granularity_yanwang.png",
    slogan: "你不是控制欲强，你只是受不了事情没有拆清楚。",
    tags: ["拆解任务", "边界清晰", "节奏控场"],
    accent: "#223b59",
  },
];

window.PERSONA_CARD_MAP = Object.fromEntries(
  window.PERSONA_CARDS.map((item) => [item.code, item])
);

window.getPersonaCard = function getPersonaCard(code) {
  return window.PERSONA_CARD_MAP[code] || window.PERSONA_CARD_MAP.DONE;
};
