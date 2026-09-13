import { Wizard } from '../../../components/console/owner/Wizard';

export const dynamic = 'force-dynamic';

/**
 * /app/start — onboarding, one step at a time.
 *
 * Separate from the dashboard because setting an account up and running one are
 * different jobs. The dashboard answers "what is the state of things"; this
 * answers "what do I do next", and it is the only screen that should ever show
 * exactly one demand.
 */
export default function StartPage() {
  return (
    <>
      <div>
        <h1 className="text-h1 text-manifest">Set up your account</h1>
        <p className="text-body text-manifest/60 mt-2 max-w-2xl">
          Four steps, in this order because the order matters. You are never asked for a private
          key — yours or your agent&apos;s.
        </p>
      </div>
      <Wizard />
    </>
  );
}
