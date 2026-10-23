# KIM KRISS® — arquitetura do e-commerce de demonstração

Marca **fictícia** de streetwear esportivo paulistano. Visual da loja inspirado no padrão editorial de lojas de streetwear premium (fundo claro, fotos sangradas, serifa nos títulos, carrosséis com barra de progresso), **sem copiar marca, logo ou textos de terceiros**. Diferencial: **Provador 3D** em estética Y2K/PS2 ("SELECT YOUR FIT"), com manequins configuráveis.

## Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Framework | Next.js 16.4 (App Router, Turbopack), React 19.3, TypeScript strict | SSR para SEO, Server Actions com proteção de origem embutida |
| Estilo | Tailwind v4 + tokens em `src/app/globals.css` (+ CSS Modules quando o efeito pedir) | Tokens únicos para loja e provador |
| 3D | three 0.186 + @react-three/fiber 9 + drei 10 + postprocessing | Manequim e roupas procedurais low-poly |
| Banco | SQLite via `node:sqlite` (embutido no Node 24, sem binário nativo) em `data/quadra.db` | Zero setup, transações, queries parametrizadas |
| Validação | zod 4 | Toda entrada de usuário é validada no servidor |
| Testes | vitest | Segurança, cálculo de preço, caimento |

> **Next 16 não é o Next que você conhece.** Antes de escrever código, leia o guia relevante em `node_modules/next/dist/docs/` (ex.: `01-app/01-getting-started/16-proxy.md`, `01-app/02-guides/content-security-policy.md`, `authentication.md`, `data-security.md`, `json-ld.md`, `forms.md`). `middleware.ts` agora é **`src/proxy.ts`** (função `proxy`). `params`/`searchParams`/`cookies()`/`headers()` são assíncronos.

**Cache Components/PPR estão desligados** (ver `next.config.ts`): a CSP com nonce exige renderização dinâmica. Não religar.

## Mapa de pastas e dono de cada área

Cada agente só edita a própria área. Mudanças em contratos compartilhados passam pelo arquiteto.

| Área | Dono |
|---|---|
| `src/lib/types.ts`, `src/data/**`, `src/lib/format.ts`, `src/lib/seo/jsonld.tsx`, `docs/ARQUITETURA.md` | Arquiteto (contratos) |
| `src/server/**` (inclui `actions/`), `src/proxy.ts`, `src/app/api/**`, `scripts/**`, `next.config.ts` (headers), `.env.example`, `src/app/(conta)/**` (entrar, cadastro, conta), `src/app/admin/**`, `src/components/admin/**`, testes de servidor | **Backend & Segurança** |
| `src/app/(loja)/**` exceto `provador/`, `src/components/loja/**`, `src/app/globals.css` (pode estender), `public/icon.svg` | **Loja (UI)** |
| `src/app/(loja)/provador/**`, `src/components/provador/**`, `src/lib/provador/**` | **Provador 3D** |
| `src/app/sitemap.ts`, `robots.ts`, `manifest.ts`, ícones, `not-found.tsx`, `src/app/llms.txt/route.ts` e `llms-full.txt/route.ts`, `src/lib/seo/{metadata,llms}.ts` | **SEO/AEO** (fase 2) |
| `public/images/**` (fotos geradas no Higgsfield) | Arquiteto |

## Contratos (não mudar assinaturas sem combinar)

Leitura (server-only): `src/server/catalog.ts`, `mannequins.ts`, `session.ts`, `cart.ts`, `wishlist.ts`, `looks.ts`, `orders.ts`.
Mutação (Server Actions): `src/server/actions/{cart,wishlist,looks,auth,checkout,newsletter}.ts`.
Resultados de ação: `ActionResult<T>` (`src/lib/types.ts`); formulários usam `FormState` + `useActionState`.

Hoje os contratos têm implementação provisória em memória (`src/server/_dev-store.ts`); o Backend troca o interior por SQLite mantendo as assinaturas.

## Rotas

