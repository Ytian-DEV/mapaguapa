import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Archive,
  Badge as BadgeIcon,
  Download,
  Flag,
  HelpCircle,
  Home,
  Inbox,
  List,
  Map,
  MessageSquare,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import {
  AppShell,
  Avatar,
  Badge,
  BulkBar,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Chip,
  ChipGroup,
  ConfirmDialog,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  FilterSelect,
  Input,
  ListingCardSkeleton,
  Menu,
  NumberStepper,
  PageHeader,
  Pagination,
  ProgressBar,
  RadioCards,
  RoleBadge,
  Segmented,
  Select,
  ShowMore,
  Sidebar,
  Skeleton,
  StatCard,
  StatusBadge,
  Stepper,
  Tabs,
  Tag,
  Textarea,
  Toggle,
  TopNav,
  useToast,
  type Column,
  type ListingStatus,
} from "../ui";
import "./components-preview.css";

type DemoRow = { id: string; name: string; area: string; status: ListingStatus; photos: number };

const demoRows: DemoRow[] = [
  { id: "1", name: "Sample listing A", area: "Barangay", status: "published", photos: 3 },
  { id: "2", name: "Sample listing B", area: "Barangay", status: "in_review", photos: 6 },
  { id: "3", name: "Sample listing C", area: "Barangay", status: "changes_requested", photos: 5 },
  { id: "4", name: "Sample listing D", area: "Barangay", status: "draft", photos: 0 },
];

const demoColumns: Column<DemoRow>[] = [
  { key: "name", header: "Listing", primary: true, cell: (row) => <strong>{row.name}</strong> },
  { key: "area", header: "Area", cell: (row) => row.area },
  { key: "photos", header: "Photos", align: "right", cell: (row) => row.photos },
  { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="dev-preview__section">
      <p className="v2-eyebrow">{title}</p>
      <div className="dev-preview__row">{children}</div>
    </section>
  );
}

