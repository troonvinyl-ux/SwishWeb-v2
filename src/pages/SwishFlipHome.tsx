import { ArrowRight, ArrowUpRight, BarChart3, Boxes, Camera, Check, ChevronRight, CircleHelp, Coins, Disc3, Gem, Landmark, Menu, MonitorSmartphone, PanelsTopLeft, ScanLine, Shirt, Sparkles, Stamp, Store, Wrench } from 'lucide-react';
import { PRODUCTS, type ProductId } from '@/lib/productContext';
import { SwishFlipMark } from '@/components/brand/SwishFlipMark';
import { SWISHFLIP, WORKSPACE_ACCENTS } from '@/lib/swishflipBrand';

const workspaceIcons: Record<ProductId, typeof Coins> = {
  coins: Coins, tunes_flip: Disc3, antiques: Landmark, clothing: Shirt, tech: MonitorSmartphone, trading_cards: PanelsTopLeft,
  bicycles: Wrench, motocross: Wrench, fossils: Gem, beauty: Sparkles, stamps: Stamp, collectibles: Boxes, surplus_flip: Boxes,
};

const workspaceRoutes: Record<ProductId, string> = {
  coins: '/coins', tunes_flip: '/tunes', antiques: '/antiques', clothing: '/threads', tech: '/tech', trading_cards: '/cards',
  bicycles: '/bikes', motocross: '/mx', fossils: '/fossils', beauty: '/beauty', stamps: '/stamps', collectibles: '/collectibles', surplus_flip: '/surplus',
};

const featuredWorkspaceIds = new Set<ProductId>(['coins', 'tunes_flip', 'antiques', 'collectibles']);

const faqs = [
  ['Does SWISHFlip replace specialist knowledge?', 'No. SWISH AI structures the evidence, research and draft creation; the reseller remains in control of the final identification, condition, pricing and publication.'],
  ['Does it use one account across specialist workspaces?', 'Yes. Authorised workspaces use the existing shared customer identity, subscription and inventory architecture.'],
  ['Are listings automatically published?', 'No. SWISHFlip prepares evidence-led listing drafts. Publication follows the existing seller review and marketplace confirmation flow.'],
  ['Which marketplaces are supported?', 'The connected eBay workflow remains the marketplace engine. Additional marketplaces are only presented when they are genuinely available to the signed-in account.'],
];

function WorkflowStep({ number, title, detail, icon: Icon }: { number: string; title: string; detail: string; icon: typeof Camera }) {
  return <div className="relative flex gap-4 border-l border-white/15 pl-5 last:border-l-0 lg:block lg:border-l-0 lg:px-5">
    <div className="absolute -left-[11px] top-0 grid h-5 w-5 place-items-center rounded-full border border-[#F4C65D]/60 bg-[#071C26] text-[9px] font-bold text-[#F4C65D] lg:static lg:mb-5 lg:h-9 lg:w-9 lg:text-xs">{number}</div>
    <div><Icon className="mb-3 hidden h-6 w-6 text-[#19B5AC] lg:block" /><h3 className="font-heading text-base font-bold text-[#F5F8FA]">{title}</h3><p className="mt-1 text-sm leading-6 text-[#91A6B2]">{detail}</p></div>
  </div>;
}