| Rota | Conteúdo |
|---|---|
| `/` | Home editorial + seção teaser do provador |
| `/novidades`, `/masculino`, `/feminino`, `/categoria/[slug]` | Listagens com filtros |
| `/produto/[slug]` | PDP com galeria, tamanhos, tabela de medidas, "Provar no Provador 3D" |
| `/busca?q=` | Busca |
| `/carrinho`, `/checkout`, `/pedido/[id]` | Compra (pagamento **simulado**) |
| `/ajuda` | FAQ (AEO) |
| `/provador` | Provador 3D completo (`?look=<id>` ou `?add=<slug>` pré-carregam peças) |
| `/entrar`, `/cadastro`, `/conta` | Conta |
| `/admin/**` | Painel (somente `role=admin`): produtos, manequins, pedidos |

## Segurança (linha de base obrigatória)

- **CSP estrita com nonce** em `src/proxy.ts`: `script-src 'self' 'nonce-…' 'strict-dynamic'`; `style-src 'self' 'unsafe-inline'` (atributos style do React); `img-src 'self' data: blob:`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`. Demais cabeçalhos em `next.config.ts` (HSTS em produção, nosniff, Referrer-Policy, Permissions-Policy, COOP).
- **Senhas**: `crypto.scrypt` com sal por usuário e `timingSafeEqual`. Nunca logar senha nem hash.
- **Sessão**: token aleatório de 256 bits; no banco só o SHA-256; cookie `httpOnly`, `SameSite=Lax`, `Secure` em produção; rotação no login; expiração deslizante; logout invalida no servidor.
- **Autorização** verificada **em cada página e ação** do admin (`requireAdmin()`), não só no proxy.
- **Entrada**: zod em toda Server Action/rota; preço, frete e estoque **sempre recalculados no servidor** dentro de transação.
- **Rate limit** em login, cadastro, checkout e newsletter (por IP, por e-mail e global; a tentativa conta antes do scrypt para não ser burlada em paralelo). Em produção, defina `TRUSTED_IP_HEADER` ou `TRUSTED_PROXY_HOPS` (ver `.env.example`) para o IP não ser forjável.
- **Pagamento simulado**: dados de cartão nunca são enviados ao servidor (campos sem `name`); em produção usar tokenização do gateway (PCI).
- Mensagens de erro genéricas para o cliente; `import "server-only"` em todo módulo de servidor; DTOs sem campos sensíveis.
- `JsonLd` escapa `<` — nunca injetar HTML de usuário.

## SEO e AEO

- SSR em todas as páginas públicas; `generateMetadata` com título, descrição, canonical e Open Graph por página.
- JSON-LD via `src/lib/seo/jsonld.tsx`: `OnlineStore` + `WebSite/SearchAction` (layout), `Product` + `BreadcrumbList` (PDP), `ItemList` (listagens), `FAQPage` (/ajuda e provador).
- AEO: respostas curtas e autocontidas (`FAQ` em `src/data/site.ts`), títulos em forma de pergunta, `/llms.txt` e `/llms-full.txt` gerados do catálogo, HowTo no provador, HTML semântico (`main`, `nav`, `article`, `h1` único).
- Imagens com `next/image`, `alt` descritivo, `sizes` corretos; 3D carregado sob demanda (dynamic import) para não pesar o LCP.

## Imagens

Geradas no Higgsfield (personagens e roupas fictícios). Caminhos fixos:
- Produto: `/images/produtos/<slug>/packshot.webp` e `/modelo.webp` (1200×1500, 4:5)
- Editorial: `/images/editorial/<nome>.webp`
- Provador: `/images/provador/looks/<look-id>.webp`, referências de personagem em `/images/provador/referencia/`

Lista e prompts em `docs/ASSETS.md`. Enquanto uma imagem não existir, o layout deve manter a proporção (caixa com `aspect-ratio`, fundo `--sand`).

## Rodar

```bash
npm run dev        # http://localhost:3000
npx tsc --noEmit   # tipos
npm run lint
npx vitest run
```
