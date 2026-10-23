# Provador 3D — prompt adaptado (base: prompt "DRESSR" do Higgsfield)

O prompt original descreve uma **imagem** de landing page Y2K/PS2. Aqui ele vira uma **interface real e funcional** dentro da loja KIM KRISS. O que muda:

| Original | Adaptação KIM KRISS |
|---|---|
| Serviço "DRESSR" genérico | Feature da própria loja: **Provador KIM KRISS · SELECT YOUR FIT** |
| Imagem estática 16:9 | Seção interativa e responsiva (desktop 16:9 → tablet 2 colunas → celular empilhado com bottom sheet) |
| Avatar MIA fixo em T-pose | Manequim 3D procedural ao vivo (MIA feminino e KAUÃ masculino de início; o admin cria outros) com **altura, peso, pele, cabelo e estilo formal/informal** |
| Números decorativos (42 itens, 98% match) | Números **reais**: peças carregadas do catálogo, curtidas, caimento calculado das medidas |
| Grade 7×5 de avatares aleatórios | **Looks prontos** (curadoria) + **Meus looks** salvos; blocos "OFF ?" = próximos drops |
| Botões de enfeite | Ações reais: girar, trocar manequim, provar, salvar look, comprar o look inteiro |
| Inglês | Interface em **português**, mantendo poucos termos de game em inglês como assinatura (SELECT YOUR FIT, PLAYER 01, START) |

## Direção de arte (manter do original)

- Fundo aqua profundo em gradiente `#0A4A6B → #5BC0D8`, piso de showroom em **grade wireframe em perspectiva**, linha de horizonte com brilho suave.
- Overlay sutil de **scanlines CRT**, brilho de monitor, partículas de brilho esparsas (poucas, lentas; desligadas em `prefers-reduced-motion`).
- Painéis com **moldura cromada biselada**, vidro brilhante translúcido, LEDs.
- Tipografia: pixel (Press Start 2P) para rótulos de UI, LCD (VT323) para leituras/status, título principal em **letras cromadas 3D "bubble"** (gradientes + sombras em camadas/SVG, nada de imagem).
- Paleta: magenta `#FF3D8E`, ciano `#4FE5FF`, cromo `#D4E4EC`, verde LCD `#7FFF7F`, contornos brancos, sombras pretas suaves.
- Acabamento: aberração cromática leve só nos títulos, glow controlado, dither sutil. **Sem cara de IA**: nada de gradiente roxo genérico, glassmorphism sem propósito ou ícones aleatórios; cada efeito tem função.

## Composição (desktop)

1. **Banner título** (topo-esquerda): painel cromado arredondado com LEDs — `SELECT YOUR FIT` em pixel magenta com contorno branco.
2. **HUD de status** (topo-direita), pílulas empilhadas:
   - `STATUS: PRONTO` + LED verde piscando
   - `PLAYER 01 · ONLINE` (ou o primeiro nome do cliente logado)
   - `PROVADOR · NV. 07` + barra de progresso = % do look montado (peças/slots)
3. **Painel "Seu personagem"** (terço esquerdo): canvas 3D com o manequim.
   - Placa de nome em LCD verde: `MIA · LOOK Nº 03` com brilho girando.
   - Botões cromados: `← ANTERIOR · GIRAR · PRÓXIMO →` (troca de manequim) e `PROVAR 🔄` (veste o look selecionado).
   - Painel de leitura ao lado:
     ```
     TROCA DE LOOK
     STATUS ......... ATIVO
     PEÇAS .......... 28 CARREGADAS
     CAIMENTO ....... 94%
     ```
4. **Título central**: `PROVE / TUDO.` em cromo bubble (ciano no topo, reflexo rosa embaixo, brilhos nos cantos); subtítulo magenta com contorno pixel: `antes de comprar, vista — virtualmente.`
5. **Grade de looks** (direita): miniaturas com borda ciano; a selecionada tem borda rosa pulsante + cursor de seleção; blocos `OFF ?` travados. Barra de rolagem com puxador rosa e legenda `11 / 14 LOOKS CARREGADOS`.
6. **CTAs** em pílula cromada: `▶ COMEÇAR PROVA` (magenta) e `COMO FUNCIONA` (ciano).
7. **Estatísticas** (baixo-esquerda): `PROVADOR STATS — PEÇAS 28 · MANEQUINS 2 · CONFIANÇA 94%` + troféu em pixel art com brilho rosa.
8. **Minimapa** (baixo-direita): círculo cromado com ponto rosa sobre grade aqua — `VOCÊ ESTÁ AQUI · SHOWROOM 03 · PROVADOR`.
9. **Ticker** (faixa inferior): `CARREGANDO… · 28 PEÇAS · CAIMENTO POR MEDIDA · SALVE SEU LOOK · ALTURA E PESO AJUSTÁVEIS · CARREGANDO…`

## Funcionalidades obrigatórias

- **Curtidas**: lista das peças curtidas (coração na loja e no próprio provador). Selecionar uma peça veste no manequim.
- **Busca por nome** em todo o catálogo, com filtro por tipo (cabeça, parte de cima, sobreposição, parte de baixo, vestido, pés).
- **Montar look**: um item por slot (vestido ocupa cima + baixo; sobreposição vai por cima da parte de cima). Trocar tamanho por peça.
- **Corpo**: sliders de **altura (145–205 cm)** e **peso (40–150 kg)**; o corpo se deforma em tempo real; mostra medidas estimadas (busto/tórax, cintura, quadril) e o **tamanho recomendado** de cada peça.
- **Caimento real**: compara medidas da peça (tabela) com as do corpo → `JUSTO / IDEAL / SOLTO / GRANDE`, comprimento (barra subindo/descendo, calça empilhando ou curta) e índice de caimento do look.
- **Visual do manequim**: tom de pele, cor e estilo de cabelo, **estilo formal ou informal** (postura, acabamento e cenário).
- **Ver o conjunto completo**: girar 360°, zoom, enquadramento corpo inteiro, vista frente/costas.
- **Salvar look** e **Comprar o look** (adiciona todas as peças com os tamanhos escolhidos ao carrinho).
- **Admin** define quantos manequins existem e como é cada um (corpo, pele, cabelo, estilo, medidas iniciais, ativo/inativo, ordem).