export default function SwishFlipHome() {
  return <main className="min-h-screen overflow-hidden bg-[#071C26] text-[#F5F8FA]">
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#071C26]/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-5 lg:px-8">
        <a href="/" aria-label="SWISHFlip home"><SwishFlipMark descriptor /></a>
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Public navigation">
          <a className="text-sm font-medium text-[#F5F8FA] transition hover:text-[#F4C65D]" href="#workflow">How it works</a>
          <a className="text-sm font-medium text-[#F5F8FA] transition hover:text-[#F4C65D]" href="#workspaces">Specialist workspaces</a>
          <a className="text-sm font-medium text-[#F5F8FA] transition hover:text-[#F4C65D]" href="#plans">Plans</a>
          <a className="text-sm font-medium text-[#F5F8FA] transition hover:text-[#F4C65D]" href="#faq">FAQs</a>
        </nav>
        <div className="flex items-center gap-3">
          <a href="/coins" className="hidden rounded-lg px-4 py-2.5 text-sm font-semibold text-[#F5F8FA] transition hover:bg-white/5 sm:block">Sign in</a>
          <a href="/coins" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#F4C65D] px-4 py-2.5 text-sm font-bold text-[#071C26] transition hover:brightness-105">Get started <ArrowRight className="h-4 w-4" /></a>
          <Menu className="h-5 w-5 text-[#F5F8FA] lg:hidden" aria-label="Menu" />
        </div>
      </div>
    </header>

    <section className="relative isolate overflow-hidden border-b border-white/10">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_76%_8%,rgba(25,181,172,.23),transparent_30%),radial-gradient(circle_at_64%_72%,rgba(244,198,93,.12),transparent_32%),linear-gradient(125deg,#071C26_0%,#102D39_57%,#071C26_100%)]" />
      <div className="absolute right-[-18rem] top-[-14rem] -z-10 h-[42rem] w-[42rem] rounded-full border border-[#19B5AC]/15" />
      <div className="absolute right-[-11rem] top-[-7rem] -z-10 h-[29rem] w-[29rem] rounded-full border border-[#F4C65D]/15" />
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:py-24 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:py-28">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#19B5AC]/40 bg-[#19B5AC]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[.14em] text-[#8EE6DE]"><Sparkles className="h-3.5 w-3.5" /> {SWISHFLIP.intelligence}</div>
          <h1 className="font-heading mt-6 text-4xl font-extrabold leading-[1.08] tracking-[-.04em] sm:text-5xl lg:text-6xl">Turn what you have<br />into <span className="text-[#F4C65D]">what it’s worth.</span></h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#D9E5E9]">Identify items. Discover supported value. Create professional listings. Manage your entire resale business — all in one intelligent platform.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/coins" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#F4C65D] px-5 text-sm font-bold text-[#071C26] transition hover:brightness-105">Get started <ArrowRight className="h-4 w-4" /></a>
            <a href="#workflow" className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-[#91A6B2]/55 px-5 text-sm font-semibold text-[#F5F8FA] transition hover:border-[#F4C65D] hover:text-[#F4C65D]">See how it works <ChevronRight className="h-4 w-4" /></a>
          </div>
          <div className="mt-9 grid max-w-2xl grid-cols-2 gap-x-6 gap-y-3 text-sm text-[#D9E5E9] sm:grid-cols-3">
            {['Evidence-led identification', 'Specialist research', 'Customer-approved publishing'].map(text => <span key={text} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#F4C65D]" />{text}</span>)}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md self-center">
          <div className="rounded-[2rem] border border-white/20 bg-[#071C26] p-3 shadow-2xl shadow-black/40">
            <div className="overflow-hidden rounded-[1.45rem] border border-white/10 bg-[#102D39]">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><SwishFlipMark compact /><span className="text-xs font-semibold tracking-wide text-[#F4C65D]">SWISH AI</span></div>
              <div className="p-5">
                <div className="relative grid aspect-[5/4] place-items-center overflow-hidden rounded-xl border border-[#19B5AC]/35 bg-[radial-gradient(circle_at_50%_44%,rgba(244,198,93,.15),transparent_28%),linear-gradient(135deg,#102D39,#071C26)]">
                  <div className="absolute inset-5 border-2 border-dashed border-[#F4C65D]/70" />
                  <ScanLine className="h-20 w-20 text-[#F4C65D]" strokeWidth={1.25} />
                  <span className="absolute bottom-4 rounded-full bg-[#19B5AC]/20 px-3 py-1 text-xs font-semibold text-[#A5F2EC]">Guided evidence capture</span>
                </div>
                <div className="mt-4 rounded-xl border border-[#19B5AC]/35 bg-[#071C26]/70 p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-[#8EE6DE]"><Sparkles className="h-3.5 w-3.5" /> SWISH intelligence</div><p className="mt-2 font-heading text-base font-bold">Capture the next evidence view</p><p className="mt-1 text-sm leading-6 text-[#91A6B2]">The selected specialist workspace asks for the details needed to support identification and valuation.</p></div>
                <a href="/identify" className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#F4C65D] px-4 text-sm font-bold text-[#071C26]">Open the live scanner <ArrowUpRight className="h-4 w-4" /></a>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-5 -left-8 hidden rounded-lg border border-[#F4C65D]/40 bg-[#102D39] px-4 py-3 shadow-xl lg:block"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#F4C65D]">One workflow</p><p className="mt-1 text-sm font-semibold">Scan · Identify · Value · Sell</p></div>
        </div>
      </div>
    </section>

    <section id="workflow" className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
      <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#19B5AC]">The SWISHFlip workflow</p><h2 className="font-heading mt-3 text-3xl font-bold tracking-[-.03em] sm:text-4xl">From unknown item to a customer-approved listing.</h2><p className="mt-4 text-base leading-7 text-[#91A6B2]">The platform retains your original evidence, shows the source behind verified information, and separates AI suggestions from seller decisions.</p></div>
      <div className="mt-10 grid gap-7 lg:grid-cols-5 lg:gap-0">
        <WorkflowStep number="1" title="Scan" detail="Capture photos, barcode data and known details." icon={Camera} />
        <WorkflowStep number="2" title="Identify" detail="Use niche-aware guidance and specialist references." icon={ScanLine} />
        <WorkflowStep number="3" title="Value" detail="Review supported ranges, comparables and uncertainty." icon={BarChart3} />
        <WorkflowStep number="4" title="Sell" detail="Prepare accurate, reviewable marketplace drafts." icon={Store} />
        <WorkflowStep number="5" title="Manage" detail="Track inventory, listings, sales and actions." icon={Boxes} />
      </div>
    </section>

    <section id="workspaces" className="border-y border-white/10 bg-[#102D39]/55">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#F4C65D]">Specialist workspaces</p><h2 className="font-heading mt-3 text-3xl font-bold tracking-[-.03em] sm:text-4xl">One platform. Every kind of reseller.</h2><p className="mt-4 text-base leading-7 text-[#91A6B2]">Each workspace uses the same customer account, inventory architecture and marketplace engine — with the specialist context your category needs.</p></div><a href="/coins" className="inline-flex items-center gap-2 text-sm font-semibold text-[#F4C65D] hover:text-[#F5F8FA]">Choose a workspace <ArrowRight className="h-4 w-4" /></a></div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {PRODUCTS.map(workspace => {
            const Icon = workspaceIcons[workspace.id];
            const presentation = WORKSPACE_ACCENTS[workspace.id];
            const featured = featuredWorkspaceIds.has(workspace.id);
            return <a href={workspaceRoutes[workspace.id]} key={workspace.id} className="group min-h-[178px] rounded-xl border border-white/10 bg-[#071C26]/75 p-5 transition hover:-translate-y-0.5 hover:border-[#F4C65D]/60 hover:bg-[#071C26]" style={{ boxShadow: featured ? `inset 0 1px 0 ${presentation?.accent ?? SWISHFLIP.colors.teal}33` : undefined }}>
              <div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg border" style={{ color: presentation?.accent, borderColor: `${presentation?.accent ?? SWISHFLIP.colors.teal}55`, background: `${presentation?.accent ?? SWISHFLIP.colors.teal}15` }}><Icon className="h-5 w-5" /></span>{featured && <span className="rounded-full bg-[#F4C65D]/15 px-2 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-[#F4C65D]">Featured</span>}</div>
              <h3 className="font-heading mt-6 text-lg font-bold">{workspace.name}</h3><p className="mt-2 text-sm leading-6 text-[#91A6B2]">{workspace.description}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: presentation?.accent }}>Open workspace <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span>
            </a>;
          })}
        </div>
      </div>
    </section>

    <section className="mx-auto grid max-w-7xl gap-8 px-5 py-16 lg:grid-cols-[.85fr_1.15fr] lg:px-8 lg:py-24">
      <div className="rounded-xl border border-[#19B5AC]/30 bg-[#102D39] p-7"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#8EE6DE]">Built for operations</p><h2 className="font-heading mt-3 text-2xl font-bold tracking-[-.03em]">A reseller platform, not just a listing generator.</h2><p className="mt-4 leading-7 text-[#91A6B2]">SWISHFlip connects the work around every listing: evidence capture, inventory, marketplace status, sales, profitability and the next best action.</p><a href="/coins" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#19B5AC]/60 px-4 text-sm font-semibold text-[#A5F2EC] transition hover:bg-[#19B5AC] hover:text-[#071C26]">Explore the platform <ArrowRight className="h-4 w-4" /></a></div>
      <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-white/10 bg-[#102D39]/55 p-5"><Boxes className="h-6 w-6 text-[#F4C65D]" /><h3 className="font-heading mt-4 font-bold">Shared inventory</h3><p className="mt-2 text-sm leading-6 text-[#91A6B2]">Keep photographs, stock locations, costs and sales history in one record.</p></div><div className="rounded-xl border border-white/10 bg-[#102D39]/55 p-5"><Store className="h-6 w-6 text-[#F4C65D]" /><h3 className="font-heading mt-4 font-bold">Marketplace integrity</h3><p className="mt-2 text-sm leading-6 text-[#91A6B2]">Listings only change state after a verified marketplace outcome.</p></div><div className="rounded-xl border border-white/10 bg-[#102D39]/55 p-5"><BarChart3 className="h-6 w-6 text-[#19B5AC]" /><h3 className="font-heading mt-4 font-bold">Evidence-led valuation</h3><p className="mt-2 text-sm leading-6 text-[#91A6B2]">Separate comparable sales, asking prices and uncertainty before setting a price.</p></div><div className="rounded-xl border border-white/10 bg-[#102D39]/55 p-5"><Sparkles className="h-6 w-6 text-[#19B5AC]" /><h3 className="font-heading mt-4 font-bold">SWISH AI</h3><p className="mt-2 text-sm leading-6 text-[#91A6B2]">A shared intelligence engine that becomes more useful as specialist workflows improve.</p></div></div>
    </section>

    <section id="plans" className="border-y border-white/10 bg-[#102D39]/55"><div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#F4C65D]">Plans</p><h2 className="font-heading mt-3 text-3xl font-bold tracking-[-.03em] sm:text-4xl">Start with your resale business today. Scale when you need to.</h2><p className="mt-4 text-base leading-7 text-[#91A6B2]">Plan access and usage allowances are enforced by your account. Existing subscriptions are not changed by this presentation.</p></div><div className="mt-10 grid gap-3 md:grid-cols-4">
      {[['Discover', 'Try the guided workflow', 'Limited identification'], ['Specialist', '£9.99 / month', 'One specialist workspace'], ['Professional', '£19.99 / month', 'For regular resellers'], ['Business', '£39.99 / month', 'For higher-volume operations']].map(([name, price, detail], index) => <div key={name} className={`rounded-xl border p-5 ${index === 1 ? 'border-[#F4C65D] bg-[#071C26]' : 'border-white/10 bg-[#071C26]/60'}`}><p className="font-heading text-lg font-bold">{name}</p><p className="mt-5 text-xl font-bold text-[#F4C65D]">{price}</p><p className="mt-2 min-h-12 text-sm leading-6 text-[#91A6B2]">{detail}</p><a href="/coins" className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#F5F8FA] hover:text-[#F4C65D]">Get started <ArrowRight className="h-4 w-4" /></a></div>)}
    </div></div></section>

    <section id="faq" className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#19B5AC]">Frequently asked questions</p><h2 className="font-heading mt-3 text-3xl font-bold tracking-[-.03em] sm:text-4xl">Clear about what the platform does — and what it doesn’t.</h2></div><div className="mt-10 grid gap-3 lg:grid-cols-2">{faqs.map(([question, answer]) => <details key={question} className="group rounded-xl border border-white/10 bg-[#102D39]/55 p-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-heading font-bold"><span>{question}</span><CircleHelp className="h-5 w-5 shrink-0 text-[#19B5AC] transition group-open:rotate-180" /></summary><p className="mt-4 text-sm leading-7 text-[#91A6B2]">{answer}</p></details>)}</div></section>

    <section className="border-t border-white/10 bg-[linear-gradient(115deg,#071C26,#102D39)]"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 py-12 lg:flex-row lg:items-center lg:px-8"><div><SwishFlipMark descriptor /><p className="mt-4 text-base text-[#D9E5E9]">{SWISHFLIP.secondarySlogan}</p></div><a href="/coins" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#F4C65D] px-5 text-sm font-bold text-[#071C26] transition hover:brightness-105">Start with SWISHFlip <ArrowRight className="h-4 w-4" /></a></div></section>
    <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-xs text-[#91A6B2] sm:flex-row sm:items-center sm:justify-between lg:px-8"><span>© {new Date().getFullYear()} SWISHFlip</span><span>{SWISHFLIP.intelligence}</span></footer>
  </main>;
}
