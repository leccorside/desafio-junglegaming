# Deploy

## Plataforma

Vercel, com o preset de Vite. A aplicação é estática e os mocks rodam no navegador, então não há servidor.

## Build

```bash
npm ci
npm run build -- --mode mocks   # build de demonstração em dist/, com mocks
npm run preview                 # serve dist/ em http://localhost:4173
```

O modo `mocks` carrega o `.env.mocks` (versionado), que liga o MSW. O `mockServiceWorker.js` vai de `public/` para `dist/`. O `vercel.json` já define esse comando de build, então não é preciso configurar nada no painel.

## Variáveis de ambiente

| Variável | Produção (demonstração) | Descrição |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` (vem do `.env.mocks`) | Liga o MSW REST e Socket.IO |
| `VITE_API_URL` | `/api` (padrão do código) | Base REST |
| `VITE_SOCKET_URL` | a definir no Passo 8 | Endereço interceptado pelo binding |

Os valores ficam espelhados em `.env.example`. Só é preciso cadastrar variáveis no painel da Vercel se algum valor diferir do padrão.

## Rotas da SPA

`vercel.json` reescreve qualquer rota para `index.html`, para que acesso direto e refresh funcionem em todas as telas:

```json
{
  "rewrites": [
    {
      "source": "/((?!assets/|mockServiceWorker\\.js|favicon\\.svg).*)",
      "destination": "/index.html"
    }
  ]
}
```

O `mockServiceWorker.js` precisa ser servido como arquivo, sem rewrite e sem cache longo.

## Cabeçalhos

- Assets com hash: `Cache-Control: public, max-age=31536000, immutable`.
- `index.html` e `mockServiceWorker.js`: sem cache longo.

## Conferência depois de cada deploy

- [ ] A URL pública abre e o catálogo carrega dos mocks.
- [ ] Acesso direto e refresh funcionam em `/nft/<id>`, `/cart`, `/checkout`, `/orders/<id>`, `/profile` e `/wallets`.
- [ ] Login com as credenciais fictícias funciona.
- [ ] Um evento `nft.updated` disparado pelo painel aparece no carrinho.
- [ ] O commit publicado corresponde ao código entregue.

## Endereços

| Ambiente | URL |
| --- | --- |
| Produção | [desafio-junglegaming-two.vercel.app](https://desafio-junglegaming-two.vercel.app) |
| Preview | Gerado a cada `vercel deploy` sem `--prod` (protegido por login da Vercel) |

## Como publicar

O projeto `desafio-junglegaming` na Vercel está conectado ao repositório `leccorside/desafio-junglegaming` no GitHub, com `main` como branch de produção:

- push na `main`: deploy de produção automático;
- push em outro branch ou pull request: deploy de preview.

Para publicar sem push, pelo CLI (a pasta `.vercel/`, fora do repositório, guarda o vínculo):

```bash
npx vercel deploy --prod --yes
```

O CLI respeita o `.gitignore`, então o `.env` local não é enviado. Nos dois caminhos o build roda na Vercel com o comando do `vercel.json`.

### Versão do Node

O build na Vercel roda no **Node 24.x**, a mesma versão do desenvolvimento local (`.nvmrc`). Duas configurações garantem isso:

- `engines.node` no `package.json` é `">=22 <25"`. A Vercel dá prioridade ao `engines` sobre a configuração do projeto e escolhe a **maior** versão que ele permite. Com `>=22 <27`, ela usava o 26.x mesmo com o projeto em 24.x (conferido em 25/11/2026).
- O projeto na Vercel também está em 24.x (Settings → General → Node.js Version), como reforço.

Para subir de versão: testar localmente, trocar o `.nvmrc`, ampliar o limite do `engines` e ajustar o projeto na Vercel.

## Alternativas aceitas

Netlify e Cloudflare Pages também atendem o enunciado. Nos dois casos é preciso configurar o fallback de SPA (`_redirects`) e garantir que o `mockServiceWorker.js` seja servido sem rewrite.
