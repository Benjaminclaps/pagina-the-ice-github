import PedidoDetail from '../../_components/PedidoDetail'

export default async function AdminPedidoDetailPage({
  params,
}: {
  params: Promise<{ groupKey: string }>
}) {
  const { groupKey } = await params

  return <PedidoDetail groupKey={decodeURIComponent(groupKey)} />
}
