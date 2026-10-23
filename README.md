# KIM KRISS® — e-commerce de demonstração com Provador 3D

Loja de streetwear e skate de **demonstração** (pessoas, avaliações e pagamentos são simulados; 40 produtos com a linha de skate Rolê). Visual editorial inspirado em lojas de streetwear premium e, como diferencial, o **Provador 3D "SELECT YOUR FIT"**: manequins low-poly estilo PS2 em que o cliente ajusta altura e peso, troca pele, cabelo e estilo (formal/informal), veste as peças que curtiu, vê o caimento de cada tamanho e compra o look inteiro.

## Rodar

```bash
npm install
npm run dev            # http://localhost:3000 (o banco SQLite é criado e populado no primeiro acesso)
```

Produção local:

```bash
npm run build && npm start
```

| Comando | O que faz |
|---|---|
| `npm test` | 120 testes (segurança, checkout, caimento, regras de slot) |
| `npm run lint` / `npx tsc --noEmit` | lint e tipos |
| `npm run db:seed` | popula o banco e gera os segredos que faltarem em `.env.local` |
| `npm run db:reset` | recria o banco (pare o `npm run dev` antes: o Windows trava o arquivo) |
| `npm run db:seed -- --reset-admin-password` | gera nova senha de admin e derruba as sessões |

**Admin:** `/admin`, usuário `admin@kimkriss.test`. A senha é gerada no seed e fica **só** em `.env.local` (`ADMIN_SEED_PASSWORD`), que não vai para o git.

## O que tem

- **Loja** (`/`, `/novidades`, `/masculino`, `/feminino`, `/categoria/*`, `/produto/*`, `/busca`, `/carrinho`, `/checkout`, `/pedido/*`, `/ajuda`): hero editorial, carrosséis com barra de progresso, grade de campanha, banners com direção de arte mobile/desktop, PDP com tabela de medidas, sacola lateral, checkout com pagamento **simulado**.
- **Provador 3D** (`/provador`, também como teaser na home): curtidas, busca por nome, looks prontos e salvos, sliders de altura (145–205 cm) e peso (40–150 kg) com medidas estimadas, tamanho recomendado e caimento real de cada peça; pele, cabelo (9 estilos), formal/informal; girar 360°, frente/costas, tela cheia; salvar e comprar o look.
- **Admin**: painel, produtos (preço, estoque por tamanho, destaque), **manequins** (quantos quiser, de cada corpo, pele, cabelo e estilo, com pré-visualização 3D ao vivo), pedidos; tudo auditado.
- **Conta**: cadastro, login, pedidos, looks salvos.

## Documentação

- [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md): stack, pastas, contratos, segurança, SEO/AEO.
- [`docs/PROVADOR-PROMPT-ADAPTADO.md`](docs/PROVADOR-PROMPT-ADAPTADO.md): o prompt Y2K do Higgsfield adaptado para a interface real.
- [`docs/ASSETS.md`](docs/ASSETS.md): elenco fictício, receita das fotos e arquivos gerados no Higgsfield.

## Segurança (resumo)

CSP estrita com nonce por requisição · senhas com scrypt · sessões de 256 bits com hash no banco, rotação e expiração · autorização checada em toda página e ação do admin · zod em todas as entradas · preço/frete/estoque recalculados no servidor em transação · rate limit (IP, e-mail e global) · proteção contra IDOR, open redirect, SQL injection e XSS no JSON-LD · dados de cartão nunca chegam ao servidor. Revisão independente feita, com testes de regressão para cada correção.

**Antes de publicar:** defina `NEXT_PUBLIC_SITE_URL`, `SESSION_SECRET` e `TRUSTED_IP_HEADER` ou `TRUSTED_PROXY_HOPS` (ver `.env.example`), sirva em HTTPS, troque as avaliações fictícias por reais (ou remova o `aggregateRating`) e integre um gateway de pagamento com tokenização.
