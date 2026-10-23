/** Conteúdo AEO do provador: respostas curtas e autocontidas (página + FAQPage JSON-LD). */

export const PROVADOR_STEPS = [
  {
    title: "Escolha o manequim",
    text: "Toque no nome do manequim (MIA ou KAUÃ) acima do palco. Na aba Visual dá para ajustar tom de pele, cabelo e o estilo: informal (pose relaxada) ou formal (postura de vitrine).",
  },
  {
    title: "Informe altura e peso",
    text: "Na aba Corpo, mova os controles de altura e peso. O manequim se ajusta na hora e o provador estima busto ou tórax, cintura, quadril, ombros, entrepernas e pé.",
  },
  {
    title: "Vista as peças",
    text: "Toque num look pronto na aba Looks ou busque peças por nome na aba Peças, com filtro por parte do corpo e por curtidas. É uma peça por parte do corpo; o vestido ocupa a parte de cima e a de baixo, e o skate vai na mão.",
  },
  {
    title: "Confira o caimento",
    text: "Cada peça vestida mostra o tamanho recomendado e se veste apertado, justo, ideal, solto ou grande. Toque na peça no resumo do look para trocar o tamanho e ler as observações de comprimento.",
  },
  {
    title: "Salve ou compre o look",
    text: "No resumo do look, Salvar guarda o look em Meus looks e Comprar look manda todas as peças para a sacola de uma vez, já nos tamanhos escolhidos.",
  },
] as const;

export const PROVADOR_FAQ: { id: string; q: string; a: string }[] = [
  {
    id: "caimento",
    q: "Como o Provador 3D calcula o caimento?",
    a: "Ele estima suas medidas (busto ou tórax, cintura, quadril, ombros, entrepernas e pé) a partir da altura, do peso e do tipo de corpo e compara com a tabela de medidas de cada tamanho da peça. A diferença vira um selo de caimento — apertado, justo, ideal, solto ou grande — e um índice de 0 a 100% para o look. Acessórios segurados, como o skate, não entram no cálculo.",
  },
  {
    id: "tamanho",
    q: "O tamanho recomendado é garantido?",
    a: "É uma estimativa feita com medidas médias para a sua altura e peso, não uma medição do seu corpo. Se ficar em dúvida entre dois tamanhos, compare com uma peça que você já usa. A primeira troca é gratuita em até 30 dias.",
  },
  {
    id: "comprar-look",
    q: "Dá para comprar o look inteiro de uma vez?",
    a: "Sim. No resumo do look, toque numa peça para conferir o tamanho e depois em Comprar look: todas as peças vão para a sacola nos tamanhos escolhidos. Tamanhos esgotados ficam bloqueados.",
  },
  {
    id: "dados",
    q: "Preciso enviar foto ou usar a câmera?",
    a: "Não. O provador usa manequins 3D e só pede altura e peso. O look em andamento fica guardado no seu navegador e os looks salvos ficam vinculados à sua sessão na loja.",
  },
  {
    id: "celular",
    q: "O Provador 3D funciona no celular?",
    a: "Funciona. No celular o manequim fica no topo da tela e as abas Looks, Peças, Corpo e Visual abrem numa gaveta que você arrasta para cima; o resumo do look fica sempre no rodapé. Dá para girar o manequim em 360° e ver em tela cheia.",
  },
  {
    id: "teclado",
    q: "O provador tem atalhos de teclado?",
    a: "Tem. Com o palco na tela, as setas para a esquerda e para a direita trocam o manequim e a tecla R gira o manequim em 360°. Todos os controles também funcionam com Tab e Enter.",
  },
];
