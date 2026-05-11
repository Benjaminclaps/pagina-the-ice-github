import AgendaWorkspace from './_components/TwoWeekCalendar'

export default function AgendaPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#12304f_0%,_#08111d_55%,_#030712_100%)] px-4 pt-20 pb-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 md:pt-4">
        <AgendaWorkspace />
      </div>
    </div>
  )
}
