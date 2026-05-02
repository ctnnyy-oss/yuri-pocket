export interface CpCharacterProfile {
  name: string
  role: string
  archetype: string
  profile: string
}

export interface CpProfile {
  id: string
  name: string
  type: string
  dynamic: string
  world: string
  premise: string
  characters: CpCharacterProfile[]
  relationshipCore: string
  emotionalKeywords: string[]
  storyRole: string
  tags: string[]
}

export const coreCpProfiles: CpProfile[] = [
  {
    id: 'ningan-aling',
    name: '宁安 × 阿绫',
    type: '傲娇大小姐 × 自卑忠犬',
    dynamic: '阿绫攻，宁安受',
    world: '古代架空，皇室宗亲与贴身侍女的主仆禁忌线',
    premise: '身份差、禁忌感和长久陪伴织成的慢热救赎线。',
    characters: [
      {
        name: '宁安',
        role: '皇室支系郡主',
        archetype: '傲娇大小姐',
        profile:
          '身份尊贵，自幼养在锦绣富贵之中。外表骄矜傲气，嘴上从不肯服软，习惯用冷淡、挑剔和命令掩饰在意。她极重情义，孤独敏感，最害怕被抛下。',
      },
      {
        name: '阿绫',
        role: '贴身侍女',
        archetype: '自卑忠犬',
        profile:
          '出身卑微，沉默寡言，习惯把自己放在最低的位置。她忠心、隐忍、自卑，从不敢奢望小姐回头，只愿长久守在宁安身边。',
      },
    ],
    relationshipCore:
      '宁安从习惯被照顾，到逐渐无法忍受阿绫离开自己；阿绫从只敢低头守护，到慢慢学会承认自己的爱也值得被回应。感情在日复一日的陪伴、误会、保护和破防中积累。',
    emotionalKeywords: ['嘴硬心软', '主仆禁忌', '身份差', '卑微守护', '隐忍暗恋', '慢热救赎', '大小姐破防'],
    storyRole: '古代架空百合宇宙的主仆禁忌入口，负责承载身份差、陪伴感和忠犬救赎。',
    tags: ['傲娇郡主', '贴身侍女', '忠犬救赎', '慢热'],
  },
  {
    id: 'suwanyin-xiezhao',
    name: '苏晚吟 × 谢昭',
    type: '乖乖女 × 不良少女将军',
    dynamic: '苏晚吟攻，谢昭受',
    world: '古代架空，宰相千金与护国女将军的青梅重逢线',
    premise: '礼法与自由互相照亮的文武对照线。',
    characters: [
      {
        name: '苏晚吟',
        role: '宰相府千金',
        archetype: '乖乖女',
        profile:
          '自幼在礼教与规矩中长大，温婉端庄，聪慧克制，是旁人眼中标准的大家闺秀。她看似柔顺，内心极有主见，会为了谢昭一点点学会坚定。',
      },
      {
        name: '谢昭',
        role: '护国女将军',
        archetype: '不良少女将军',
        profile:
          '少年从军、战功赫赫，常着男装，张扬、不羁、锋利。她像不肯入鞘的刀，却会在苏晚吟面前收起锋芒，用玩世不恭掩饰疲惫与伤痕。',
      },
    ],
    relationshipCore:
      '苏晚吟被谢昭身上的自由吸引，谢昭把苏晚吟视作乱世里唯一柔软的归处。一个温柔端方，一个张扬不羁，在彼此身上看见自己缺失的部分。',
    emotionalKeywords: ['青梅重逢', '文武对照', '礼法束缚', '自由灵魂', '双向暗恋', '外强内柔', '温柔攻', '桀骜受'],
    storyRole: '古代架空百合宇宙的青梅重逢入口，负责承载自由、礼法和互相拉回人间的温柔。',
    tags: ['乖乖女', '女将军', '青梅重逢', '文武对照'],
  },
  {
    id: 'shenwanci-luwanzhao',
    name: '沈晚辞 × 陆婉昭',
    type: '冰山皇后 × 绿茶婉仪',
    dynamic: '沈晚辞攻，陆婉昭受',
    world: '古代架空，后宫权谋与情感试探线',
    premise: '冷与甜、规矩与试探之间的暧昧拉扯线。',
    characters: [
      {
        name: '沈晚辞',
        role: '当朝皇后',
        archetype: '冰山皇后',
        profile:
          '清冷端庄，位居中宫，掌六宫规矩。她看似无情无欲，永远冷静克制，习惯用规矩保护自己，也用冷漠隔绝所有靠近的人。',
      },
      {
        name: '陆婉昭',
        role: '后宫婉仪',
        archetype: '绿茶婉仪',
        profile:
          '容貌甜美，言语柔软，表面天真无害，实则聪明心细，擅长试探人心。她懂得示弱，也懂得进退，起初带着目的靠近皇后，却在交锋中真正动心。',
      },
    ],
    relationshipCore:
      '沈晚辞不信真心，陆婉昭不轻易交出真心；一个冷，一个甜，一个压制，一个撩拨。关系从利用、观察、试探开始，逐渐变成无人可替代的依赖。',
    emotionalKeywords: ['后宫权谋', '双向试探', '诱而不破', '暧昧拉扯', '冷面攻', '甜茶受', '宫斗', '克制心动'],
    storyRole: '古代架空百合宇宙的宫廷权谋入口，负责承载克制、暧昧、权力距离和谁先动心谁先输的张力。',
    tags: ['冰山皇后', '绿茶婉仪', '后宫权谋', '暧昧拉扯'],
  },
]
