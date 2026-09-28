import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { ensureBendahara } from "@/lib/auth.functions";
import {
  Card,
  PageHeader,
  PageNav,
  Section,
  pageShell,
} from "@/components/ui";

const navClass =
  "rounded-full px-3 py-2 text-button-sm font-medium text-ink transition-colors hover:bg-surface-soft hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-primary/30";

export const Route = createFileRoute("/bendahara")({
  beforeLoad: async () => {
    try {
      await ensureBendahara();
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: Bendahara,
});

function Bendahara() {
  return (
    <main id="main-content" className={pageShell}>
      <PageNav
        links={
          <>
            <Link to="/" className={navClass}>
              Dashboard
            </Link>
            <Link to="/kas" className={navClass}>
              Kas
            </Link>
            <Link to="/log" className={navClass}>
              Log
            </Link>
          </>
        }
      />

      <PageHeader
        title="Bendahara panel"
        subtitle={
          <>
            Only users with role <code className="rounded bg-surface-soft px-1.5 py-0.5 text-caption-sm text-body">bendahara</code> can see this page.
          </>
        }
      />

      <Section title="Treasurer actions">
        <Card>
          <ul className="m-0 flex list-disc flex-col gap-2 space-y-1 pl-5 text-body-sm text-body">
            <li>Review and approve transactions</li>
            <li>Manage budgets and reports</li>
            <li>Manage pre-registered users and roles</li>
          </ul>
        </Card>
      </Section>
    </main>
  );
}
