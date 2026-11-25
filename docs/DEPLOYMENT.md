# Deploy

## Plataforma

Vercel, com o preset de Vite. A aplicação é estática e os mocks rodam no navegador, então não há servidor.

## Build

```bash
npm ci
npm run build      # gera dist/
npm run preview    # serve dist/ localmente para conferir
```

O build de demonstração mantém `VITE_ENABLE_MOCKS=true` e inclui `mockServiceWorker.js` em `dist/`.

## Variáveis de ambiente

| Variável | Produção (demonstração) | Descrição |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Liga o MSW REST e Socket.IO |
| `VITE_API_URL` | `/api` | Base REST |
| `VITE_SOCKET_URL` | a definir no Passo 8 | Endereço interceptado pelo binding |

Configuradas no painel da Vercel e espelhadas em `.env.example`.

## Rotas da SPA

`vercel.json` reescreve qualquer rota para `index.html`, para que acesso direto e refresh funcionem em todas as telas:

```json
{
  "rewrites": [{ "source": "/((?!assets/|mockServiceWorker\\.js).*)", "destination": "/index.html" }]
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
| Produção | a definir (Passo 0) |
| Preview | Gerado pela Vercel a cada push |

## Alternativas aceitas

Netlify e Cloudflare Pages também atendem o enunciado. Nos dois casos é preciso configurar o fallback de SPA (`_redirects`) e garantir que o `mockServiceWorker.js` seja servido sem rewrite.
