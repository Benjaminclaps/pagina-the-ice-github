import ClienteEditor from '../../_components/ClienteEditor'

export default async function AdminClientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <ClienteEditor customerId={id} />
}
