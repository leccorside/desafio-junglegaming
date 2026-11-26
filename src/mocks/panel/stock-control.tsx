import { useId, useState } from 'react'

import type { Nft } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

import { getDb } from '../db/store'

const STATUS_LABELS = { available: 'à venda', sold_out: 'esgotada', unavailable: 'indisponível' }

const editionLabel = (edition: Nft['editions'][number]) =>
  `${edition.name === 'Aberta' ? 'Aberta' : edition.name} · ${STATUS_LABELS[edition.status]} · ${edition.available} disp.`

const selectClass =
  'h-10 w-full rounded-control border border-input bg-background px-2 text-body-sm text-foreground focus-visible:outline-2 focus-visible:outline-primary'

/**
 * Estoque no painel de cenários: escolhe um NFT e uma edição e marca como
 * esgotada, sem recarregar a página (um toast com "Desfazer" na tela continua
 * lá). Usa a mesma rota utilitária dos testes (`POST /__mocks/nfts/:id/update`),
 * então a mudança passa pela API simulada como qualquer outra. O painel não
 * mexe no cache da aplicação: a tela mostra o novo estado na próxima busca (e,
 * a partir do Passo 8, pelo evento em tempo real).
 */
export function StockControl() {
  const nftId = useId()
  const editionId = useId()
  // Lido ao abrir o painel: reflete o banco atual dos mocks.
  const [nfts, setNfts] = useState<Nft[]>(() =>
    [...getDb().nfts].sort((a, b) => a.name.localeCompare(b.name)),
  )
  const [selectedNft, setSelectedNft] = useState(() => nfts[0]?.id ?? '')
  const nft = nfts.find((n) => n.id === selectedNft)
  const [selectedEdition, setSelectedEdition] = useState(() => nft?.editions[0]?.id ?? '')
  const edition = nft?.editions.find((e) => e.id === selectedEdition)
  const [status, setStatus] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const markSoldOut = async () => {
    if (!nft || !edition) return
    setPending(true)
    setStatus(null)
    try {
      const response = await fetch(`/api/__mocks/nfts/${encodeURIComponent(nft.id)}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editionId: edition.id, available: 0 }),
      })
      if (!response.ok) throw new Error(String(response.status))
      setNfts([...getDb().nfts].sort((a, b) => a.name.localeCompare(b.name)))
      setStatus(
        `Edição ${edition.name === 'Aberta' ? 'aberta' : edition.name} de ${nft.name} marcada como esgotada.`,
      )
    } catch {
      setStatus('Não foi possível alterar o estoque.')
    } finally {
      setPending(false)
    }
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-body-sm font-bold text-foreground">Estoque</legend>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={nftId} className="text-caption font-normal text-muted-foreground">
          NFT
        </Label>
        <select
          id={nftId}
          value={selectedNft}
          onChange={(event) => {
            const next = nfts.find((n) => n.id === event.target.value)
            setSelectedNft(event.target.value)
            setSelectedEdition(next?.editions[0]?.id ?? '')
            setStatus(null)
          }}
          className={selectClass}
        >
          {nfts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={editionId} className="text-caption font-normal text-muted-foreground">
          Edição
        </Label>
        <select
          id={editionId}
          value={selectedEdition}
          onChange={(event) => {
            setSelectedEdition(event.target.value)
            setStatus(null)
          }}
          className={selectClass}
        >
          {nft?.editions.map((item) => (
            <option key={item.id} value={item.id}>
              {editionLabel(item)}
            </option>
          ))}
        </select>
      </div>
      <Button
        variant="secondary"
        onClick={() => void markSoldOut()}
        disabled={!edition || pending || edition.status === 'sold_out'}
      >
        {pending ? 'Alterando…' : 'Marcar como esgotada'}
      </Button>
      <p role="status" className="min-h-4 text-caption text-muted-foreground">
        {status}
      </p>
    </fieldset>
  )
}
