import { Tabs as TabsPrimitive } from 'radix-ui'

import { NETWORK_LABELS, type Nft } from '@/api/contracts'
import { shortAddress } from '@/lib/address'

import { RatingStars } from './rating-stars'

const trigger =
  'relative shrink-0 cursor-pointer pb-2.5 text-body leading-4 whitespace-nowrap text-foreground md:text-[17px] transition-colors hover:text-accent-foreground data-[state=active]:font-bold data-[state=active]:text-accent-foreground data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-[3px] data-[state=active]:after:bg-primary'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-body-sm leading-6 font-bold text-foreground">{label}</dt>
      <dd className="text-body-sm leading-6 text-muted-foreground">{children}</dd>
    </div>
  )
}

/**
 * Abas "Detalhes do NFT" e "Avaliações de colecionadores" (frame
 * "Description"). No Figma os rótulos "Contrato" e "Direitos autorais" estão
 * trocados com os textos; aqui cada rótulo fica com o seu valor.
 */
export function NftInfoTabs({ nft }: { nft: Nft }) {
  const network = NETWORK_LABELS[nft.network]
  return (
    <TabsPrimitive.Root defaultValue="details" className="flex flex-col gap-3">
      <TabsPrimitive.List
        aria-label="Informações do NFT"
        className="flex gap-6 overflow-x-auto border-b border-primary/30 pt-1 md:gap-8"
      >
        <TabsPrimitive.Trigger value="details" className={trigger}>
          Detalhes do NFT
        </TabsPrimitive.Trigger>
        <TabsPrimitive.Trigger value="reviews" className={trigger}>
          Avaliações de colecionadores ({nft.rating.count})
        </TabsPrimitive.Trigger>
      </TabsPrimitive.List>

      {/* Os painéis entram no Tab (tabindex=0 do Radix): ficam com o anel de
          foco global, sem `outline-none`. */}
      <TabsPrimitive.Content value="details" className="flex flex-col gap-3">
        <p className="text-body-sm leading-6 text-muted-foreground">
          {nft.description} A propriedade inclui a arte em alta resolução e um registro permanente
          de procedência na rede. {nft.creator.name} recebe {nft.royaltyPercent}% de direitos
          autorais nas vendas secundárias.
        </p>
        <dl className="flex flex-col gap-3">
          <Field label="Criador:">{nft.creator.name}</Field>
          <Field label="Rede:">
            Cunhado na {network} com procedência imutável e metadados armazenados no IPFS.
          </Field>
          <Field label="Contrato:">
            <span title={nft.contract.address} className="break-all">
              {shortAddress(nft.contract.address)}
            </span>{' '}
            • Contrato inteligente {nft.contract.standard} verificado.
          </Field>
          <Field label="Direitos autorais:">
            Direitos autorais do criador: {nft.royaltyPercent}% nas vendas secundárias, pagos
            automaticamente pelos mercados compatíveis.
          </Field>
        </dl>
      </TabsPrimitive.Content>

      <TabsPrimitive.Content value="reviews" className="flex flex-col gap-3">
        <RatingStars average={nft.rating.average} count={nft.rating.count} />
        <p className="text-body-sm text-muted-foreground">
          Os comentários dos colecionadores não estão disponíveis nesta demonstração. A nota acima é
          a média enviada pela API.
        </p>
      </TabsPrimitive.Content>
    </TabsPrimitive.Root>
  )
}
