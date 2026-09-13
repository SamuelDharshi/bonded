import Link from 'next/link';

/**
 * The continuation at the bottom of an evidence page.
 *
 * /live, /corpus and /architecture previously contained no links at all — a
 * reader who arrived, understood the point, and wanted to act had nowhere to go
 * but the back button. Each page now ends by naming the one thing to do next,
 * in terms of what that page just showed, rather than with a generic banner.
 *
 * Two links, never more: the action, and the way back to the rest of the
 * evidence. A footer full of options at the end of a page is the same dead end
 * with more words.
 */
export function NextStep({
  lead,
  action = { label: 'Open your account', href: '/app' },
  secondary,
}: {
  /** What this page established, and why the action follows from it. */
  lead: string;
  action?: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <aside className="mt-14 border-t border-hairline pt-6">
      <p className="text-body text-manifest/70 max-w-2xl">{lead}</p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Link
          href={action.href}
          className="font-mono text-small font-bold text-harbor bg-[#1E7BB8] tracking-wide px-4 py-2.5 rounded-control hover:bg-[#17618F] transition-colors"
        >
          {action.label}
        </Link>
        {secondary && (
          <Link
            href={secondary.href}
            className="font-mono text-small text-manifest/60 underline underline-offset-4 decoration-hairline hover:decoration-manifest hover:text-manifest transition-colors"
          >
            {secondary.label}
          </Link>
        )}
      </div>
    </aside>
  );
}

export default NextStep;
