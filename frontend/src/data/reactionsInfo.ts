export interface ReactionDetailMeta {
  ptName: string
  category: 'amplifying' | 'transformative' | 'dendro' | 'lunar' | 'stellar'
  summary: string
  mechanics: string
  formula: string
  scaling: string
  canCrit: 'Sim' | 'Não' | 'Sim (Moonsign)' | 'Não (Buff/Aura)'
  tip: string
  notableSets?: string[]
}

export const REACTION_DETAILS: Record<string, ReactionDetailMeta> = {
  vaporize: {
    ptName: 'Vaporização',
    category: 'amplifying',
    summary: 'Multiplica o dano final do golpe gatilho ao combinar Pyro e Hydro.',
    mechanics:
      'Quando Pyro acerta um alvo com aura Hydro (Reverse Vaporize), o golpe recebe 1.5x de multiplicador e consome apenas metade da aura — permitindo múltiplos Vapes seguidos. Quando Hydro acerta Pyro (Forward Vaporize), o multiplicador sobe para 2.0x, mas consome a aura rapidamente.',
    formula: 'Pyro em Hydro: 1.5x · Hydro em Pyro: 2.0x',
    scaling: 'ATQ/HP + Crítico + Bônus Elemental + EM',
    canCrit: 'Sim',
    tip: 'Em carries Pyro (Hu Tao, Arlecchino, Gaming, Xiangling), mire em 150–300 de EM além de Crítico. Mantenha aplicadores Hydro consistentes (Xingqiu, Yelan, Furina) para garantir Reverse Vape em todos os golpes.',
    notableSets: ['Bruxa das Chamas Carmesim', 'Sonhos Dourados', 'Selo da Insulação'],
  },
  melt: {
    ptName: 'Fusão',
    category: 'amplifying',
    summary: 'Multiplica o dano final do golpe gatilho ao combinar Pyro e Cryo.',
    mechanics:
      'Pyro sobre Cryo (Forward Melt) aplica 2.0x no golpe gatilho — um dos maiores tetos de dano do jogo (ex.: Mavuika/Arlecchino + Citlali). Cryo sobre Pyro (Reverse Melt) aplica 1.5x e preserva melhor a aura Pyro, sendo muito estável com Xiangling ou times de Burnmelt (Pyro + Dendro).',
    formula: 'Pyro em Cryo: 2.0x · Cryo em Pyro: 1.5x',
    scaling: 'ATQ + Crítico + Bônus Elemental + EM',
    canCrit: 'Sim',
    tip: 'Use aplicadores Cryo rápidos (Citlali, Rosaria, Kaeya) para Forward Melt, ou combine Pyro + Dendro (Burning) para alimentar Reverse Melt contínuo em carries Cryo como Wriothesley e Ganyu.',
    notableSets: ['Bruxa das Chamas Carmesim', 'Sonhos Dourados', 'Trupe Itinerante'],
  },
  overloaded: {
    ptName: 'Sobrecarga',
    category: 'transformative',
    summary: 'Explosão de dano Pyro em área com forte impacto e quebra de escudos Geo.',
    mechanics:
      'Ao combinar Pyro e Electro, cria uma explosão Pyro em área que ignora completamente a DEF do inimigo (afetada apenas por RES Pyro) e empurra alvos leves. O dano depende exclusivamente do Nível e EM de quem disparou a reação.',
    formula: 'Fator base 2.75x (Transformativa · ignora DEF)',
    scaling: 'Nível do Personagem + EM (do gatilho)',
    canCrit: 'Não',
    tip: 'Com Chevreuse no time (apenas Pyro + Electro), a Sobrecarga vira um arquétipo top-tier: dispara -40% RES Pyro/Electro e +40% ATQ para o time inteiro, dispensando build de EM.',
    notableSets: ['Trovão Furioso', 'Bruxa das Chamas Carmesim', 'Antigo Ritual Real'],
  },
  electro_charged: {
    ptName: 'Eletricamente Carregado',
    category: 'transformative',
    summary: 'Auras Hydro e Electro coexistem aplicando pulsos contínuos de dano Electro em cadeia.',
    mechanics:
      'Diferente de outras reações, Hydro e Electro permanecem ativos juntos no inimigo, disparando pulsos de dano Electro a cada 1s que saltam para inimigos molhados próximos e causam leve interrupção. Por manter ambas as auras, permite Swirl duplo com Anemo.',
    formula: 'Fator base 2.0x por pulso (ignora DEF)',
    scaling: 'Nível do Personagem + EM (do gatilho)',
    canCrit: 'Não',
    tip: 'Brilha em times Taser (Sucrose/Kazuha/Ifa + Fischl/Beidou/Ororon + Xingqiu/Furina) e permite "Double Swirl" de Hydro e Electro simultaneamente com 4pc Sombra Verde.',
    notableSets: ['Sombra Verde', 'Trovão Furioso', 'Trupe Dourada'],
  },
  frozen: {
    ptName: 'Congelado',
    category: 'transformative',
    summary: 'Imobiliza inimigos congeláveis e libera bônus massivos de Taxa Crítica.',
    mechanics:
      'Combinar Cryo e Hydro cria a aura Congelado, paralisando inimigos comuns e estendendo janelas de dano. Chefes não ficam imobilizados, mas a reação ainda ativa passivas dependentes de Freeze (como Escoffier e Skirk). Não causa dano próprio.',
    formula: 'Sem dano direto (controle de grupo + aura)',
    scaling: 'Duração depende da força da aura aplicada',
    canCrit: 'Não (Buff/Aura)',
    tip: 'Combine com 4pc Herói Invernal (+40% Taxa Crítica em alvos congelados) e Ressonância Cryo (+15% Taxa Crítica) para investir quase tudo em Dano Crítico e ATQ%. Evite golpes pesados (Espadão/Geo) para não quebrar o gelo com Shatter.',
    notableSets: ['Herói Invernal', 'Sombra Verde'],
  },
  superconduct: {
    ptName: 'Supercondutor',
    category: 'transformative',
    summary: 'Pequena explosão Cryo que reduz em 40% a Resistência Física dos inimigos.',
    mechanics:
      'Reação entre Cryo e Electro com dano transformativo modesto (fator 1.5x), porém seu valor real está no debuff de -40% RES Física durante 12 segundos em todos os inimigos atingidos pela área da explosão.',
    formula: 'Fator base 1.5x + debuff -40% RES Física (12s)',
    scaling: 'Nível + EM (dano) · Debuff fixo em 40%',
    canCrit: 'Não',
    tip: 'Obrigatória em times de Dano Físico (Eula, Razor, Freminet). Basta aplicar 1 vez a cada 12s — não vale a pena sacrificar Crítico/ATQ por EM.',
    notableSets: ['Chama Pálida', 'Millelith Firmes'],
  },
  swirl: {
    ptName: 'Redemoinho',
    category: 'transformative',
    summary: 'Espalha Pyro, Hydro, Electro ou Cryo em área e aplica RES Shred com Sombra Verde.',
    mechanics:
      'Anemo reage com Pyro, Hydro, Electro ou Cryo causando dano do elemento absorvido em área e espalhando essa aura para inimigos vizinhos (exceto Hydro, que espalha só a aura e causa dano no alvo primário). Em múltiplos alvos, o dano escala quadraticamente.',
    formula: 'Fator base 0.6x por alvo · Prioridade: Pyro > Hydro > Electro > Cryo',
    scaling: 'Nível 90 + EM (ignora DEF)',
    canCrit: 'Não',
    tip: 'Sempre leve personagens Anemo de Swirl (Kazuha, Sucrose, Venti) ao Nível 90 com 4pc Sombra Verde (-40% RES elemental) e foco máximo em EM + Recarga.',
    notableSets: ['Sombra Verde'],
  },
  crystallize: {
    ptName: 'Cristalização',
    category: 'transformative',
    summary: 'Cria fragmentos elementais que geram escudos protetores e munição para kits Geo.',
    mechanics:
      'Quando Geo acerta Pyro, Hydro, Electro ou Cryo, derruba um fragmento do respectivo elemento no chão. Ao coletá-lo, o personagem ganha um escudo (250% mais resistente contra aquele mesmo elemento) cuja vida escala com Nível e EM do personagem Geo.',
    formula: 'Escudo base por Nível × bônus de EM (250% absorção elemental)',
    scaling: 'Nível + EM do aplicador Geo',
    canCrit: 'Não (Buff/Aura)',
    tip: 'Essencial para gerar cargas de estilhaço da Navia e ativar +35% de Bônus Elemental do conjunto 4pc Petra Arcaica.',
    notableSets: ['Petra Arcaica', 'Sussurros Noturnos na Floresta Ecoante', 'Pergaminho do Herói da Cidade das Cinzas'],
  },
  burning: {
    ptName: 'Queimadura',
    category: 'transformative',
    summary: 'Mantém uma aura Pyro persistente causando dano contínuo rápido enquanto há Dendro.',
    mechanics:
      'Pyro + Dendro gera uma chama que causa dano Pyro em pequena área a cada 0.25s (4 ticks/s) consumindo a aura Dendro gradualmente. A aura Pyro subjacente é constantemente renovada enquanto Burning durar.',
    formula: 'Fator base 0.25x por tick (4 ticks/segundo)',
    scaling: 'Nível + EM do último aplicador',
    canCrit: 'Não',
    tip: 'Mesmo com dano próprio moderado, Burning é a base dos times de Emilie e Kinich e serve como combustível estável de aura Pyro para carries Cryo fazerem Reverse Melt (Burnmelt).',
    notableSets: ['Devaneio Inacabado', 'Memórias da Floresta'],
  },
  shatter: {
    ptName: 'Estilhaçar',
    category: 'transformative',
    summary: 'Quebra inimigos congelados com golpes pesados causando dano Físico transformativo.',
    mechanics:
      'Quando um alvo em estado Congelado recebe um golpe pesado (Espadão, Geo, Ataque Imersivo ou explosão), o gelo se quebra instantaneamente causando dano Físico que ignora DEF do alvo e escala apenas com Nível e EM.',
    formula: 'Fator base 3.0x (Transformativa Física · ignora DEF)',
    scaling: 'Nível 90 + EM do gatilho pesado',
    canCrit: 'Não',
    tip: 'Normalmente evitado em times tradicionais de Freeze para não perder o controle de grupo nem o bônus do Herói Invernal, mas explorado em composições específicas de Freminet.',
    notableSets: ['Herói Invernal', 'Sonhos Dourados'],
  },
  bloom: {
    ptName: 'Florescimento',
    category: 'dendro',
    summary: 'Gera Núcleos Dendro no chão que explodem após 6s ou ao atingir o limite de 5 núcleos.',
    mechanics:
      'Hydro + Dendro cria um Núcleo Dendro. Quando Hydro acerta aura Dendro (Reverse Bloom), consome metade da aura e gera muito mais núcleos por rotação. Cada núcleo explode após 6s causando dano Dendro em área (fator 2.0x) e 5% de dano ao jogador.',
    formula: 'Fator base 2.0x · Máx. 5 núcleos simultâneos (dano máx. 2 hits/0.5s)',
    scaling: 'Nível 90 + EM do criador do núcleo',
    canCrit: 'Não',
    tip: 'Em times padrão, use os núcleos como matéria-prima para Hyperbloom ou Burgeon. Com Nilou (time 100% Hydro + Dendro), os núcleos viram Núcleos Abundantes que explodem na hora com área gigante e dano massivo!',
    notableSets: ['Flor do Paraíso Perdido', 'Memórias da Floresta', 'Sonhos Dourados'],
  },
  hyperbloom: {
    ptName: 'Superflorescimento',
    category: 'dendro',
    summary: 'Transforma Núcleos Dendro em projéteis teleguiados de altíssimo dano em alvo único.',
    mechanics:
      'Quando Electro acerta um Núcleo Dendro no chão, ele se converte imediatamente num projétil que persegue o inimigo e causa dano Dendro massivo (fator 3.0x, ignora DEF). Apenas o Nível e a EM do personagem Electro gatilho importam — ignorando os stats de quem criou o núcleo.',
    formula: 'Fator base 3.0x (dano Dendro · ignora DEF · máx. 2 hits/0.5s por alvo)',
    scaling: 'Nível 90 + EM do gatilho Electro (ex.: Kuki, Raiden)',
    canCrit: 'Não',
    tip: 'Um dos times mais fortes e acessíveis do jogo! Coloque o gatilho Electro (Kuki Shinobu ou Raiden full EM) no Nível 90 com 900+ de EM e garanta 1 personagem no time com 4pc Memórias da Floresta (-30% RES Dendro).',
    notableSets: ['Flor do Paraíso Perdido', 'Sonhos Dourados', 'Memórias da Floresta'],
  },
  burgeon: {
    ptName: 'Germinação',
    category: 'dendro',
    summary: 'Detona Núcleos Dendro com Pyro causando grande explosão Dendro em área.',
    mechanics:
      'Aplicar Pyro sobre Núcleos Dendro os detona instantaneamente em uma explosão de 5m de raio com o mesmo multiplicador altíssimo do Hyperbloom (3.0x, ignora DEF), excelente contra grupos densos de inimigos.',
    formula: 'Fator base 3.0x em AoE de 5m (dano Dendro · ignora DEF)',
    scaling: 'Nível 90 + EM do gatilho Pyro (ex.: Thoma, Dehya)',
    canCrit: 'Não',
    tip: 'Cuidado para não exagerar na aplicação Pyro e disparar Burning no lugar de gerar núcleos — aplicadores Pyro cadenciados como Thoma (Nível 90, full EM + ER) combinados com muito Hydro mantêm a rotação limpa.',
    notableSets: ['Flor do Paraíso Perdido', 'Sonhos Dourados', 'Memórias da Floresta'],
  },
  quicken: {
    ptName: 'Aceleração',
    category: 'dendro',
    summary: 'Aplica a aura Catalisada que habilita Aggravate e Spread sem ser consumida.',
    mechanics:
      'Combinar Dendro e Electro não causa dano direto, mas coloca o inimigo em estado Quicken por 6 a 11 segundos. Enquanto essa aura estiver ativa, ataques Electro disparam Aggravate e ataques Dendro disparam Spread livremente.',
    formula: 'Aura catalisada (duração ~6s–11s) · Não causa dano direto',
    scaling: 'Habilita Aggravate (Electro) e Spread (Dendro)',
    canCrit: 'Não (Buff/Aura)',
    tip: 'Evite misturar Pyro ou excesso de Hydro num time puro de Quicken, pois eles consomem a aura Catalisada (gerando Burning ou Bloom) e derrubam o tempo ativo de Aggravate/Spread.',
    notableSets: ['Memórias da Floresta', 'Sonhos Dourados'],
  },
  aggravate: {
    ptName: 'Intensificação',
    category: 'dendro',
    summary: 'Soma dano base extra aos golpes Electro em alvos sob Quicken, multiplicado por Crítico.',
    mechanics:
      'Quando um ataque Electro acerta um inimigo em estado Quicken, adiciona um bônus de dano plano (Flat DMG, fator 1.15x escalando com Nível 90 e EM) diretamente no cálculo base do golpe — antes de multiplicar por Bônus de Dano Electro e Dano Crítico.',
    formula: 'Flat DMG (1.15x × base Nível × bônus EM) + Crítico + Bônus Electro',
    scaling: 'Nível 90 + Crítico + Bônus Electro + EM',
    canCrit: 'Sim',
    tip: 'Favorável a personagens com muitos hits rápidos e baixo ICD (Fischl A4, Keqing, Clorinde, Yae Miko). Levar o DPS Electro ao Nível 90 aumenta bastante o bônus base do Aggravate!',
    notableSets: ['Trovão Furioso', 'Sonhos Dourados', 'Sombra Verde'],
  },
  spread: {
    ptName: 'Propagação',
    category: 'dendro',
    summary: 'Soma dano base extra aos golpes Dendro em alvos sob Quicken, multiplicado por Crítico.',
    mechanics:
      'Funciona exatamente como o Aggravate, mas para golpes Dendro em inimigos sob Quicken — e com multiplicador base ainda maior (1.25x). O bônus plano entra antes do Bônus de Dano Dendro e do Dano Crítico.',
    formula: 'Flat DMG (1.25x × base Nível × bônus EM) + Crítico + Bônus Dendro',
    scaling: 'Nível 90 + Crítico + Bônus Dendro + EM',
    canCrit: 'Sim',
    tip: 'Ideal para Alhaitham, Tighnari e Nahida on-field. Combine 1 portador de 4pc Memórias da Floresta (-30% RES Dendro) no time e priorize Nível 90, Crítico e 250–400 de EM no carry.',
    notableSets: ['Sonhos Dourados', 'Memórias da Floresta', 'Trupe Itinerante'],
  },
  lunar_bloom: {
    ptName: 'Florescimento Lunar',
    category: 'lunar',
    summary: 'Evolução Lunar de Bloom ativada por personagens Moonsign (Nod-Krai), capaz de Crítico.',
    mechanics:
      'Quando há personagens Moonsign compatíveis no time (como Lauma, Nefer ou Columbina), reações Hydro + Dendro geram recursos de Orvalho Verdejante (Verdant Dew) e habilitam golpes de Dano Lunar-Bloom que escalam com EM e podem acertar Crítico.',
    formula: 'Dano Lunar-Bloom (escala com EM · ignora DEF · pode Crítar)',
    scaling: 'Nível 90 + EM + Taxa/Dano Crítico + Passivas Moonsign',
    canCrit: 'Sim (Moonsign)',
    tip: 'Diferente do Bloom comum, builds de Lunar-Bloom valorizam tanto EM quanto Taxa e Dano Crítico! Emparelhe 2 personagens Moonsign para ativar o nível máximo de Ascendant Gleam.',
    notableSets: ['Serenata da Lua Sedosa', 'Noite da Revelação Celeste', 'Memórias da Floresta'],
  },
  lunar_charged: {
    ptName: 'Eletricamente Carregado Lunar',
    category: 'lunar',
    summary: 'Evolução Lunar de Electro-Charged que invoca nuvens de tempestade com dano Crítico.',
    mechanics:
      'Habilitada por personagens Moonsign Electro/Hydro (como Ineffa, Flins e Columbina), substitui o Electro-Charged comum por uma nuvem de raios contínua cujo dano combina a contribuição dos aplicadores envolvidos, escala com EM e pode acertar Crítico.',
    formula: 'Descargas contínuas de Nuvem de Tempestade (ignora DEF · pode Crítar)',
    scaling: 'Nível 90 + EM + Crítico dos aplicadores Hydro/Electro',
    canCrit: 'Sim (Moonsign)',
    tip: 'Como todos os participantes Hydro e Electro contribuem para o cálculo da nuvem, manter boa Taxa/Dano Crítico e EM nos sub-DPS (ex.: Ineffa + Columbina/Furina) eleva muito o DPS total do time.',
    notableSets: ['Noite da Revelação Celeste', 'Serenata da Lua Sedosa', 'Sombra Verde'],
  },
  lunar_crystallize: {
    ptName: 'Cristalização Lunar',
    category: 'lunar',
    summary: 'Evolução Lunar de Crystallize que converte fragmentos em ataques Geo Críticos.',
    mechanics:
      'Ativada por personagens Moonsign Geo/Hydro (como Zibai, Illuga e Columbina), transforma a cristalização padrão em ressonâncias lunares ofensivas que causam dano Geo amplificado capaz de acertar Crítico além da utilidade defensiva.',
    formula: 'Ressonância Lunar Geo (escala com DEF/EM · pode Crítar)',
    scaling: 'Nível 90 + Crítico + EM/DEF + Passivas Moonsign',
    canCrit: 'Sim (Moonsign)',
    tip: 'Garanta aplicação Hydro constante junto aos personagens Geo Moonsign para manter a geração contínua de ressonâncias lunares durante toda a rotação.',
    notableSets: ['Serenata da Lua Sedosa', 'Noite da Revelação Celeste', 'Casca de Sonhos Opulentos'],
  },
  stellar_conduct: {
    ptName: 'Supercondutor Estelar',
    category: 'stellar',
    summary: 'Variante aprimorada de Superconduct ligada a efeitos especiais Cryo + Electro.',
    mechanics:
      'Amplifica o impacto da combinação Cryo + Electro, aumentando o potencial ofensivo da reação e fortalecendo a redução de resistências em composições dedicadas.',
    formula: 'Superconduct potencializado (Cryo + Electro)',
    scaling: 'Nível 90 + EM + Passivas de kit',
    canCrit: 'Não',
    tip: 'Combine aplicadores Cryo e Electro constantes para manter o debuff e os gatilhos ativos sem lacunas na rotação.',
  },
  stellar_swirl: {
    ptName: 'Redemoinho Estelar',
    category: 'stellar',
    summary: 'Variante aprimorada de Swirl com maior difusão elemental e dano em área.',
    mechanics:
      'Potencializa a difusão elemental de Anemo sobre Pyro, Hydro, Electro ou Cryo, ampliando o alcance de propagação entre grupos de inimigos e a sinergia com buffs elementais.',
    formula: 'Swirl potencializado (Anemo + PHEC)',
    scaling: 'Nível 90 + EM (ignora DEF)',
    canCrit: 'Não',
    tip: 'Continue priorizando 4pc Sombra Verde e Nível 90 no personagem Anemo para somar -40% RES Shred ao dano da difusão.',
    notableSets: ['Sombra Verde'],
  },
}