/** Dev-only gallery of the v2 component library (not bundled in production). */
export default function ComponentsPreview() {
  const toast = useToast();
  const [chip, setChip] = useState("all");
  const [tab, setTab] = useState("published");
  const [stay, setStay] = useState<"ladies" | "men" | "mixed">("mixed");
  const [rooms, setRooms] = useState(6);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set(["2"]));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const [area, setArea] = useState("");

  return (
    <div className="v2">
      <TopNav
        links={[
          { to: "/dev/components", label: "Browse", icon: <Home />, end: true },
          { to: "/map", label: "Map view", icon: <Map /> },
          { to: "/saved", label: "Saved" },
          { to: "/messages", label: "Messages", icon: <MessageSquare />, badge: 2 },
        ]}
        onSignOut={() => toast.show("Signed out (demo)")}
        savedCount={2}
        user={{ name: "Demo Student" }}
      />

      <div className="v2-container dev-preview">
        <PageHeader
          actions={<Button leadingIcon={<Plus />}>Primary action</Button>}
          eyebrow="Design system · v2"
          subtitle="Every shared component, rendered with tokens only."
          title={
            <>
              Components <span className="v2-accent">preview</span>
            </>
          }
        />

        <Section title="Typography">
          <div className="dev-preview__stack">
            <p className="v2-display">Display — Fraunces 64</p>
            <h2 className="v2-h2">Heading — Fraunces 32</h2>
            <p>Body — Geist 16. Clear, quiet, and readable on any phone.</p>
            <p className="v2-eyebrow">Eyebrow — Geist Mono 11 / +8%</p>
          </div>
        </Section>

        <Section title="Buttons">
          <Button>Primary</Button>
          <Button variant="dark" leadingIcon={<SlidersHorizontal />}>
            Filters
          </Button>
          <Button variant="secondary" leadingIcon={<Download />}>
            Export
          </Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Archive</Button>
          <Button variant="link">Link</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm" variant="secondary">
            Small
          </Button>
          <Button aria-label="Search" iconOnly variant="secondary">
            <Search />
          </Button>
        </Section>

        <Section title="Badges">
          <StatusBadge status="published" />
          <StatusBadge status="in_review" />
          <StatusBadge status="changes_requested" />
          <StatusBadge status="draft" />
          <RoleBadge role="owner" />
          <RoleBadge role="admin" />
          <RoleBadge role="student" />
          <Badge tone="amber" dot>
            Needs reply
          </Badge>
          <Badge tone="green" icon={<BadgeIcon />}>
            Verified owner
          </Badge>
        </Section>

        <Section title="Chips and tags">
          <ChipGroup label="Quick filters">
            {["all", "Under ₱1,000", "₱1,000–1,999", "Ladies only", "With Wi-Fi"].map((value) => (
              <Chip key={value} onClick={() => setChip(value)} selected={chip === value}>
                {value === "all" ? "All" : value}
              </Chip>
            ))}
          </ChipGroup>
          <Tag>Wi-Fi</Tag>
          <Tag>Study area</Tag>
          <Tag>Curfew</Tag>
        </Section>

        <Section title="Inputs">
          <div className="dev-preview__grid">
            <Input aria-label="Search" inputSize="lg" leadingIcon={<Search />} placeholder="Search a barangay, street, or place name" />
            <Field hint="Shown to students on the listing." label="Listing name">
              <Input placeholder="e.g. Sunrise Boarding House" />
            </Field>
            <Field error="Enter a monthly rent." label="Monthly rent per person">
              <Input inputMode="numeric" leadingIcon={<span>₱</span>} placeholder="2,800" trailing={<span>/ month</span>} />
            </Field>
            <Field label="Advance & deposit">
              <Select
                options={[
                  { value: "1-1", label: "1 month advance + 1 month deposit" },
                  { value: "1-0", label: "1 month advance only" },
                ]}
              />
            </Field>
            <Field label="About this place" optional>
              <Textarea placeholder="What makes it a good place to stay?" />
            </Field>
            <Field label="Total rooms">
              <NumberStepper label="total rooms" onChange={setRooms} value={rooms} />
            </Field>
          </div>
          <div className="dev-preview__row">
            <FilterSelect
              label="Area"
              onChange={(event) => setArea(event.target.value)}
              options={[
                { value: "a", label: "Area A" },
                { value: "b", label: "Area B" },
              ]}
              value={area}
            />
            <FilterSelect label="Status" layout="inline" anyLabel="All" options={[{ value: "x", label: "Option" }]} value="" onChange={() => undefined} />
            <Checkbox defaultChecked label="Wi-Fi available" />
            <Toggle defaultChecked label="Search as I move the map" />
            <Segmented
              items={[
                { value: "list", label: "List" },
                { value: "map", label: "Map" },
              ]}
              label="View"
              onChange={setView}
              value={view}
            />
          </div>
          <RadioCards
            label="Who can stay?"
            name="stay"
            onChange={setStay}
            options={[
              { value: "ladies", label: "Ladies only", description: "Female tenants only" },
              { value: "men", label: "Men only", description: "Male tenants only" },
              { value: "mixed", label: "Mixed", description: "Ladies and men" },
            ]}
            value={stay}
          />
        </Section>

        <Section title="Cards">
          <div className="dev-preview__cards">
            <StatCard icon={<List />} label="Published listings" meta="+3 this week" value="—" />
            <StatCard icon={<Flag />} label="In review" value="—" />
            <Card>
              <CardHeader action={<Button size="sm" variant="secondary">View all</Button>} description="Card header with action" title="Recent inquiries" />
              <ProgressBar label="Listing completeness" value={25} />
            </Card>
            <Card tone="sage">
              <p>Sage callout card.</p>
            </Card>
          </div>
        </Section>

        <Section title="Avatars and menu">
          <Avatar name="Demo Admin" />
          <Avatar name="Demo Owner" tone="clay" />
          <Avatar name="Demo Student" size="lg" tone="paper" />
          <Menu
            items={[
              { key: "view", label: "View", onSelect: () => toast.show("View") },
              { key: "role", label: "Change role", onSelect: () => setConfirmOpen(true) },
              { key: "deactivate", label: "Deactivate", destructive: true, onSelect: () => setConfirmOpen(true) },
            ]}
            label="Row actions"
          />
        </Section>

        <Section title="Tabs and stepper">
          <div className="dev-preview__stack dev-preview__full">
            <Tabs
              items={[
                { value: "published", label: "Published", count: 90 },
                { value: "in_review", label: "In review", count: 1 },
                { value: "changes", label: "Changes requested", count: 1 },
                { value: "drafts", label: "Drafts" },
                { value: "archived", label: "Archived", count: 7 },
              ]}
              label="Listing status"
              onChange={setTab}
              value={tab}
            />
            <div className="dev-preview__stepper">
              <Stepper
                onSelect={(key) => toast.show(`Go to ${key}`)}
                steps={[
                  { key: "basics", label: "Basics", state: "done" },
                  { key: "rooms", label: "Rooms & pricing", state: "current" },
                  { key: "bills", label: "Bills & utilities", state: "todo" },
                  { key: "comfort", label: "Comfort & amenities", state: "todo" },
                ]}
              />
            </div>
          </div>
        </Section>

        <Section title="Data table">
          <div className="dev-preview__stack dev-preview__full">
            <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
              <Button leadingIcon={<Archive />}>Archive</Button>
              <Button leadingIcon={<Download />}>Export</Button>
            </BulkBar>
            <DataTable
              caption="Demo listings"
              columns={demoColumns}
              getRowId={(row) => row.id}
              onSelectionChange={setSelected}
              rowActions={() => <Menu items={[{ key: "edit", label: "Edit", onSelect: () => undefined }]} label="Row actions" />}
              rows={demoRows}
              selectable
              selectedIds={selected}
            />
            <Pagination itemLabel="listings" onPageChange={setPage} page={page} pageSize={8} total={90} />
            <ShowMore onMore={() => toast.success("Loaded more")} shown={4} total={90} />
          </div>
        </Section>

        <Section title="Empty, error and loading">
          <div className="dev-preview__cards">
            <Card padding="none">
              <EmptyState
                action={<Button variant="secondary">Clear filters</Button>}
                description="Try a different budget or area."
                icon={<Inbox />}
                title="No places match"
              />
            </Card>
            <Card padding="none">
              <EmptyState compact description="Check your connection and try again." icon={<AlertTriangle />} title="Couldn’t load listings" tone="error" />
            </Card>
            <ListingCardSkeleton />
            <div className="dev-preview__stack">
              <Skeleton height={20} width="60%" />
              <Skeleton height={14} />
              <Skeleton height={14} width="80%" />
            </div>
          </div>
        </Section>

        <Section title="Overlays and toasts">
          <Button onClick={() => setDialogOpen(true)} variant="secondary">
            Open dialog
          </Button>
          <Button onClick={() => setConfirmOpen(true)} variant="secondary">
            Open confirm
          </Button>
          <Button onClick={() => toast.success("Listing saved as draft")} variant="secondary">
            Success toast
          </Button>
          <Button onClick={() => toast.error("Something went wrong")} variant="secondary">
            Error toast
          </Button>
        </Section>

        <Section title="Owner sidebar (inside AppShell)">
          <div className="dev-preview__shell">
            <AppShell
              sidebar={
                <Sidebar
                  groups={[
                    {
                      label: "Manage",
                      items: [
                        { to: "/dev/components", label: "Overview", icon: <Home />, end: true },
                        { to: "/owner/listings", label: "My listings", icon: <List />, count: 2 },
                        { to: "/owner/inquiries", label: "Inquiries", icon: <MessageSquare />, count: 3, emphasis: true },
                        { to: "/owner/listings/new", label: "Create listing", icon: <Plus /> },
                      ],
                    },
                    {
                      label: "Account",
                      items: [
                        { to: "/owner/verification", label: "Verification", icon: <BadgeIcon /> },
                        { to: "/owner/profile", label: "Profile", icon: <Users /> },
                        { to: "/help", label: "Help", icon: <HelpCircle /> },
                      ],
                    },
                  ]}
                  homeTo="/dev/components"
                  onSignOut={() => toast.show("Signed out (demo)")}
                  user={{ name: "Demo Owner", subtitle: "Owner · Verified", tone: "clay" }}
                  workspace="Owner portal"
                />
              }
            >
              <PageHeader eyebrow="Owner portal" subtitle="Main content area." title="Overview" />
            </AppShell>
          </div>
        </Section>
      </div>

      <Dialog
        description="Dialogs use native <dialog> so focus stays inside."
        footer={<Button onClick={() => setDialogOpen(false)}>Done</Button>}
        onClose={() => setDialogOpen(false)}
        open={dialogOpen}
        title="Show all photos"
      >
        <p>Dialog body content.</p>
      </Dialog>
      <ConfirmDialog
        confirmLabel="Deactivate"
        description="They won’t be able to sign in until reactivated."
        destructive
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          toast.success("Done");
        }}
        open={confirmOpen}
        title="Deactivate this user?"
      />
    </div>
  );
}
