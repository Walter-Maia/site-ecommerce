# Imagens da KIM KRISS (geradas no Higgsfield em 22/10/2026)

Todas as pessoas, roupas e a marca são **fictícias**. Nenhuma imagem usa logo de terceiros (os prompts proíbem logos, e os tênis/meias são lisos).

## Elenco fixo

Mesma descrição em todos os prompts para manter os rostos coerentes entre campanha e catálogo.

| Nome | Descrição usada no prompt | Aparece em |
|---|---|---|
| MIA | mulher brasileira, ~22 anos, pele morena média, tranças maria-chiquinha, argolas douradas, sardas | Y2K Drop, baby tee, saia jeans, wide leg, careca creme |
| KAUÃ | homem brasileiro, ~25, pele retinta, cachos curtos, bigode fino, corrente prata | hero Arquibancada, tee 07, corta-vento, oxford, bermuda mesh, tênis |
| LUANA | mulher afro-brasileira, ~28, pele retinta, black power | Social Club (mobile), blazer, top canelado, mesh 23, vestido jersey, padaria |
| THEO | homem brasileiro, ~30, pele oliva, cabelo raspado, tatuagens finas | Social Club, hoodie, regata 16, calça pregas, dad hat, mocassim |
| BIA | mulher nipo-brasileira, ~25, cabelo preto liso em rabo baixo | Social Club, tee São Paulo, calça wide, saia cetim, slip dress, cropped |
| DAVI | homem brasileiro, ~22, pele morena, tranças box braids | hero Arquibancada, jersey pinstripe, varsity, jeans, five panel |

MIA e KAUÃ também são os dois manequins iniciais do Provador 3D (fichas de personagem em `public/images/provador/referencia/`).

## Receita de estilo ("sem cara de IA")

- **Packshot** (`gpt_image_2_5`, high, 2k, 4:5): peça em manequim invisível, papel off-white `#F2F0EB`, luz difusa da esquerda, médio formato 80 mm f/8.
- **Foto vestida** (`gpt_image_2_5` com o packshot como `image_references`): estúdio cinza quente com piso de concreto polido e luz de janela, 35 mm Portra 400 — garante estampa e cor idênticas ao packshot.
- **Campanha** (`gpt_image_2_5`, xhigh, 2k): locações paulistanas reais e plausíveis (arquibancada de estádio de bairro, sala anos 70 com o Copan ao fundo, Minhocão aos domingos, padaria, rua arborizada com sedã anos 70 sem emblema, banca de jornal à noite), filme 35 mm com grão, pele com textura, enquadramento imperfeito, sem retoque.
- O Soul 2 foi testado no piloto: textura de filme ótima, mas erra o texto das estampas ("QUAORA"); por isso o GPT Image ficou como padrão.

## Arquivos

| Pasta | Conteúdo | Tamanho |
|---|---|---|
| `public/images/produtos/<slug>/packshot.webp` | 28 packshots | 1200×1500 |
| `public/images/produtos/<slug>/modelo.webp` | 28 fotos vestidas | 1200×1500 |
| `public/images/editorial/hero-*.webp`, `banner-*.webp` | hero e banners (desktop 16:9 + mobile 2:3) | 1920×1080 / 1080×1620 |
| `public/images/editorial/grade-0[1-4].webp` | grade de 4 fotos da home | 1200×1600 |
| `public/images/editorial/detalhe-0[1-6].webp` | cards verticais "Descubra cada detalhe" | 1080×1920 |
| `public/images/editorial/categoria-*.webp` | recortes 3:4 das fotos vestidas | 900×1200 |
| `public/images/og/*.jpg` | Open Graph (home e provador) | 1200×630 |
| `public/images/provador/referencia/*-model-sheet.webp` | fichas frente/perfil/costas dos manequins MIA e KAUÃ | 1920×1080 |

Conversão: `scripts/assets/fetch-image.mjs` (download HTTPS → sharp → WebP no tamanho final) e `scripts/assets/download-list.mjs` (lote).

Custo total: ≈ 236 créditos (93 imagens + 1 refeita porque o filtro de conteúdo bloqueou a pose original).

## Rebranding QUADRA → KIM KRISS e linha Rolê (22/10/2026, noite)

- **39 fotos editadas** com o original como `image_references` (`gpt_image_2_5`): o prompt troca só a estampa ("QUADRA" → "KIM KRISS", script "Quadra" → "Kim Kriss", monograma "Q" → "KK") e manda manter peça, pessoa, luz e enquadramento. 15 packshots, 16 fotos vestidas e 8 editoriais.
- **Linha Rolê (skate), 12 peças novas** (p29–p40): camiseta boxy Skate Co., manga longa KK, moletom zíper, flanela xadrez, jaqueta workwear, calça cargo, carpinteiro, bermuda cargo, gorro, 2 tênis de skate e skate completo 8,25". Packshot + foto vestida para cada uma, mesma receita do catálogo.
- **Campanha de skate:** `banner-skate.webp` (16:9) e `banner-skate-mobile.webp` (2:3) numa praça de skate do centro de SP; `categoria-skate.webp` é recorte do banner mobile.
- Custo desta rodada: ≈ 200 créditos.
