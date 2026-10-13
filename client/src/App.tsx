import {
  createContext,
  FormEvent,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Command,
  Copy,
  FileCheck2,
  FileUp,
  Globe2,
  Layers3,
  LockKeyhole,
  Menu,
  Monitor,
  Moon,
  PackageCheck,
  Pin,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Type,
  X,
} from "lucide-react";
import {
  api,
  API,
  AppProduct,
  Download,
  formatBytes,
  Release,
  titleCase,
} from "./api";

type ApiResult<T> = {
  success: boolean;
  data: T;
  pagination?: { page: number; totalPages: number; total: number };
};
const queryKey = ["apps"];
type Theme = "light" | "dark";
type FontChoice = "manrope" | "dm-sans" | "system";
const AppearanceContext = createContext<{
  theme: Theme;
  font: FontChoice;
  toggleTheme: () => void;
  setFont: (font: FontChoice) => void;
} | null>(null);

function useAppearance() {
  const appearance = useContext(AppearanceContext);
  if (!appearance)
    throw new Error(
      "Appearance controls must be inside the appearance provider.",
    );
  return appearance;
}

function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem("store-theme") === "dark" ? "dark" : "light",
  );
  const [font, setFont] = useState<FontChoice>(() => {
    const stored = localStorage.getItem("store-font");
    return stored === "dm-sans" || stored === "system" ? stored : "manrope";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.font = font;
    localStorage.setItem("store-theme", theme);
    localStorage.setItem("store-font", font);
  }, [theme, font]);
  return (
    <AppearanceContext.Provider
      value={{
        theme,
        font,
        toggleTheme: () =>
          setTheme((value) => (value === "light" ? "dark" : "light")),
        setFont,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  );
}

function AppearanceControls() {
  const { theme, toggleTheme, setFont, font } = useAppearance();
  return (
    <div className="appearance-controls">
      <button
        type="button"
        className="appearance-theme"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      >
        {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
      </button>
      <label className="font-choice">
        <Type size={14} />
        <select
          aria-label="Site font"
          value={font}
          onChange={(event) => setFont(event.target.value as FontChoice)}
        >
          <option value="manrope">Manrope</option>
          <option value="dm-sans">DM Sans</option>
          <option value="system">System</option>
        </select>
      </label>
    </div>
  );
}

function PageMeta({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <link rel="canonical" href={window.location.href.split("?")[0]} />
    </Helmet>
  );
}

function StoreMeta() {
  const settings = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => (await api<ApiResult<any>>("/settings/public")).data,
  });
  return (
    <Helmet>
      {settings.data?.favicon?.url && (
        <link rel="icon" href={settings.data.favicon.url} />
      )}
    </Helmet>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const settings = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => (await api<ApiResult<any>>("/settings/public")).data,
  });
  return (
    <header className="topbar">
      <div className="container nav-wrap">
        <Link to="/" className="brand">
          <span className="brand-mark">
            {settings.data?.logo?.url ? (
              <img src={settings.data.logo.url} alt="" />
            ) : (
              <Command size={19} />
            )}
          </span>
          <span>{settings.data?.storeName || "ZEROTRICX STORE"}</span>
        </Link>
        <nav className={open ? "nav-links open" : "nav-links"}>
          <NavLink to="/software">Explore software</NavLink>
          <NavLink to="/about">About</NavLink>
          <NavLink to="/support">Support</NavLink>
        </nav>
        <div className="header-tools">
          <AppearanceControls />
          <button
            className="menu-toggle"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const settings = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => (await api<ApiResult<any>>("/settings/public")).data,
  });
  return (
    <footer className="footer">
      <div className="container footer-main">
        <div>
          <Link to="/" className="brand">
            <span className="brand-mark">
              {settings.data?.logo?.url ? (
                <img src={settings.data.logo.url} alt="" />
              ) : (
                <Command size={19} />
              )}
            </span>
            <span>{settings.data?.storeName || "ZEROTRICX STORE"}</span>
          </Link>
          <p>
            {settings.data?.storeDescription ||
              "Useful tools, thoughtfully made."}
          </p>
        </div>
        <div className="footer-links">
          <Link to="/about">About</Link>
          <Link to="/support">Support</Link>
          <Link to="/guides">Installation guides</Link>
          <Link to="/release-notes">Release notes</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          {Object.entries(settings.data?.socialLinks || {})
            .filter(([, url]) => !!url)
            .map(([name, url]) => (
              <a
                key={name}
                href={url as string}
                target="_blank"
                rel="noreferrer"
              >
                {titleCase(name)} <ArrowUpRight size={12} />
              </a>
            ))}
        </div>
      </div>
      <div className="container footer-bottom">
        <span>
          {settings.data?.footerText ||
            `© ${new Date().getFullYear()} ${settings.data?.storeName || "ZEROTRICX STORE"}`}
        </span>
        <span>Built for the things you make.</span>
      </div>
    </footer>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}

function RequestState({
  error,
  loading,
  empty,
  children,
}: {
  error?: Error | null;
  loading?: boolean;
  empty?: boolean;
  children?: React.ReactNode;
}) {
  if (loading)
    return (
      <div className="state-card">
        <span className="spinner" /> Loading software…
      </div>
    );
  if (error)
    return (
      <div className="state-card error-state">
        <strong>We couldn’t load this content.</strong>
        <span>{error.message}</span>
        <button
          className="button button-outline"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </div>
    );
  if (empty)
    return (
      <div className="state-card">
        <PackageCheck size={24} />
        <strong>Nothing published here yet.</strong>
        <span>Check back soon for new releases.</span>
      </div>
    );
  return <>{children}</>;
}

function ProductCard({ product }: { product: AppProduct }) {
  const rating = product.reviewCount ? (product.ratingAverage ?? 4) : 4;
  const roundedRating = Math.round(rating);
  return (
    <article className="product-card">
      <Link
        to={`/software/${product.slug}`}
        className="card-link"
        aria-label={`View ${product.name}`}
      />
      <div className="product-top">
        <div className="app-icon">
          {product.icon?.url ? (
            <img src={product.icon.url} alt="" loading="lazy" />
          ) : (
            <Command size={23} />
          )}
        </div>
        <span className="tag">{product.category}</span>
      </div>
      <h3>{product.name}</h3>
      <p>{product.shortDescription}</p>
      <div
        className="product-rating"
        aria-label={`${rating.toFixed(1)} out of 5 stars${product.reviewCount ? `, ${product.reviewCount} reviews` : ", no reviews yet"}`}
      >
        <span aria-hidden="true">
          {"★".repeat(roundedRating)}
          {"☆".repeat(5 - roundedRating)}
        </span>
        <b>{rating.toFixed(1)}</b>
        {product.reviewCount ? (
          <small>({product.reviewCount})</small>
        ) : (
          <small>No reviews</small>
        )}
      </div>
      <div className="product-meta">
        <span>
          {product.currentVersion
            ? `v${product.currentVersion}`
            : "Available now"}
        </span>
        <span>
          <ArrowRight size={15} />
        </span>
      </div>
    </article>
  );
}

function AppGrid({
  apps,
  loading,
  error,
  emptyText,
}: {
  apps?: AppProduct[];
  loading: boolean;
  error?: Error | null;
  emptyText?: boolean;
}) {
  return (
    <RequestState
      loading={loading}
      error={error}
      empty={!loading && !error && (!apps || apps.length === 0)}
    >
      <div className="product-grid">
        {apps?.map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>
    </RequestState>
  );
}

function FeaturedSlider({ apps }: { apps: AppProduct[] }) {
  const [index, setIndex] = useState(0);
  if (!apps.length) return null;
  const active = apps[index % apps.length];
  return (
    <section className="featured-slider" aria-label="Featured applications">
      {active.icon?.url && (
        <img className="featured-slider-art" src={active.icon.url} alt="" />
      )}
      <div className="featured-slider-copy">
        <div className="eyebrow">
          PINNED APPLICATION · {index + 1} OF {apps.length}
        </div>
        <h2>{active.name}</h2>
        <p>{active.shortDescription}</p>
        <Link className="button button-dark" to={`/software/${active.slug}`}>
          Explore application <ArrowRight size={16} />
        </Link>
      </div>
      <div className="featured-slider-controls">
        <button
          type="button"
          aria-label="Previous featured application"
          onClick={() =>
            setIndex((value) => (value - 1 + apps.length) % apps.length)
          }
        >
          <ChevronLeft size={18} />
        </button>
        <div>
          {apps.map((app, dot) => (
            <button
              type="button"
              key={app._id}
              className={dot === index ? "active" : ""}
              aria-label={`Show ${app.name}`}
              aria-pressed={dot === index}
              onClick={() => setIndex(dot)}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="Next featured application"
          onClick={() => setIndex((value) => (value + 1) % apps.length)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}

function parsePlatforms(
  value: string,
): { os: string; architectures: string[] }[] {
  return value
    .split(";")
    .map((entry) => {
      const [platform, minRequirements] = entry.split("|");
      const [os, architectures = "x64"] = platform.split(":");
      return {
        os: os.trim(),
        architectures: architectures
          .split(",")
          .map((architecture) => architecture.trim())
          .filter(Boolean),
        minRequirements: minRequirements?.trim(),
      };
    })
    .filter((entry) => entry.os);
}

function parseInstructions(value: string): Record<string, string> {
  return Object.fromEntries(
    value
      .split("\n")
      .map((line) => {
        const separator = line.indexOf(":");
        return separator < 0
          ? ["", ""]
          : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      })
      .filter(([platform, text]) => !!platform && !!text),
  );
}

async function uploadApplicationImage(
  appId: string,
  kind: "icon" | "screenshot",
  file: File,
  caption = "",
): Promise<ApiResult<any>> {
  const body = new FormData();
  body.append("image", file);
  body.append("caption", caption);
  return api<ApiResult<any>>(`/admin/applications/${appId}/images/${kind}`, {
    method: "POST",
    body,
  });
}

function HomePage() {
  const navigate = useNavigate();
  const [heroSearch, setHeroSearch] = useState("");
  const featured = useQuery({
    queryKey: ["apps", "featured"],
    queryFn: async () =>
      (
        await api<ApiResult<AppProduct[]>>(
          "/apps?isFeatured=true&sort=updated&limit=3",
        )
      ).data,
  });
  const latest = useQuery({
    queryKey: ["apps", "latest"],
    queryFn: async () =>
      (await api<ApiResult<AppProduct[]>>("/apps?sort=updated&limit=3")).data,
  });
  const collection = featured.data?.length ? featured.data : latest.data;
  const collectionLoading =
    featured.isLoading || (!featured.data?.length && latest.isLoading);
  const collectionError =
    featured.error && !latest.data
      ? featured.error
      : latest.error && !featured.data?.length
        ? latest.error
        : null;
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api<ApiResult<string[]>>("/categories")).data,
  });
  return (
    <Shell>
      <PageMeta
        title="ZEROTRICX STORE — useful tools, beautifully made"
        description="Discover carefully crafted desktop applications. Download official software for Windows, macOS, and Linux."
      />
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="pulse-dot" /> SOFTWARE THAT GETS OUT OF YOUR WAY
            </div>
            <h1>
              Tools for your
              <br />
              <em>next great idea.</em>
            </h1>
            <p>
              Thoughtfully built desktop software that makes complex work feel
              simple. Find your next favorite tool.
            </p>
            <div className="hero-actions">
              <Link className="button button-dark" to="/software">
                Explore the collection <ArrowRight size={17} />
              </Link>
              <Link className="text-link" to="/about">
                Our approach <ArrowUpRight size={15} />
              </Link>
            </div>
            <form
              className="hero-search"
              onSubmit={(event) => {
                event.preventDefault();
                navigate(`/software?search=${encodeURIComponent(heroSearch)}`);
              }}
            >
              <Search size={17} />
              <input
                value={heroSearch}
                onChange={(event) => setHeroSearch(event.target.value)}
                placeholder="What are you looking for?"
                aria-label="Search software"
              />
              <button aria-label="Search">
                <ArrowRight size={16} />
              </button>
            </form>
            <div className="hero-note">
              <ShieldCheck size={16} /> Official releases. Clear checksums. No
              account required.
            </div>
          </div>
          <div className="hero-art">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="float-card card-upper">
              <span className="float-icon purple">
                <Layers3 size={18} />
              </span>
              <span>
                <b>Made with care</b>
                <small>Every detail considered</small>
              </span>
              <Check size={16} className="float-check" />
            </div>
            <div className="hero-emblem">
              <div className="emblem-inner">
                <Command size={57} strokeWidth={1.5} />
              </div>
              <div className="sparkle sparkle-a">
                <Sparkles size={18} />
              </div>
              <div className="sparkle sparkle-b">
                <span />
              </div>
            </div>
            <div className="float-card card-lower">
              <span className="float-icon green">
                <FileCheck2 size={18} />
              </span>
              <span>
                <b>Trusted downloads</b>
                <small>Integrity checked</small>
              </span>
              <ShieldCheck size={16} className="float-check" />
            </div>
            <div className="hero-caption">SMALL TOOLS. BIG MOMENTUM.</div>
          </div>
        </div>
      </section>
      <section className="section section-tinted">
        <div className="container">
          <div className="section-heading">
            <div>
              <div className="eyebrow">THE COLLECTION</div>
              <h2>Find your flow.</h2>
              <p>Focused software for the work that matters.</p>
            </div>
            <Link className="text-link" to="/software">
              Browse everything <ArrowRight size={16} />
            </Link>
          </div>
          <AppGrid
            apps={collection}
            loading={collectionLoading}
            error={collectionError as Error | null}
          />
        </div>
      </section>
      <section className="section">
        <div className="container">
          <div className="section-heading">
            <div>
              <div className="eyebrow">FRESH OFF THE DESK</div>
              <h2>Latest releases.</h2>
              <p>New ideas, ready when you are.</p>
            </div>
            <Link className="text-link" to="/software?sort=updated">
              See all releases <ArrowRight size={16} />
            </Link>
          </div>
          <AppGrid
            apps={latest.data}
            loading={latest.isLoading}
            error={latest.error as Error | null}
          />
        </div>
      </section>
      {!!categories.data?.length && (
        <section className="category-section">
          <div className="container category-row">
            <div>
              <div className="eyebrow">BROWSE BY CATEGORY</div>
              <h2>Pick a starting point.</h2>
            </div>
            <div className="category-pills">
              {categories.data.map((item) => (
                <Link
                  key={item}
                  to={`/software?category=${encodeURIComponent(item)}`}
                >
                  {item}
                  <ArrowUpRight size={14} />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
      <section className="platform-section">
        <div className="container platform-content">
          <span className="platform-orb">
            <Globe2 size={24} />
          </span>
          <div>
            <div className="eyebrow">YOUR OS, YOUR WAY</div>
            <h2>Made for your setup.</h2>
            <p>
              Installer choices are listed clearly for each product—so you only
              see what’s actually available.
            </p>
          </div>
          <div className="platforms">
            <span>
              <Monitor /> Windows
            </span>
            <span>
              <Command /> macOS
            </span>
            <span>
              <Layers3 /> Linux
            </span>
          </div>
        </div>
      </section>
      <section className="about-strip">
        <div className="container about-strip-inner">
          <div>
            <div className="eyebrow">INDEPENDENT BY DESIGN</div>
            <h2>
              Good software should feel <em>human.</em>
            </h2>
            <p>
              One small studio, a lot of care, and useful tools made for people
              who like making things.
            </p>
          </div>
          <Link className="button button-light" to="/about">
            Get to know us <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </Shell>
  );
}

function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get("search") || "";
  const category = params.get("category") || "";
  const os = params.get("os") || "";
  const sort = params.get("sort") || "updated";
  const page = Number(params.get("page") || 1);
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api<ApiResult<string[]>>("/categories")).data,
  });
  const featured = useQuery({
    queryKey: ["apps", "catalog-pinned"],
    queryFn: async () =>
      (
        await api<ApiResult<AppProduct[]>>(
          "/apps?isPinned=true&sort=updated&limit=5",
        )
      ).data,
  });
  const listingParams = new URLSearchParams({
    sort,
    page: String(page),
    limit: "12",
  });
  if (search.trim()) listingParams.set("search", search.trim());
  if (category) listingParams.set("category", category);
  if (os) listingParams.set("os", os);
  const listing = useQuery({
    queryKey: ["catalog", search, category, os, sort, page],
    queryFn: async () =>
      api<ApiResult<AppProduct[]>>(`/apps?${listingParams.toString()}`),
  });
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    next.delete("page");
    setParams(next);
  }
  return (
    <Shell>
      <PageMeta
        title="Explore software — ZEROTRICX STORE"
        description="Browse the complete collection of desktop software for Windows, macOS, and Linux."
      />
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow">SOFTWARE LIBRARY</div>
          <h1>
            Find the right
            <br />
            <em>tool for the job.</em>
          </h1>
          <p>
            Clear choices, straightforward downloads, and no account required.
          </p>
        </div>
      </section>
      <section className="catalog-section">
        <div className="container">
          {!!featured.data?.length && <FeaturedSlider apps={featured.data} />}
          <div className="catalog-tools">
            <label className="search-field">
              <Search size={18} />
              <input
                value={search}
                onChange={(event) => update("search", event.target.value)}
                placeholder="Search software…"
                aria-label="Search software"
              />
            </label>
            <select
              value={category}
              onChange={(event) => update("category", event.target.value)}
              aria-label="Filter category"
            >
              <option value="">All categories</option>
              {categories.data?.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select
              value={os}
              onChange={(event) => update("os", event.target.value)}
              aria-label="Filter operating system"
            >
              <option value="">All platforms</option>
              <option value="windows">Windows</option>
              <option value="macos">macOS</option>
              <option value="linux">Linux</option>
            </select>
            <select
              value={sort}
              onChange={(event) => update("sort", event.target.value)}
              aria-label="Sort software"
            >
              <option value="updated">Recently updated</option>
              <option value="name">Name</option>
              <option value="newest">Recently added</option>
              <option value="downloads">Popular</option>
            </select>
          </div>
          <AppGrid
            apps={listing.data?.data}
            loading={listing.isLoading}
            error={listing.error as Error | null}
            emptyText
          />
          {!!listing.data?.pagination &&
            listing.data.pagination.totalPages > 1 && (
              <div className="pagination">
                <button
                  className="button button-outline"
                  disabled={page <= 1}
                  onClick={() => update("page", String(page - 1))}
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <span>
                  Page {page} of {listing.data.pagination.totalPages}
                </span>
                <button
                  className="button button-outline"
                  disabled={page >= listing.data.pagination.totalPages}
                  onClick={() => update("page", String(page + 1))}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}
        </div>
      </section>
    </Shell>
  );
}

function DownloadButton({ item }: { item: Download }) {
  return (
    <a
      className="button button-dark download-button"
      href={`${API}/api/downloads/${item._id}/redirect`}
    >
      <ArrowDownToLine size={16} /> Download {item.format.toUpperCase()}{" "}
      <span>{formatBytes(item.fileSize)}</span>
    </a>
  );
}

function CopyChecksum({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  return (
    <button className="copy-checksum" onClick={copy} title="Copy SHA-256">
      <code>{value}</code>
      {copied ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
}

function SoftwarePage() {
  const { slug = "" } = useParams();
  const query = useQuery({
    queryKey: ["app", slug],
    queryFn: async () =>
      (await api<ApiResult<AppProduct>>(`/apps/${encodeURIComponent(slug)}`))
        .data,
  });
  const app = query.data;
  const reviews = useQuery({
    queryKey: ["reviews", slug],
    enabled: !!app,
    queryFn: async () =>
      (
        await api<
          ApiResult<{
            reviews: {
              _id: string;
              reviewerName: string;
              rating: number;
              text: string;
              createdAt: string;
            }[];
            average: number | null;
            count: number;
          }>
        >(`/apps/${encodeURIComponent(slug)}/reviews`)
      ).data,
  });
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState("");
  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReviewError("");
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    try {
      await api(`/apps/${encodeURIComponent(slug)}/reviews`, {
        method: "POST",
        body: JSON.stringify({
          reviewerName: form.get("reviewerName"),
          rating: Number(form.get("rating")),
          text: form.get("text"),
        }),
      });
      formElement.reset();
      setReviewMessage("Thank you. Your review will appear after moderation.");
    } catch (error) {
      setReviewError(
        (error as Error).message ||
          "Your review could not be submitted. Please try again.",
      );
    }
  }
  return (
    <Shell>
      <PageMeta
        title={
          app
            ? `${app.name} — ZEROTRICX STORE`
            : "Software details — ZEROTRICX STORE"
        }
        description={
          app?.seoDescription ||
          app?.shortDescription ||
          "Explore official software releases and downloads."
        }
      />
      <section className="detail-hero">
        <div className="container detail-container">
          <Link className="back-link" to="/software">
            <ChevronLeft size={15} /> Software library
          </Link>
          <RequestState
            loading={query.isLoading}
            error={query.error as Error | null}
            empty={!query.isLoading && !query.error && !app}
          >
            {app && (
              <>
                <div className="detail-heading">
                  <div className="app-icon app-icon-large">
                    {app.icon?.url ? (
                      <img src={app.icon.url} alt={`${app.name} icon`} />
                    ) : (
                      <Command size={30} />
                    )}
                  </div>
                  <div>
                    <div className="eyebrow">
                      {app.category} <span className="eyebrow-dot">·</span>{" "}
                      OFFICIAL RELEASE
                    </div>
                    <h1>{app.name}</h1>
                    <p>{app.shortDescription}</p>
                    <div
                      className="product-rating"
                      aria-label={`${(reviews.data?.average ?? 4).toFixed(1)} out of 5 stars${reviews.data?.count ? `, ${reviews.data.count} reviews` : ", no reviews yet"}`}
                    >
                      <span aria-hidden="true">
                        {"★".repeat(Math.round(reviews.data?.average ?? 4))}
                        {"☆".repeat(5 - Math.round(reviews.data?.average ?? 4))}
                      </span>
                      <b>{(reviews.data?.average ?? 4).toFixed(1)}</b>
                      <small>
                        {reviews.data?.count
                          ? `(${reviews.data.count} reviews)`
                          : "No reviews"}
                      </small>
                    </div>
                  </div>
                </div>
                <div className="detail-summary">
                  <p>{app.description}</p>
                  <div className="quick-facts">
                    <div>
                      <span>Latest version</span>
                      <b>
                        {app.currentVersion ? `v${app.currentVersion}` : "—"}
                      </b>
                    </div>
                    <div>
                      <span>License</span>
                      <b>{app.license || "See terms"}</b>
                    </div>
                    <div>
                      <span>Downloads</span>
                      <b>{app.totalDownloads || 0}</b>
                    </div>
                  </div>
                </div>
                {!!app.features?.length && (
                  <div className="detail-section">
                    <h2>Made to help you</h2>
                    <div className="feature-grid">
                      {app.features.map((feature) => (
                        <div key={feature}>
                          <Check size={17} />
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!!app.screenshots?.length && (
                  <div className="detail-section">
                    <h2>A closer look</h2>
                    <div className="screenshots">
                      {[...app.screenshots]
                        .sort((a, b) => (a.order || 0) - (b.order || 0))
                        .map((image) => (
                          <figure key={image.key}>
                            <img
                              src={image.url}
                              alt={image.caption || `${app.name} screenshot`}
                              loading="lazy"
                            />
                            {image.caption && (
                              <figcaption>{image.caption}</figcaption>
                            )}
                          </figure>
                        ))}
                    </div>
                  </div>
                )}
                <div className="detail-section downloads-section">
                  <div>
                    <div className="eyebrow">OFFICIAL INSTALLERS</div>
                    <h2>Choose your download.</h2>
                  </div>
                  {app.releases?.length ? (
                    app.releases.map((release) => (
                      <ReleaseDownloads key={release._id} release={release} />
                    ))
                  ) : (
                    <div className="state-card">
                      No published downloads are available yet.
                    </div>
                  )}
                </div>
                {!!app.supportedPlatforms?.length && (
                  <div className="detail-section">
                    <h2>System requirements</h2>
                    <div className="requirements">
                      {app.supportedPlatforms.map((platform) => (
                        <div key={platform.os}>
                          <b>{titleCase(platform.os)}</b>
                          <span>
                            {platform.architectures.map(titleCase).join(", ")}
                            {platform.minRequirements
                              ? ` · ${platform.minRequirements}`
                              : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {app.installationInstructions && (
                  <div className="detail-section">
                    <h2>Installation</h2>
                    {Object.entries(app.installationInstructions)
                      .filter(([, text]) => !!text)
                      .map(([platform, text]) => (
                        <details className="guide-row" key={platform}>
                          <summary>{titleCase(platform)} instructions</summary>
                          <p>{text}</p>
                        </details>
                      ))}
                  </div>
                )}
                <section className="detail-section reviews-section">
                  <div className="reviews-heading">
                    <div>
                      <div className="eyebrow">COMMUNITY FEEDBACK</div>
                      <h2>Reviews</h2>
                    </div>
                    <span>
                      {reviews.data?.average
                        ? `${reviews.data.average.toFixed(1)} / 5 · `
                        : ""}
                      {reviews.data?.count ?? 0} approved
                    </span>
                  </div>
                  {reviews.isError && (
                    <div className="inline-error" role="alert">
                      {(reviews.error as Error).message}
                    </div>
                  )}
                  {reviews.data?.reviews.length ? (
                    <div className="review-list">
                      {reviews.data.reviews.map((review) => (
                        <article className="review-card" key={review._id}>
                          <div>
                            <b>{review.reviewerName}</b>
                            <span
                              aria-label={`${review.rating} out of 5 stars`}
                            >
                              {"★".repeat(review.rating)}
                              {"☆".repeat(5 - review.rating)}
                            </span>
                          </div>
                          <p>{review.text}</p>
                          <small>
                            {new Date(review.createdAt).toLocaleDateString()}
                          </small>
                        </article>
                      ))}
                    </div>
                  ) : (
                    !reviews.isLoading && (
                      <p className="muted">
                        No reviews yet. Share your experience with this
                        application.
                      </p>
                    )
                  )}
                  <form
                    className="review-form stack-form"
                    onSubmit={(event) => void submitReview(event)}
                  >
                    <h3>Write a review</h3>
                    <label>
                      Your name
                      <input
                        name="reviewerName"
                        required
                        minLength={2}
                        maxLength={80}
                      />
                    </label>
                    <label>
                      Rating
                      <select name="rating" defaultValue="5">
                        <option value="5">5 — Excellent</option>
                        <option value="4">4 — Good</option>
                        <option value="3">3 — Average</option>
                        <option value="2">2 — Below average</option>
                        <option value="1">1 — Poor</option>
                      </select>
                    </label>
                    <label>
                      Your review
                      <textarea
                        name="text"
                        required
                        minLength={10}
                        maxLength={2000}
                        rows={4}
                      />
                    </label>
                    {reviewError && (
                      <div className="inline-error" role="alert">
                        {reviewError}
                      </div>
                    )}
                    {reviewMessage && (
                      <div className="admin-message" role="status">
                        {reviewMessage}
                      </div>
                    )}
                    <button className="button button-dark">
                      Submit review
                    </button>
                    <small className="muted">
                      Reviews are moderated before appearing publicly. Please
                      don’t include private information.
                    </small>
                  </form>
                </section>
                <div className="detail-footlinks">
                  {app.supportUrl && (
                    <a href={app.supportUrl} target="_blank" rel="noreferrer">
                      Support <ArrowUpRight size={14} />
                    </a>
                  )}
                  {app.privacyPolicyUrl && (
                    <a
                      href={app.privacyPolicyUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Privacy <ArrowUpRight size={14} />
                    </a>
                  )}
                  <Link to="/terms">
                    Terms of use <ArrowUpRight size={14} />
                  </Link>
                </div>
              </>
            )}
          </RequestState>
        </div>
      </section>
    </Shell>
  );
}

function ReleaseDownloads({ release }: { release: Release }) {
  return (
    <div className="release-block">
      <div className="release-title">
        <div>
          <h3>Version {release.version}</h3>
          <span>
            {new Date(release.releaseDate).toLocaleDateString()} ·{" "}
            {release.releaseType}
          </span>
        </div>
        <span className="tag">{release.status}</span>
      </div>
      {release.changelog && (
        <details className="changelog">
          <summary>What’s new</summary>
          <p>{release.changelog}</p>
        </details>
      )}
      {release.downloads?.length ? (
        <div className="download-options">
          {release.downloads.map((item) => (
            <div className="download-option" key={item._id}>
              <div className="download-option-title">
                <span className="os-icon">
                  <Monitor size={17} />
                </span>
                <span>
                  <b>
                    {titleCase(item.os)} · {titleCase(item.architecture)}
                  </b>
                  <small>
                    {item.fileName} · {item.format.toUpperCase()} ·{" "}
                    {formatBytes(item.fileSize)}
                  </small>
                </span>
              </div>
              <DownloadButton item={item} />
              {item.sha256Checksum && (
                <div className="checksum-line">
                  <span>
                    SHA-256{item.checksumVerified ? " · verified" : ""}
                  </span>
                  <CopyChecksum value={item.sha256Checksum} />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="state-card">
          No download files have been published for this release.
        </div>
      )}
    </div>
  );
}

const infoPages: Record<
  string,
  { title: string; intro: string; sections: [string, string][] }
> = {
  about: {
    title: "Software made with intention.",
    intro:
      "ZEROTRICX is an independent software studio focused on making digital work feel a little more considered.",
    sections: [
      [
        "A small, focused collection",
        "Every release is built and maintained by a single owner. We publish clear version information, platform availability, and checksums where available.",
      ],
      [
        "Our promise",
        "No marketplace clutter, surprise account requirements, or invented platform support. You only see products and installers that are actually published.",
      ],
    ],
  },
  support: {
    title: "We’re here to help.",
    intro:
      "Need a hand installing an app, found a problem, or have a product question? Get in touch and include the product name and version.",
    sections: [
      [
        "Product support",
        "Use the support link on each product page for the most relevant help. For general inquiries, email support@example.com.",
      ],
      [
        "Download trouble",
        "Check that you selected the correct operating system and architecture. Compare the SHA-256 checksum shown on the product page to your downloaded file when one is available.",
      ],
    ],
  },
  guides: {
    title: "A smoother first install.",
    intro:
      "A few practical tips to get up and running with software from ZEROTRICX.",
    sections: [
      [
        "Windows",
        "Download the EXE or MSI listed for Windows, open it, and follow the installer prompts. Windows may ask you to confirm that you trust the publisher.",
      ],
      [
        "macOS",
        "Download the DMG or PKG listed for your Mac. Open the file and follow the instructions shown. Choose the ARM64 or universal build when listed for Apple silicon.",
      ],
      [
        "Linux",
        "Use the package format your distribution supports. For AppImage files, mark the download executable before launching.",
      ],
    ],
  },
  "release-notes": {
    title: "Every version, clearly listed.",
    intro:
      "Release notes and previous versions are listed on each application page. Older releases remain available when the owner keeps their installers published.",
    sections: [
      [
        "What you’ll find",
        "Each release can include a version, publication date, changelog, release channel, and the installers actually provided for each platform.",
      ],
      [
        "Integrity",
        "SHA-256 checksums are calculated from the stored file after upload. A verified label means the checksum was computed from that installer.",
      ],
    ],
  },
  privacy: {
    title: "Privacy, without the fine print.",
    intro:
      "Browsing and downloading do not require an account or an email address.",
    sections: [
      [
        "Anonymous analytics",
        "The store records download clicks to understand which software and platforms are useful. It does not intentionally store full visitor IP addresses. Standard server and hosting logs may be retained by the infrastructure provider.",
      ],
      [
        "Administrator data",
        "Administrator authentication uses a protected HttpOnly cookie. Contact details are used only to respond to support requests. Contact support@example.com with privacy questions.",
      ],
    ],
  },
  terms: {
    title: "Terms of use.",
    intro:
      "Use this store to learn about and download software. Product-specific license terms apply to each application.",
    sections: [
      [
        "Downloads",
        "Installers are offered as-is by their publisher. Review the checksum when provided and use a current antivirus tool. Download click analytics do not confirm that a file completed downloading or was installed.",
      ],
      [
        "Software licenses",
        "The license on each product page governs use of that application. Store content and availability may change over time.",
      ],
    ],
  },
};

function InfoPage({ page }: { page: string }) {
  const data = infoPages[page];
  const settings = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => (await api<ApiResult<any>>("/settings/public")).data,
  });
  return (
    <Shell>
      <PageMeta
        title={`${data.title} — ZEROTRICX STORE`}
        description={data.intro}
      />
      <section className="page-hero info-hero">
        <div className="container">
          <div className="eyebrow">ZEROTRICX SOFTWARE</div>
          <h1>{data.title}</h1>
          <p>{data.intro}</p>
        </div>
      </section>
      <section className="section">
        <div className="container info-content">
          {data.sections.map(([title, text]) => (
            <article key={title}>
              <h2>{title}</h2>
              <p>
                {page === "support" && title === "Product support" ? (
                  <>
                    Use the support link on each product page for the most
                    relevant help. For general inquiries, contact us at{" "}
                    {settings.data?.contactEmail ? (
                      <a href={`mailto:${settings.data.contactEmail}`}>
                        {settings.data.contactEmail}
                      </a>
                    ) : (
                      "the support address listed on the product page"
                    )}
                    .
                  </>
                ) : (
                  text
                )}
              </p>
            </article>
          ))}
        </div>
      </section>
    </Shell>
  );
}

function NotFound() {
  return (
    <Shell>
      <PageMeta
        title="Page not found — ZEROTRICX STORE"
        description="The requested page could not be found."
      />
      <section className="not-found">
        <div className="container">
          <div className="eyebrow">404 · WRONG TURN</div>
          <h1>
            Nothing here
            <br />
            <em>but possibility.</em>
          </h1>
          <p>That page doesn’t exist—or it’s moved on.</p>
          <Link className="button button-dark" to="/">
            Back to the beginning <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </Shell>
  );
}

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [error, setError] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const mutation = useMutation({
    mutationFn: (data: { username: string; password: string }) =>
      api<ApiResult<{ twoFactorRequired: boolean; challengeToken?: string }>>(
        "/admin/auth/login",
        { method: "POST", body: JSON.stringify(data) },
      ),
    onSuccess: (result) => {
      if (result.data.twoFactorRequired && result.data.challengeToken)
        setChallengeToken(result.data.challengeToken);
      else onSuccess();
    },
    onError: (err: Error) => setError(err.message),
  });
  const verifyMutation = useMutation({
    mutationFn: (code: string) =>
      api("/admin/auth/verify-two-factor", {
        method: "POST",
        body: JSON.stringify({ challengeToken, code }),
      }),
    onSuccess,
    onError: (err: Error) => setError(err.message),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    if (challengeToken) verifyMutation.mutate(String(data.get("code")));
    else
      mutation.mutate({
        username: String(data.get("username")),
        password: String(data.get("password")),
      });
  }
  return (
    <main className="admin-login-wrap">
      <PageMeta
        title="Administrator sign in — ZEROTRICX STORE"
        description="Private administrator sign in."
      />
      <div className="login-top-tools">
        <AppearanceControls />
      </div>
      <Link to="/" className="brand login-brand">
        <span className="brand-mark">
          <Command size={18} />
        </span>
        <span>ZEROTRICX STORE</span>
      </Link>
      <form className="login-card" onSubmit={submit}>
        <div className="admin-lock">
          <LockKeyhole size={21} />
        </div>
        <div className="eyebrow">PRIVATE AREA</div>
        <h1>{challengeToken ? "Check your email." : "Welcome back."}</h1>
        <p>
          {challengeToken
            ? "Enter the 6-digit code sent to your verified administrator email."
            : "Sign in to manage your software store."}
        </p>
        {challengeToken ? (
          <label>
            Email verification code
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
            />
          </label>
        ) : (
          <>
            <label>
              Username or email
              <input name="username" autoComplete="username" required />
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
              />
            </label>
          </>
        )}
        {error && (
          <div className="inline-error" role="alert">
            {error}
          </div>
        )}
        <button
          className="button button-dark full-button"
          disabled={mutation.isPending || verifyMutation.isPending}
        >
          {mutation.isPending || verifyMutation.isPending
            ? "Please wait…"
            : challengeToken
              ? "Verify and sign in"
              : "Sign in"}{" "}
          <ArrowRight size={16} />
        </button>
        {challengeToken && (
          <button
            type="button"
            className="button button-outline full-button"
            onClick={() => {
              setChallengeToken("");
              setError("");
            }}
          >
            Back to sign in
          </button>
        )}
        <span className="secure-note">
          <LockKeyhole size={13} /> Administrator access only
        </span>
      </form>
    </main>
  );
}

function xhrUpload(
  url: string,
  blob: Blob,
  headers: Record<string, string>,
  signal: AbortSignal,
  onProgress: (value: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (signal.aborted) {
      reject(new DOMException("Upload cancelled", "AbortError"));
      return;
    }
    xhr.open("PUT", url);
    Object.entries(headers).forEach(([key, value]) =>
      xhr.setRequestHeader(key, value),
    );
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve(xhr.getResponseHeader("ETag") || "")
        : reject(
            new Error(
              `Storage rejected the upload (${xhr.status}). Check the R2 bucket CORS configuration.`,
            ),
          );
    xhr.onerror = () =>
      reject(
        new Error(
          `The browser could not reach R2. Check your network and configure bucket CORS to allow PUT from ${window.location.origin}; allow the signed request headers and expose ETag for multipart uploads.`,
        ),
      );
    xhr.onabort = () =>
      reject(new DOMException("Upload cancelled", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

async function retryXhrUpload(
  url: string,
  blob: Blob,
  headers: Record<string, string>,
  signal: AbortSignal,
  onProgress: (value: number) => void,
): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await xhrUpload(url, blob, headers, signal, onProgress);
    } catch (error) {
      const message = (error as Error).message;
      const retryable =
        message.includes("Upload failed") ||
        /Storage rejected the upload \(5\d\d\)/.test(message);
      if ((error as Error).name === "AbortError" || !retryable || attempt === 1)
        throw error;
      await new Promise((resolve) =>
        window.setTimeout(resolve, 400 * (attempt + 1)),
      );
      if (signal.aborted)
        throw new DOMException("Upload cancelled", "AbortError");
    }
  }
  throw new Error("Upload retry failed.");
}

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const client = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const validSections = [
    "overview",
    "applications",
    "reviews",
    "profile",
    "settings",
  ];
  const requestedSection =
    location.pathname.replace(/\/+$/, "").split("/").pop() || "";
  const activeSection = validSections.includes(requestedSection)
    ? requestedSection
    : "overview";
  const [reviewFilter, setReviewFilter] = useState("pending");
  const [githubImporting, setGithubImporting] = useState(false);
  const [githubMessage, setGithubMessage] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileMessageKind, setProfileMessageKind] = useState<
    "success" | "error"
  >("success");
  const [verificationCode, setVerificationCode] = useState("");
  const [emailChangeCode, setEmailChangeCode] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const adminProfile = useQuery({
    queryKey: ["admin-profile"],
    queryFn: async () => (await api<ApiResult<any>>("/admin/auth/me")).data,
  });
  const adminReviews = useQuery({
    queryKey: ["admin-reviews", reviewFilter],
    queryFn: async () =>
      (await api<ApiResult<any[]>>(`/admin/reviews?status=${reviewFilter}`))
        .data,
  });
  const [selected, setSelected] = useState<AppProduct | null>(null);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error">(
    "success",
  );
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedInstallerFiles, setSelectedInstallerFiles] = useState<Record<string, File | undefined>>({});
  const [abortUpload, setAbortUpload] = useState<AbortController | null>(null);
  const [appError, setAppError] = useState("");
  const [releaseError, setReleaseError] = useState("");
  const [appFilter, setAppFilter] = useState<"all" | "draft" | "published">(
    "all",
  );
  const [appSearch, setAppSearch] = useState("");
  const [savingApplication, setSavingApplication] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const stats = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => (await api<ApiResult<any>>("/admin/dashboard")).data,
  });
  const apps = useQuery({
    queryKey: ["admin-applications"],
    queryFn: async () =>
      (await api<ApiResult<AppProduct[]>>("/admin/applications?limit=100"))
        .data,
  });
  const releases = useQuery({
    queryKey: ["admin-releases", selected?._id],
    enabled: !!selected,
    queryFn: async () =>
      (
        await api<ApiResult<Release[]>>(
          `/admin/applications/${selected!._id}/releases`,
        )
      ).data,
  });
  const settings = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await api<ApiResult<any>>("/admin/settings")).data,
  });
  useEffect(() => {
    if (location.pathname === "/admin" || location.pathname === "/admin/") {
      navigate("/admin/overview", { replace: true });
    } else if (!validSections.includes(requestedSection)) {
      navigate("/admin/overview", { replace: true });
    } else {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [location.pathname, navigate, requestedSection]);
  const visibleApps = (apps.data || []).filter((item) => {
    const matchesStatus = appFilter === "all" || item.status === appFilter;
    const matchesSearch = `${item.name} ${item.slug} ${item.category}`
      .toLowerCase()
      .includes(appSearch.toLowerCase().trim());
    return matchesStatus && matchesSearch;
  });
  function notify(text: string, kind: "success" | "error" = "success") {
    setMessage(text);
    setMessageKind(kind);
  }
  async function importGithubDetails(formElement: HTMLFormElement) {
    setGithubMessage("");
    setGithubImporting(true);
    try {
      const form = new FormData(formElement);
      const result = await api<ApiResult<Record<string, string>>>(
        "/admin/applications/github-preview",
        {
          method: "POST",
          body: JSON.stringify({ githubUrl: form.get("githubUrl") }),
        },
      );
      for (const [name, value] of Object.entries(result.data)) {
        const field = formElement.elements.namedItem(name);
        if (
          field instanceof HTMLInputElement ||
          field instanceof HTMLTextAreaElement
        )
          field.value = value || "";
      }
      setGithubMessage(
        "Repository details loaded. Review the imported fields and complete any missing details before saving.",
      );
    } catch (error) {
      setGithubMessage(
        (error as Error).message ||
          "GitHub repository details could not be loaded.",
      );
    } finally {
      setGithubImporting(false);
    }
  }
  async function togglePinned(app: AppProduct) {
    try {
      await api(`/admin/applications/${app._id}/pinned`, { method: "PATCH" });
      if (selected?._id === app._id)
        setSelected({ ...selected, isPinned: !app.isPinned });
      void client.invalidateQueries({ queryKey: ["admin-applications"] });
      notify(
        app.isPinned
          ? `${app.name} removed from pinned applications.`
          : `${app.name} pinned in your dashboard.`,
      );
    } catch (error) {
      notify(
        (error as Error).message || "Could not update the pinned application.",
        "error",
      );
    }
  }
  function profileFeedback(message: string, error = false) {
    setProfileMessage(message);
    setProfileMessageKind(error ? "error" : "success");
  }
  async function requestEmailVerification() {
    try {
      const result = await api<{ message: string }>(
        "/admin/auth/email/verification/send",
        { method: "POST" },
      );
      profileFeedback(result.message);
    } catch (error) {
      profileFeedback((error as Error).message, true);
    }
  }
  async function confirmEmailVerification() {
    try {
      await api("/admin/auth/email/verification/confirm", {
        method: "POST",
        body: JSON.stringify({ code: verificationCode }),
      });
      setVerificationCode("");
      profileFeedback("Administrator email verified.");
      void client.invalidateQueries({ queryKey: ["admin-profile"] });
    } catch (error) {
      profileFeedback((error as Error).message, true);
    }
  }
  async function requestEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{ message: string }>(
        "/admin/auth/email/change/request",
        {
          method: "POST",
          body: JSON.stringify({
            email: form.get("email"),
            currentPassword: form.get("currentPassword"),
          }),
        },
      );
      profileFeedback(result.message);
    } catch (error) {
      profileFeedback((error as Error).message, true);
    }
  }
  async function confirmEmailChange() {
    try {
      await api("/admin/auth/email/change/confirm", {
        method: "POST",
        body: JSON.stringify({ code: emailChangeCode }),
      });
      setEmailChangeCode("");
      profileFeedback("Administrator email updated and verified.");
      void client.invalidateQueries({ queryKey: ["admin-profile"] });
    } catch (error) {
      profileFeedback((error as Error).message, true);
    }
  }
  async function startTwoFactorSetup() {
    try {
      const result = await api<{ message: string }>(
        "/admin/auth/two-factor/setup",
        { method: "POST" },
      );
      profileFeedback(result.message);
    } catch (error) {
      profileFeedback((error as Error).message, true);
    }
  }
  async function enableTwoFactor() {
    try {
      await api("/admin/auth/two-factor/enable", {
        method: "POST",
        body: JSON.stringify({ code: twoFactorCode }),
      });
      setTwoFactorCode("");
      profileFeedback("Email two-factor authentication is now enabled.");
      void client.invalidateQueries({ queryKey: ["admin-profile"] });
    } catch (error) {
      profileFeedback((error as Error).message, true);
    }
  }
  async function disableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api("/admin/auth/two-factor/disable", {
        method: "POST",
        body: JSON.stringify({ currentPassword: form.get("currentPassword") }),
      });
      formElement.reset();
      profileFeedback("Email two-factor authentication is disabled.");
      void client.invalidateQueries({ queryKey: ["admin-profile"] });
    } catch (error) {
      profileFeedback((error as Error).message, true);
    }
  }
  async function changeAdminPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api("/admin/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: form.get("currentPassword"),
          newPassword: form.get("newPassword"),
        }),
      });
      formElement.reset();
      profileFeedback(
        "Password changed. Signing out so you can authenticate with the new password.",
      );
      window.setTimeout(() => onLogout(), 1200);
    } catch (error) {
      profileFeedback((error as Error).message, true);
    }
  }
  const releaseMutation = useMutation({
    mutationFn: (value: {
      version: string;
      releaseType: string;
      changelog: string;
      releaseDate: string;
    }) =>
      api(`/admin/applications/${selected!._id}/releases`, {
        method: "POST",
        body: JSON.stringify({ ...value, status: "draft" }),
      }),
    onSuccess: () => {
      setReleaseError("");
      notify("Release created. Add its installers below.");
      void client.invalidateQueries({ queryKey: ["admin-releases"] });
    },
    onError: (error: Error) => setReleaseError(error.message),
  });

  async function logout() {
    try {
      await api("/admin/auth/logout", { method: "POST" });
    } finally {
      onLogout();
    }
  }
  async function createApp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppError("");
    setSavingApplication(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    let createdApp: AppProduct | undefined;
    try {
      const created = await api<ApiResult<AppProduct>>("/admin/applications", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          slug: form.get("slug"),
          shortDescription: form.get("shortDescription"),
          description: form.get("description"),
          category: form.get("category"),
          features: String(form.get("features"))
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          supportedPlatforms: parsePlatforms(String(form.get("platforms"))),
          installationInstructions: parseInstructions(
            String(form.get("instructions")),
          ),
          license: form.get("license"),
          supportUrl: form.get("supportUrl") || undefined,
          githubUrl: form.get("githubUrl") || undefined,
          websiteUrl: form.get("websiteUrl") || undefined,
          seoTitle: form.get("seoTitle"),
          seoDescription: form.get("seoDescription"),
          status: "draft",
        }),
      });
      createdApp = created.data;
      setSelected(createdApp);
      const icon = form.get("iconFile");
      if (icon instanceof File && icon.size > 0) {
        const uploaded = await uploadApplicationImage(
          createdApp._id,
          "icon",
          icon,
        );
        createdApp = { ...createdApp, icon: uploaded.data };
        setSelected(createdApp);
      }
      const screenshots = form
        .getAll("screenshotFiles")
        .filter((file): file is File => file instanceof File && file.size > 0);
      const captions = String(form.get("screenshotCaptions") || "").split("\n");
      for (const [index, file] of screenshots.entries()) {
        const uploaded = await uploadApplicationImage(
          createdApp._id,
          "screenshot",
          file,
          captions[index]?.trim() || "",
        );
        createdApp = {
          ...createdApp,
          screenshots: [...(createdApp.screenshots || []), uploaded.data],
        };
        setSelected(createdApp);
      }
      if (createdApp) setSelected(createdApp);
      formElement.reset();
      notify("Draft saved. It is private until you publish it.");
      window.setTimeout(
        () =>
          document
            .querySelector(".selected-app-panel")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        80,
      );
      void client.invalidateQueries({ queryKey: ["admin-applications"] });
      void client.invalidateQueries({ queryKey: ["admin-dashboard"] });
    } catch (error) {
      if (createdApp) {
        setSelected(createdApp);
        formElement.reset();
        setAppError(
          `Your draft was saved, but an image upload failed: ${(error as Error).message}. The saved draft is selected below; retry any missing images there.`,
        );
        window.setTimeout(
          () =>
            document
              .querySelector(".selected-app-panel")
              ?.scrollIntoView({ behavior: "smooth", block: "start" }),
          80,
        );
      } else {
        setAppError(
          (error as Error).message ||
            "The product could not be saved. Check the highlighted details and try again.",
        );
      }
      setMessageKind("error");
      void client.invalidateQueries({ queryKey: ["admin-applications"] });
    } finally {
      setSavingApplication(false);
    }
  }

  async function updateApp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const updated = await api<ApiResult<AppProduct>>(
        `/admin/applications/${selected._id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: form.get("name"),
            slug: form.get("slug"),
            shortDescription: form.get("shortDescription"),
            description: form.get("description"),
            category: form.get("category"),
            features: String(form.get("features"))
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
            supportedPlatforms: parsePlatforms(String(form.get("platforms"))),
            installationInstructions: parseInstructions(
              String(form.get("instructions")),
            ),
            license: form.get("license"),
            supportUrl: form.get("supportUrl") || undefined,
            privacyPolicyUrl: form.get("privacyPolicyUrl") || undefined,
            githubUrl: form.get("githubUrl") || undefined,
            websiteUrl: form.get("websiteUrl") || undefined,
            seoTitle: form.get("seoTitle"),
            seoDescription: form.get("seoDescription"),
          }),
        },
      );
      setSelected(updated.data);
      notify("Application details saved.");
      void client.invalidateQueries({ queryKey: ["admin-applications"] });
      void client.invalidateQueries({ queryKey: ["apps"] });
    } catch (error) {
      const message =
        (error as Error).message || "Could not save application details.";
      setAppError(message);
      notify(message, "error");
    }
  }

  async function removeApplicationImage(
    kind: "icon" | "screenshot",
    key: string,
  ) {
    if (!selected) return;
    try {
      await api(`/admin/applications/${selected._id}/images`, {
        method: "DELETE",
        body: JSON.stringify({ kind, key }),
      });
      setSelected({
        ...selected,
        ...(kind === "icon"
          ? { icon: undefined }
          : {
              screenshots: selected.screenshots?.filter(
                (image) => image.key !== key,
              ),
            }),
      });
      notify("Image removed.");
      void client.invalidateQueries({ queryKey: ["admin-applications"] });
      void client.invalidateQueries({ queryKey: ["apps"] });
    } catch (error) {
      setAppError((error as Error).message);
    }
  }

  async function uploadSelectedImages(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setAppError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    let updated = { ...selected };
    try {
      const icon = form.get("iconFile");
      if (icon instanceof File && icon.size > 0) {
        const uploaded = await uploadApplicationImage(
          selected._id,
          "icon",
          icon,
        );
        updated = { ...updated, icon: uploaded.data };
        setSelected(updated);
      }
      const screenshots = form
        .getAll("screenshotFiles")
        .filter((file): file is File => file instanceof File && file.size > 0);
      const captions = String(form.get("screenshotCaptions") || "").split("\n");
      for (const [index, file] of screenshots.entries()) {
        const uploaded = await uploadApplicationImage(
          selected._id,
          "screenshot",
          file,
          captions[index]?.trim() || "",
        );
        updated = {
          ...updated,
          screenshots: [...(updated.screenshots || []), uploaded.data],
        };
        setSelected(updated);
      }
      setSelected(updated);
      formElement.reset();
      notify("Image uploads completed.");
      void client.invalidateQueries({ queryKey: ["admin-applications"] });
      void client.invalidateQueries({ queryKey: ["apps"] });
    } catch (error) {
      setSelected(updated);
      setAppError(
        `Some images may already have uploaded. ${(error as Error).message} Completed uploads are saved; retry any images that are still missing.`,
      );
      void client.invalidateQueries({ queryKey: ["admin-applications"] });
    }
  }

  async function changeAppStatus(app: AppProduct, status: string) {
    try {
      const result = await api<ApiResult<AppProduct>>(
        `/admin/applications/${app._id}/status`,
        { method: "PATCH", body: JSON.stringify({ status }) },
      );
      if (selected?._id === app._id) setSelected(result.data);
      notify(
        status === "published"
          ? `${app.name} is now published.`
          : `${app.name} is now ${status}.`,
      );
      void client.invalidateQueries({ queryKey: ["admin-applications"] });
      void client.invalidateQueries({ queryKey: ["apps"] });
      void client.invalidateQueries({ queryKey: ["admin-dashboard"] });
    } catch (error) {
      notify(
        (error as Error).message ||
          "Could not update the application status. Please try again.",
        "error",
      );
    }
  }
  async function changeReleaseStatus(release: Release, status: string) {
    try {
      await api(`/admin/releases/${release._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      notify(
        status === "published"
          ? `Release ${release.version} is published.`
          : `Release ${release.version} is ${status}.`,
      );
      void client.invalidateQueries({ queryKey: ["admin-releases"] });
    } catch (error) {
      notify(
        (error as Error).message || "Could not update release status.",
        "error",
      );
    }
  }
  async function updateRelease(
    event: FormEvent<HTMLFormElement>,
    release: Release,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api(`/admin/releases/${release._id}`, {
        method: "PUT",
        body: JSON.stringify({
          version: form.get("version"),
          releaseType: form.get("releaseType"),
          changelog: form.get("changelog"),
          releaseDate: form.get("releaseDate"),
        }),
      });
      notify(`Version ${String(form.get("version"))} updated.`);
      void client.invalidateQueries({ queryKey: ["admin-releases"] });
    } catch (error) {
      notify(
        (error as Error).message || "Could not save the release.",
        "error",
      );
    }
  }
  async function changeDownloadStatus(download: Download, status: string) {
    try {
      await api(`/admin/downloads/${download._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      notify(
        status === "published"
          ? "Installer is now published."
          : "Installer is now disabled.",
      );
      void client.invalidateQueries({ queryKey: ["admin-releases"] });
    } catch (error) {
      notify(
        (error as Error).message || "Could not update installer status.",
        "error",
      );
    }
  }

  async function uploadInstaller(
    event: FormEvent<HTMLFormElement>,
    release: Release,
  ) {
    event.preventDefault();
    setMessage("");
    setMessageKind("success");
    setBusy(true);
    setUploadProgress(0);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("file") as File;
    const controller = new AbortController();
    setAbortUpload(controller);
    let downloadId = "";
    try {
      const init = await api<
        ApiResult<{
          downloadId: string;
          uploadUrl?: string;
          key: string;
          multipart: boolean;
          uploadId?: string;
          partSize: number;
          contentType: string;
        }>
      >(`/admin/releases/${release._id}/uploads`, {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          os: form.get("os"),
          architecture: form.get("architecture"),
          format: form.get("format"),
        }),
      });
      downloadId = init.data.downloadId;
      if (init.data.multipart && init.data.uploadId) {
        const chunks = Math.ceil(file.size / init.data.partSize);
        const parts: { PartNumber: number; ETag: string }[] = [];
        for (let index = 0; index < chunks; index += 1) {
          const partNumber = index + 1;
          const partUrl = await api<ApiResult<{ url: string }>>(
            `/admin/downloads/${downloadId}/parts/${partNumber}`,
          );
          const chunk = file.slice(
            index * init.data.partSize,
            Math.min(file.size, (index + 1) * init.data.partSize),
          );
          const etag = await retryXhrUpload(
            partUrl.data.url,
            chunk,
            {},
            controller.signal,
            (partProgress) =>
              setUploadProgress(
                Math.round(((index + partProgress) / chunks) * 100),
              ),
          );
          if (!etag)
            throw new Error(
              "R2 did not return a multipart ETag. Ensure the bucket CORS exposes the ETag header.",
            );
          parts.push({ PartNumber: partNumber, ETag: etag });
        }
        await api(`/admin/downloads/${downloadId}/complete`, {
          method: "POST",
          body: JSON.stringify({ parts }),
        });
      } else if (init.data.uploadUrl) {
        await retryXhrUpload(
          init.data.uploadUrl,
          file,
          { "Content-Type": init.data.contentType },
          controller.signal,
          (progress) => setUploadProgress(Math.round(progress * 100)),
        );
        await api(`/admin/downloads/${downloadId}/complete`, {
          method: "POST",
          body: JSON.stringify({}),
        });
      } else {
        throw new Error("Storage did not return a usable upload target.");
      }
      notify(
        `Uploaded ${file.name}. The server verified its SHA-256 checksum.`,
      );
      formElement.reset();
      setSelectedInstallerFiles((current) => {
        const next = { ...current };
        delete next[release._id];
        return next;
      });
      void client.invalidateQueries({ queryKey: ["admin-releases"] });
    } catch (error) {
      if (downloadId)
        await api(`/admin/downloads/${downloadId}/upload`, {
          method: "DELETE",
        }).catch(() => undefined);
      if ((error as Error).name === "AbortError") notify("Upload cancelled.");
      else
        notify(
          (error as Error).message || "Installer upload failed. Please retry.",
          "error",
        );
    } finally {
      setBusy(false);
      setUploadProgress(null);
      setAbortUpload(null);
    }
  }

  async function addExternal(
    event: FormEvent<HTMLFormElement>,
    release: Release,
  ) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api(`/admin/releases/${release._id}/downloads`, {
        method: "POST",
        body: JSON.stringify({
          os: form.get("os"),
          architecture: form.get("architecture"),
          format: form.get("format"),
          storageProvider: "external",
          fileName: form.get("fileName"),
          externalUrl: form.get("externalUrl"),
          fileSize: Number(form.get("fileSize") || 0),
          status: "disabled",
        }),
      });
      formElement.reset();
      notify(
        "External installer added as disabled. Publish the application and release, then enable the installer.",
      );
      void client.invalidateQueries({ queryKey: ["admin-releases"] });
    } catch (error) {
      notify(
        (error as Error).message || "Could not add the external installer.",
        "error",
      );
    }
  }

  return (
    <div className="admin-shell">
      <PageMeta
        title="Store dashboard — ZEROTRICX STORE"
        description="Manage products, releases, downloads, and store analytics."
      />
      <aside className="admin-sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Command size={18} />
          </span>
          <span>ZEROTRICX STORE</span>
        </Link>
        <div className="admin-side-label">WORKSPACE</div>
        <NavLink
          end
          to="/admin/overview"
          className={({ isActive }) =>
            `admin-side-link ${isActive ? "selected" : ""}`
          }
        >
          <Layers3 size={17} /> Overview
        </NavLink>
        <NavLink
          end
          to="/admin/applications"
          className={({ isActive }) =>
            `admin-side-link ${isActive ? "selected" : ""}`
          }
        >
          <PackageCheck size={17} /> Applications
        </NavLink>
        <NavLink
          end
          to="/admin/reviews"
          className={({ isActive }) =>
            `admin-side-link ${isActive ? "selected" : ""}`
          }
        >
          <Check size={17} /> Reviews
        </NavLink>
        <NavLink
          end
          to="/admin/profile"
          className={({ isActive }) =>
            `admin-side-link ${isActive ? "selected" : ""}`
          }
        >
          <LockKeyhole size={17} /> Profile &amp; security
        </NavLink>
        <NavLink
          end
          to="/admin/settings"
          className={({ isActive }) =>
            `admin-side-link ${isActive ? "selected" : ""}`
          }
        >
          <Globe2 size={17} /> Store settings
        </NavLink>
        <div className="admin-sidebar-bottom">
          <a href="/" className="admin-side-link">
            <ArrowUpRight size={16} /> View public store
          </a>
          <button onClick={logout} className="admin-side-link">
            <LockKeyhole size={16} /> Sign out
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="eyebrow">
              STORE CONTROL PANEL · {titleCase(activeSection)}
            </span>
            <h1>
              {activeSection === "overview"
                ? `Good day, ${adminProfile.data?.username || "administrator"}.`
                : {
                    applications: "Applications",
                    reviews: "Reviews",
                    profile: "Profile & security",
                    settings: "Store settings",
                  }[activeSection] || "Overview"}
            </h1>
          </div>
          <div className="admin-topbar-actions">
            <AppearanceControls />
            <button className="button button-outline" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>
        {message && (
          <div
            className="admin-message"
            role={messageKind === "error" ? "alert" : "status"}
          >
            {messageKind === "error" ? <X size={16} /> : <Check size={16} />}
            {message}
            <button aria-label="Dismiss message" onClick={() => setMessage("")}>
              <X size={15} />
            </button>
          </div>
        )}
        {activeSection === "overview" && (
          <div className="stat-grid" id="overview">
            {[
              [
                "Published apps",
                stats.data?.stats?.publishedApplications ?? "—",
              ],
              ["Draft apps", stats.data?.stats?.draftApplications ?? "—"],
              ["Releases", stats.data?.stats?.totalReleases ?? "—"],
              [
                "Download clicks",
                stats.data?.stats?.totalDownloadEvents ?? "—",
              ],
              ["Upload failures", stats.data?.stats?.failedDownloads ?? "—"],
            ].map(([label, value]) => (
              <div className="stat-card" key={label}>
                <span>{label}</span>
                <b>{value}</b>
                <small>
                  {label === "Download clicks"
                    ? "Within retention window"
                    : "Current totals"}
                </small>
              </div>
            ))}
          </div>
        )}
        {(activeSection === "overview" || activeSection === "applications") && (
          <div className="admin-content-grid">
            {activeSection === "applications" && (
              <section className="admin-panel" id="products">
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">YOUR CATALOG</div>
                    <h2>Applications</h2>
                  </div>
                  <span>{apps.data?.length || 0} total</span>
                </div>
                <div className="admin-list-toolbar">
                  <div
                    className="admin-filter-tabs"
                    aria-label="Filter applications"
                  >
                    {(["all", "draft", "published"] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        aria-pressed={appFilter === filter}
                        onClick={() => setAppFilter(filter)}
                      >
                        {filter === "all"
                          ? `All (${apps.data?.length || 0})`
                          : `${filter === "draft" ? "Drafts" : "Published"} (${apps.data?.filter((item) => item.status === filter).length || 0})`}
                      </button>
                    ))}
                  </div>
                  <input
                    aria-label="Search applications"
                    placeholder="Search products…"
                    value={appSearch}
                    onChange={(event) => setAppSearch(event.target.value)}
                  />
                </div>
                {apps.isLoading ? (
                  <p>Loading your products…</p>
                ) : apps.error ? (
                  <div className="inline-error" role="alert">
                    {(apps.error as Error).message}{" "}
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => void apps.refetch()}
                    >
                      Try again
                    </button>
                  </div>
                ) : visibleApps.length ? (
                  <div className="admin-app-list">
                    {visibleApps.map((item) => (
                      <div
                        key={item._id}
                        className={`admin-app-row ${selected?._id === item._id ? "active" : ""}`}
                      >
                        <button
                          className="admin-app-select"
                          onClick={() => {
                            setSelected(item);
                            setAppError("");
                            window.setTimeout(
                              () =>
                                document
                                  .querySelector(".selected-app-panel")
                                  ?.scrollIntoView({
                                    behavior: "smooth",
                                    block: "start",
                                  }),
                              80,
                            );
                          }}
                        >
                          <span className="admin-app-icon">
                            {item.icon?.url ? (
                              <img src={item.icon.url} alt="" />
                            ) : (
                              <Command size={17} />
                            )}
                          </span>
                          <span>
                            <b>
                              {item.isPinned && (
                                <Pin size={12} className="pin-indicator" />
                              )}{" "}
                              {item.name}
                            </b>
                            <small>
                              {item.currentVersion
                                ? `v${item.currentVersion}`
                                : item.category}{" "}
                              ·{" "}
                              {item.status === "published"
                                ? "Visible in store"
                                : "Private draft"}
                            </small>
                          </span>
                        </button>
                        <button
                          type="button"
                          className={`pin-app-button ${item.isPinned ? "pinned" : ""}`}
                          aria-label={`${item.isPinned ? "Unpin" : "Pin"} ${item.name}`}
                          title={`${item.isPinned ? "Unpin" : "Pin"} application`}
                          onClick={() => void togglePinned(item)}
                        >
                          <Pin size={15} />
                        </button>
                        <button
                          type="button"
                          className={`status-chip ${item.status}`}
                          aria-label={`${item.status === "published" ? "Unpublish" : "Publish"} ${item.name}`}
                          onClick={() =>
                            void changeAppStatus(
                              item,
                              item.status === "published"
                                ? "draft"
                                : "published",
                            )
                          }
                        >
                          {item.status === "published"
                            ? "Published"
                            : "Draft · Publish"}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="admin-draft-note">
                    {apps.data?.length
                      ? "No products match this filter. Try another status or search term."
                      : "No products yet. Create your first draft below; drafts are private and can be edited before you publish."}
                  </div>
                )}
                <details className="admin-create">
                  <summary>
                    <span>+</span> Create a product draft
                  </summary>
                  <p className="admin-draft-note">
                    Start with the required product details. Your product is
                    saved as a private draft; you can add releases and publish
                    it later.
                  </p>
                  <form onSubmit={createApp} className="stack-form">
                    <div className="github-import-box">
                      <label>
                        Import public repository details from GitHub
                        <input
                          name="githubUrl"
                          type="url"
                          placeholder="https://github.com/owner/repository"
                        />
                      </label>
                      <button
                        type="button"
                        className="button button-outline"
                        disabled={githubImporting}
                        onClick={(event) =>
                          void importGithubDetails(event.currentTarget.form!)
                        }
                      >
                        {githubImporting
                          ? "Fetching…"
                          : "Fetch repository details"}
                      </button>
                      {githubMessage && (
                        <p
                          className={
                            githubMessage.includes("loaded")
                              ? "admin-message"
                              : "inline-error"
                          }
                          role={
                            githubMessage.includes("loaded")
                              ? "status"
                              : "alert"
                          }
                        >
                          {githubMessage}
                        </p>
                      )}
                    </div>
                    <div className="admin-form-section">
                      <h3>Product basics</h3>
                      <p>Help visitors understand what the software does.</p>
                      <label>
                        Product name
                        <input
                          name="name"
                          required
                          maxLength={100}
                          placeholder="e.g. Studio Notes"
                        />
                      </label>
                      <label>
                        URL slug{" "}
                        <small>
                          Use lowercase letters, numbers, and hyphens.
                        </small>
                        <input
                          name="slug"
                          required
                          pattern="[a-z0-9]+(-[a-z0-9]+)*"
                          placeholder="studio-notes"
                        />
                      </label>
                      <label>
                        Short description
                        <input
                          name="shortDescription"
                          required
                          maxLength={200}
                          placeholder="A concise summary shown in the catalog"
                        />
                      </label>
                      <label>
                        Full description
                        <textarea
                          name="description"
                          required
                          rows={4}
                          placeholder="Describe the product and its main benefits."
                        />
                      </label>
                      <div className="form-two">
                        <label>
                          Category
                          <input
                            name="category"
                            required
                            placeholder="Productivity"
                          />
                        </label>
                        <label>
                          Features <small>Separate items with commas.</small>
                          <input
                            name="features"
                            placeholder="Fast, private, easy to use"
                          />
                        </label>
                      </div>
                    </div>
                    <div className="admin-form-section">
                      <h3>Platforms</h3>
                      <p>
                        List only operating systems and architectures your
                        product supports.
                      </p>
                      <label>
                        Supported platforms{" "}
                        <small>
                          Format: os:architecture,architecture; separate
                          platforms with semicolons.
                        </small>
                        <input
                          name="platforms"
                          defaultValue="windows:x64,arm64;linux:x64;macos:x64,arm64"
                        />
                      </label>
                    </div>
                    <div className="admin-form-section">
                      <h3>
                        Product images <span className="muted">Optional</span>
                      </h3>
                      <p>
                        Add an icon and screenshots. Images are uploaded
                        securely to Cloudinary.
                      </p>
                      <label>
                        App icon{" "}
                        <small>JPEG, PNG, WebP, or AVIF · max 5 MB</small>
                        <input
                          name="iconFile"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/avif"
                        />
                      </label>
                      <label>
                        Screenshots{" "}
                        <small>Select multiple images · max 10 MB each</small>
                        <input
                          name="screenshotFiles"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/avif"
                          multiple
                        />
                      </label>
                      <label>
                        Screenshot captions{" "}
                        <small>
                          One optional caption per selected image, in the same
                          order.
                        </small>
                        <textarea
                          name="screenshotCaptions"
                          rows={2}
                          placeholder="A clear view of the main screen"
                        />
                      </label>
                    </div>
                    <details className="admin-optional-fields">
                      <summary>Optional details, support, and SEO</summary>
                      <label>
                        Installation instructions{" "}
                        <small>One per line: windows: steps</small>
                        <textarea
                          name="instructions"
                          rows={3}
                          placeholder={
                            "windows: Run the installer and follow the steps.\\nmacos: Open the downloaded package."
                          }
                        />
                      </label>
                      <div className="form-two">
                        <label>
                          License
                          <input
                            name="license"
                            placeholder="Proprietary or MIT"
                          />
                        </label>
                        <label>
                          Support URL
                          <input
                            name="supportUrl"
                            type="url"
                            placeholder="https://example.com/support"
                          />
                        </label>
                      </div>
                      <label>
                        Website URL
                        <input
                          name="websiteUrl"
                          type="url"
                          placeholder="https://example.com"
                        />
                      </label>
                      <div className="form-two">
                        <label>
                          SEO title
                          <input name="seoTitle" maxLength={100} />
                        </label>
                        <label>
                          SEO description
                          <input name="seoDescription" maxLength={250} />
                        </label>
                      </div>
                    </details>
                    {appError && (
                      <div className="inline-error" role="alert">
                        {appError}
                      </div>
                    )}
                    <div className="admin-form-actions">
                      <button
                        className="button button-dark"
                        disabled={savingApplication}
                      >
                        {savingApplication
                          ? "Saving draft…"
                          : "Save product draft"}{" "}
                        <ArrowRight size={15} />
                      </button>
                      <small className="muted">
                        You can edit everything before publishing.
                      </small>
                    </div>
                  </form>
                </details>
              </section>
            )}
            {activeSection === "overview" && (
              <section className="admin-panel admin-overview">
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">LAST 30 DAYS</div>
                    <h2>Download clicks</h2>
                  </div>
                  <ArrowDownToLine size={19} />
                </div>
                {stats.isLoading ? (
                  <p>Loading statistics…</p>
                ) : stats.error ? (
                  <div className="inline-error">
                    {(stats.error as Error).message}
                  </div>
                ) : (
                  <>
                    <div
                      className="chart-bars"
                      aria-label="Daily download click chart"
                    >
                      {(stats.data?.daily || [])
                        .slice(-14)
                        .map((day: { date: string; count: number }) => {
                          const peak = Math.max(
                            1,
                            ...stats.data.daily.map(
                              (entry: { count: number }) => entry.count,
                            ),
                          );
                          return (
                            <div
                              title={`${day.date}: ${day.count} clicks`}
                              key={day.date}
                            >
                              <span
                                style={{
                                  height: `${Math.max(4, (day.count / peak) * 100)}%`,
                                }}
                              />
                              <small>{new Date(day.date).getDate()}</small>
                            </div>
                          );
                        })}
                    </div>
                    <div
                      className="chart-bars monthly-chart"
                      aria-label="Monthly download clicks"
                    >
                      {(stats.data?.monthly || []).map(
                        (month: { month: string; count: number }) => {
                          const peak = Math.max(
                            1,
                            ...stats.data.monthly.map(
                              (entry: { count: number }) => entry.count,
                            ),
                          );
                          return (
                            <div
                              title={`${month.month}: ${month.count} clicks`}
                              key={month.month}
                            >
                              <span
                                style={{
                                  height: `${Math.max(4, (month.count / peak) * 100)}%`,
                                }}
                              />
                              <small>
                                {new Date(`${month.month}-01`).toLocaleString(
                                  "en",
                                  { month: "short" },
                                )}
                              </small>
                            </div>
                          );
                        },
                      )}
                    </div>
                    <div className="os-breakdown">
                      {(stats.data?.operatingSystems || []).map(
                        (row: {
                          os: string;
                          count: number;
                          percentage: number;
                        }) => (
                          <div key={row.os}>
                            <span>
                              <span className="breakdown-dot" />
                              {titleCase(row.os)}
                            </span>
                            <b>
                              {row.count} <small>({row.percentage}%)</small>
                            </b>
                          </div>
                        ),
                      )}
                    </div>
                    <div className="top-apps">
                      {(stats.data?.topApplications || []).map(
                        (item: {
                          _id: string;
                          name: string;
                          totalDownloads: number;
                        }) => (
                          <div key={item._id}>
                            <span>{item.name}</span>
                            <b>{item.totalDownloads}</b>
                          </div>
                        ),
                      )}
                    </div>
                  </>
                )}
                <div className="panel-heading recent-heading">
                  <div>
                    <div className="eyebrow">RECENT</div>
                    <h2>Installer activity</h2>
                  </div>
                </div>
                {stats.data?.recentUploads?.map((item: any) => (
                  <div className="recent-upload" key={item._id}>
                    <FileUp size={15} />
                    <span>
                      {item.fileName}
                      <small>
                        {item.storageProvider.toUpperCase()} · {item.status}
                      </small>
                    </span>
                    <b>{formatBytes(item.fileSize)}</b>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}
        {activeSection === "applications" && selected && (
          <section className="admin-panel selected-app-panel">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">
                  MANAGE PRODUCT ·{" "}
                  {selected.status === "published" ? "LIVE" : "PRIVATE DRAFT"}
                </div>
                <h2>{selected.name}</h2>
              </div>
              <div className="manage-actions">
                <button
                  className="status-chip"
                  onClick={async () => {
                    try {
                      await api(
                        `/admin/applications/${selected._id}/featured`,
                        { method: "PATCH" },
                      );
                      setSelected({
                        ...selected,
                        isFeatured: !selected.isFeatured,
                      });
                      notify("Featured setting updated.");
                      void client.invalidateQueries({
                        queryKey: ["admin-applications"],
                      });
                    } catch (error) {
                      notify(
                        (error as Error).message ||
                          "Could not update featured status.",
                        "error",
                      );
                    }
                  }}
                >
                  {selected.isFeatured ? "Featured" : "Feature"}
                </button>
                <button
                  className="status-chip"
                  onClick={() => void togglePinned(selected)}
                >
                  <Pin size={13} /> {selected.isPinned ? "Pinned" : "Pin"}
                </button>
                <button
                  className="status-chip"
                  onClick={() =>
                    void changeAppStatus(
                      selected,
                      selected.status === "published" ? "draft" : "published",
                    )
                  }
                >
                  {selected.status === "published" ? "Unpublish" : "Publish"}
                </button>
                <button
                  className="status-chip"
                  onClick={() => void changeAppStatus(selected, "archived")}
                >
                  Archive
                </button>
                <button
                  className="button button-danger"
                  onClick={async () => {
                    if (
                      window.confirm(
                        `Permanently delete ${selected.name}, all releases, and all associated installers? This cannot be undone.`,
                      )
                    ) {
                      try {
                        await api(
                          `/admin/applications/${selected._id}?confirm=true`,
                          { method: "DELETE" },
                        );
                        setSelected(null);
                        notify("Product and its releases were deleted.");
                        void client.invalidateQueries({
                          queryKey: ["admin-applications"],
                        });
                        void client.invalidateQueries({
                          queryKey: ["admin-dashboard"],
                        });
                      } catch (error) {
                        notify(
                          (error as Error).message ||
                            "Could not delete the product.",
                          "error",
                        );
                      }
                    }
                  }}
                >
                  <Trash2 size={14} /> Delete application
                </button>
                <button
                  className="button button-outline"
                  onClick={() => setSelected(null)}
                >
                  Close
                </button>
              </div>
            </div>
            {selected.status !== "published" && (
              <div className="admin-draft-note" role="status">
                <b>Private draft.</b> Only admins can see this product. Edit its
                details, add and publish a release, then publish the product
                when ready.
              </div>
            )}
            <details className="admin-create" open>
              <summary>Edit application details</summary>
              <form
                key={selected._id}
                className="stack-form"
                onSubmit={(event) => void updateApp(event)}
              >
                <label>
                  Name
                  <input
                    name="name"
                    defaultValue={selected.name}
                    required
                    maxLength={100}
                  />
                </label>
                <label>
                  URL slug
                  <input
                    name="slug"
                    defaultValue={selected.slug}
                    required
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  />
                </label>
                <label>
                  Short description
                  <input
                    name="shortDescription"
                    defaultValue={selected.shortDescription}
                    required
                    maxLength={200}
                  />
                </label>
                <label>
                  Full description
                  <textarea
                    name="description"
                    defaultValue={selected.description}
                    rows={3}
                    required
                  />
                </label>
                <div className="form-two">
                  <label>
                    Category
                    <input
                      name="category"
                      defaultValue={selected.category}
                      required
                    />
                  </label>
                  <label>
                    Platforms{" "}
                    <small>
                      os:arch,arch|minimum requirements; semicolon separated
                    </small>
                    <input
                      name="platforms"
                      defaultValue={selected.supportedPlatforms
                        ?.map(
                          (platform) =>
                            `${platform.os}:${platform.architectures.join(",")}${platform.minRequirements ? `|${platform.minRequirements}` : ""}`,
                        )
                        .join(";")}
                    />
                  </label>
                </div>
                <label>
                  Features <small>Comma separated</small>
                  <input
                    name="features"
                    defaultValue={selected.features?.join(", ")}
                  />
                </label>
                <div className="form-two">
                  <label>
                    GitHub repository
                    <input
                      name="githubUrl"
                      type="url"
                      defaultValue={selected.githubUrl}
                    />
                  </label>
                  <label>
                    Website URL
                    <input
                      name="websiteUrl"
                      type="url"
                      defaultValue={selected.websiteUrl}
                    />
                  </label>
                </div>
                <label>
                  Installation instructions{" "}
                  <small>One per line: windows: steps</small>
                  <textarea
                    name="instructions"
                    rows={2}
                    defaultValue={Object.entries(
                      selected.installationInstructions || {},
                    )
                      .map(([platform, steps]) => `${platform}: ${steps}`)
                      .join("\n")}
                  />
                </label>
                <div className="form-two">
                  <label>
                    License
                    <input name="license" defaultValue={selected.license} />
                  </label>
                  <label>
                    Support URL
                    <input
                      name="supportUrl"
                      type="url"
                      defaultValue={selected.supportUrl}
                    />
                  </label>
                </div>
                <div className="form-two">
                  <label>
                    Privacy URL
                    <input
                      name="privacyPolicyUrl"
                      type="url"
                      defaultValue={selected.privacyPolicyUrl}
                    />
                  </label>
                  <label>
                    SEO title
                    <input name="seoTitle" defaultValue={selected.seoTitle} />
                  </label>
                </div>
                <label>
                  SEO description
                  <input
                    name="seoDescription"
                    defaultValue={selected.seoDescription}
                  />
                </label>
                {appError && <div className="inline-error">{appError}</div>}
                <button className="button button-dark">
                  Save application details <Check size={15} />
                </button>
              </form>
            </details>
            <form
              className="admin-image-manager stack-form"
              onSubmit={(event) => void uploadSelectedImages(event)}
            >
              <div className="eyebrow">CLOUDINARY IMAGES</div>
              <div className="form-two">
                <label>
                  Replace icon <small>JPEG, PNG, WebP, AVIF · max 5 MB</small>
                  <input
                    name="iconFile"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                  />
                </label>
                <label>
                  Add screenshots{" "}
                  <small>Multiple images · max 10 MB each</small>
                  <input
                    name="screenshotFiles"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    multiple
                  />
                </label>
              </div>
              <label>
                Screenshot captions{" "}
                <small>One caption per selected image, in order</small>
                <textarea name="screenshotCaptions" rows={2} />
              </label>
              <button className="button button-outline">Upload images</button>
              {appError && <div className="inline-error">{appError}</div>}
              <div className="admin-image-gallery">
                {selected.icon?.url && (
                  <div>
                    <img
                      src={selected.icon.url}
                      alt={`${selected.name} icon`}
                    />
                    <button
                      className="button button-outline"
                      type="button"
                      onClick={() =>
                        void removeApplicationImage(
                          "icon",
                          selected.icon?.key || "",
                        )
                      }
                    >
                      Remove icon
                    </button>
                  </div>
                )}
                {selected.screenshots?.map((image) => (
                  <div key={image.key}>
                    <img
                      src={image.url}
                      alt={image.caption || `${selected.name} screenshot`}
                    />
                    <span>{image.caption || "Screenshot"}</span>
                    <button
                      className="button button-outline"
                      type="button"
                      onClick={() =>
                        void removeApplicationImage("screenshot", image.key)
                      }
                    >
                      Remove screenshot
                    </button>
                  </div>
                ))}
              </div>
            </form>
            <div className="release-create-row">
              <form
                className="inline-release-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const formElement = event.currentTarget;
                  const form = new FormData(formElement);
                  releaseMutation.mutate({
                    version: String(form.get("version")),
                    releaseType: String(form.get("releaseType")),
                    changelog: String(form.get("changelog") || ""),
                    releaseDate: String(form.get("releaseDate")),
                  });
                  formElement.reset();
                }}
              >
                <input
                  name="version"
                  placeholder="Version (e.g. 1.0.0)"
                  required
                  pattern="v?[0-9]+\\.[0-9]+\\.[0-9]+(-[a-zA-Z0-9.-]+)?"
                />
                <select name="releaseType">
                  <option value="stable">Stable</option>
                  <option value="beta">Beta</option>
                  <option value="alpha">Alpha</option>
                </select>
                <input
                  name="releaseDate"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                />
                <input
                  name="changelog"
                  placeholder="Release notes (optional)"
                />
                <button
                  className="button button-dark"
                  disabled={releaseMutation.isPending}
                >
                  Add release <ArrowRight size={15} />
                </button>
              </form>
              {releaseError && (
                <div className="inline-error">{releaseError}</div>
              )}
            </div>
            {releases.isLoading ? (
              <p>Loading releases…</p>
            ) : releases.error ? (
              <div className="inline-error">
                {(releases.error as Error).message}
              </div>
            ) : (
              releases.data?.map((release) => (
                <div className="admin-release" key={release._id}>
                  <div className="release-admin-head">
                    <div>
                      <h3>Version {release.version}</h3>
                      <span>
                        {release.releaseType} ·{" "}
                        {new Date(release.releaseDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="manage-actions">
                      <button
                        className={`status-chip ${release.status}`}
                        onClick={() =>
                          void changeReleaseStatus(
                            release,
                            release.status === "published"
                              ? "draft"
                              : "published",
                          )
                        }
                      >
                        {release.status}
                      </button>
                      <button
                        className="delete-small"
                        title="Delete release and installers"
                        onClick={async () => {
                          if (
                            window.confirm(
                              `Permanently delete release ${release.version} and its installers?`,
                            )
                          ) {
                            await api(
                              `/admin/releases/${release._id}?confirm=true`,
                              { method: "DELETE" },
                            );
                            void client.invalidateQueries({
                              queryKey: ["admin-releases"],
                            });
                          }
                        }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                  <details className="release-edit">
                    <summary>Edit release and changelog</summary>
                    <form
                      key={release._id}
                      className="stack-form"
                      onSubmit={(event) => void updateRelease(event, release)}
                    >
                      <div className="form-two">
                        <label>
                          Version
                          <input
                            name="version"
                            defaultValue={release.version}
                            required
                          />
                        </label>
                        <label>
                          Release type
                          <select
                            name="releaseType"
                            defaultValue={release.releaseType}
                          >
                            <option value="stable">Stable</option>
                            <option value="beta">Beta</option>
                            <option value="alpha">Alpha</option>
                          </select>
                        </label>
                      </div>
                      <label>
                        Release date
                        <input
                          name="releaseDate"
                          type="date"
                          defaultValue={new Date(release.releaseDate)
                            .toISOString()
                            .slice(0, 10)}
                          required
                        />
                      </label>
                      <label>
                        Changelog
                        <textarea
                          name="changelog"
                          rows={3}
                          defaultValue={release.changelog}
                        />
                      </label>
                      <button className="button button-outline">
                        Save release
                      </button>
                    </form>
                  </details>
                  <div className="admin-download-list">
                    {release.downloads?.map((item) => (
                      <div className="admin-download-row" key={item._id}>
                        <span>
                          <b>
                            {titleCase(item.os)} · {item.architecture} ·{" "}
                            {item.format.toUpperCase()}
                          </b>
                          <small>
                            {item.fileName} · {formatBytes(item.fileSize)} ·{" "}
                            {item.sha256Checksum
                              ? `SHA-256 ${item.sha256Checksum.slice(0, 12)}…`
                              : "Checksum unavailable"}
                          </small>
                        </span>
                        <span className="download-source">
                          {item.storageProvider === "r2"
                            ? "Cloudflare R2"
                            : "External HTTPS"}
                        </span>
                        {item.status === "uploaded" ||
                        item.status === "published" ||
                        item.status === "disabled" ? (
                          <button
                            className={`status-chip ${item.status}`}
                            onClick={() =>
                              void changeDownloadStatus(
                                item,
                                item.status === "published"
                                  ? "disabled"
                                  : "published",
                              )
                            }
                          >
                            {item.status}
                          </button>
                        ) : (
                          <span className="status-chip">{item.status}</span>
                        )}
                        <button
                          className="delete-small"
                          title="Delete installer entry and R2 object"
                          onClick={async () => {
                            if (
                              window.confirm(
                                `Permanently delete ${item.fileName} and its R2 object?`,
                              )
                            ) {
                              try {
                                await api(
                                  `/admin/downloads/${item._id}?confirm=true`,
                                  { method: "DELETE" },
                                );
                                notify("Installer entry and R2 object deleted.");
                                void client.invalidateQueries({
                                  queryKey: ["admin-releases"],
                                });
                              } catch (error) {
                                notify(
                                  (error as Error).message ||
                                    "Could not delete the installer. Check the API's R2 permissions and server logs.",
                                  "error",
                                );
                              }
                            }
                          }}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <details className="upload-details">
                    <summary>
                      <FileUp size={15} /> Upload installer to Cloudflare R2
                    </summary>
                    <form
                      className="upload-form"
                      onSubmit={(event) => void uploadInstaller(event, release)}
                    >
                      <div className="form-three">
                        <label>
                          Platform
                          <select name="os">
                            <option value="windows">Windows</option>
                            <option value="linux">Linux</option>
                            <option value="macos">macOS</option>
                          </select>
                        </label>
                        <label>
                          Architecture
                          <select name="architecture">
                            <option value="x64">x64</option>
                            <option value="arm64">ARM64</option>
                            <option value="universal">Universal</option>
                          </select>
                        </label>
                        <label>
                          Format
                          <select name="format">
                            {[
                              "exe",
                              "msi",
                              "zip",
                              "deb",
                              "appimage",
                              "rpm",
                              "dmg",
                              "pkg",
                              "tar.gz",
                            ].map((format) => (
                              <option key={format}>{format}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="file-drop">
                        <FileUp size={20} />
                        <span>
                          <b aria-live="polite">
                            {selectedInstallerFiles[release._id]?.name ||
                              "Select installer file"}
                          </b>
                          <small>
                            {selectedInstallerFiles[release._id]
                              ? `Selected · ${formatBytes(selectedInstallerFiles[release._id]?.size)} · `
                              : "Files are sent directly to R2 · "}
                            max {import.meta.env.VITE_MAX_UPLOAD_MB || "2048"} MB
                          </small>
                        </span>
                        <input
                          name="file"
                          type="file"
                          required
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0];
                            setSelectedInstallerFiles((current) => ({
                              ...current,
                              [release._id]: file,
                            }));
                          }}
                        />
                      </label>
                      {uploadProgress !== null && (
                        <div className="progress-wrap">
                          <div>
                            <span>Uploading and verifying SHA-256…</span>
                            <b>{uploadProgress}%</b>
                          </div>
                          <progress value={uploadProgress} max="100" />
                        </div>
                      )}
                      <div className="upload-actions">
                        <button className="button button-dark" disabled={busy}>
                          <FileUp size={15} />{" "}
                          {busy ? "Uploading…" : "Start upload"}
                        </button>
                        {busy && (
                          <button
                            className="button button-outline"
                            type="button"
                            onClick={() => abortUpload?.abort()}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                  </details>
                  <details className="upload-details external-details">
                    <summary>
                      <Globe2 size={15} /> Add external HTTPS installer
                    </summary>
                    <form
                      className="upload-form"
                      onSubmit={(event) => void addExternal(event, release)}
                    >
                      <div className="form-three">
                        <label>
                          Platform
                          <select name="os">
                            <option value="windows">Windows</option>
                            <option value="linux">Linux</option>
                            <option value="macos">macOS</option>
                          </select>
                        </label>
                        <label>
                          Architecture
                          <select name="architecture">
                            <option value="x64">x64</option>
                            <option value="arm64">ARM64</option>
                            <option value="universal">Universal</option>
                          </select>
                        </label>
                        <label>
                          Format
                          <select name="format">
                            {[
                              "exe",
                              "msi",
                              "zip",
                              "deb",
                              "appimage",
                              "rpm",
                              "dmg",
                              "pkg",
                              "tar.gz",
                            ].map((format) => (
                              <option key={format}>{format}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="form-two">
                        <label>
                          File name
                          <input name="fileName" required />
                        </label>
                        <label>
                          File size (bytes)
                          <input
                            name="fileSize"
                            type="number"
                            min="0"
                            defaultValue="0"
                          />
                        </label>
                      </div>
                      <label>
                        External HTTPS URL
                        <input
                          name="externalUrl"
                          type="url"
                          required
                          placeholder="https://downloads.example.com/app.exe"
                        />
                      </label>
                      <button className="button button-outline">
                        Add external link <ArrowRight size={15} />
                      </button>
                    </form>
                  </details>
                </div>
              ))
            )}
            {!releases.isLoading && !releases.data?.length && (
              <p className="muted">
                No releases yet. Add the first release above.
              </p>
            )}
          </section>
        )}
        {activeSection === "reviews" && (
          <section className="admin-panel admin-reviews-panel" id="reviews">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">CUSTOMER FEEDBACK</div>
                <h2>Application reviews</h2>
              </div>
              <select
                aria-label="Filter reviews"
                value={reviewFilter}
                onChange={(event) => setReviewFilter(event.target.value)}
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            {adminReviews.isLoading ? (
              <p>Loading reviews…</p>
            ) : adminReviews.error ? (
              <div className="inline-error" role="alert">
                {(adminReviews.error as Error).message}
              </div>
            ) : adminReviews.data?.length ? (
              <div className="review-admin-list">
                {adminReviews.data.map((review) => (
                  <article className="review-admin-card" key={review._id}>
                    <div className="review-admin-title">
                      <div>
                        <b>{review.reviewerName}</b>
                        <span className="tag">
                          {review.application?.name || "Application removed"}
                        </span>
                      </div>
                      <span>
                        {"★".repeat(review.rating)}
                        {"☆".repeat(5 - review.rating)}
                      </span>
                    </div>
                    <p>{review.text}</p>
                    <small>
                      {new Date(review.createdAt).toLocaleString()} ·{" "}
                      {titleCase(review.status)}
                    </small>
                    <div className="admin-form-actions">
                      {review.status !== "approved" && (
                        <button
                          className="button button-outline"
                          onClick={async () => {
                            try {
                              await api(`/admin/reviews/${review._id}/status`, {
                                method: "PATCH",
                                body: JSON.stringify({ status: "approved" }),
                              });
                              notify("Review approved.");
                              void client.invalidateQueries({
                                queryKey: ["admin-reviews"],
                              });
                            } catch (error) {
                              notify(
                                (error as Error).message ||
                                  "Could not approve review.",
                                "error",
                              );
                            }
                          }}
                        >
                          Approve
                        </button>
                      )}
                      {review.status !== "rejected" && (
                        <button
                          className="button button-outline"
                          onClick={async () => {
                            try {
                              await api(`/admin/reviews/${review._id}/status`, {
                                method: "PATCH",
                                body: JSON.stringify({ status: "rejected" }),
                              });
                              notify("Review rejected.");
                              void client.invalidateQueries({
                                queryKey: ["admin-reviews"],
                              });
                            } catch (error) {
                              notify(
                                (error as Error).message ||
                                  "Could not reject review.",
                                "error",
                              );
                            }
                          }}
                        >
                          Reject
                        </button>
                      )}
                      <button
                        className="button button-danger"
                        onClick={async () => {
                          if (
                            window.confirm("Permanently delete this review?")
                          ) {
                            try {
                              await api(`/admin/reviews/${review._id}`, {
                                method: "DELETE",
                              });
                              notify("Review deleted.");
                              void client.invalidateQueries({
                                queryKey: ["admin-reviews"],
                              });
                            } catch (error) {
                              notify(
                                (error as Error).message ||
                                  "Could not delete review.",
                                "error",
                              );
                            }
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="admin-draft-note">
                No {reviewFilter} reviews. New customer reviews are held here
                for moderation before they appear publicly.
              </div>
            )}
          </section>
        )}
        {activeSection === "profile" && (
          <section
            className="admin-panel admin-profile-panel"
            id="admin-profile"
          >
            <div className="panel-heading">
              <div>
                <div className="eyebrow">ACCOUNT</div>
                <h2>Administrator profile &amp; security</h2>
              </div>
              <LockKeyhole size={18} />
            </div>
            {adminProfile.isLoading ? (
              <p>Loading administrator profile…</p>
            ) : adminProfile.error ? (
              <div className="inline-error" role="alert">
                {(adminProfile.error as Error).message}
              </div>
            ) : (
              <div className="profile-summary">
                <div>
                  <span>Username</span>
                  <b>{adminProfile.data.username}</b>
                </div>
                <div>
                  <span>Administrator email</span>
                  <b>
                    {adminProfile.data.email}{" "}
                    <span
                      className={`security-badge ${adminProfile.data.emailVerified ? "verified" : "unverified"}`}
                    >
                      {adminProfile.data.emailVerified
                        ? "Verified"
                        : "Not verified"}
                    </span>
                  </b>
                </div>
                <div>
                  <span>Role</span>
                  <b>{titleCase(adminProfile.data.role)}</b>
                </div>
                <div>
                  <span>Two-factor authentication</span>
                  <b>
                    {adminProfile.data.twoFactorEnabled
                      ? "Email codes enabled"
                      : "Disabled"}
                  </b>
                </div>
              </div>
            )}
            {profileMessage && (
              <div
                className={
                  profileMessageKind === "error"
                    ? "inline-error"
                    : "admin-message"
                }
                role={profileMessageKind === "error" ? "alert" : "status"}
              >
                {profileMessage}
              </div>
            )}
            <div className="security-tools">
              {!adminProfile.data?.emailVerified && (
                <div className="security-card">
                  <h3>Confirm administrator email</h3>
                  <p>
                    Verify your current email address before enabling email-code
                    two-factor authentication.
                  </p>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => void requestEmailVerification()}
                  >
                    Send verification code
                  </button>
                  <div className="security-inline">
                    <input
                      aria-label="Email verification code"
                      inputMode="numeric"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(event) =>
                        setVerificationCode(event.target.value)
                      }
                      placeholder="6-digit code"
                    />
                    <button
                      type="button"
                      className="button button-dark"
                      disabled={verificationCode.length !== 6}
                      onClick={() => void confirmEmailVerification()}
                    >
                      Confirm email
                    </button>
                  </div>
                </div>
              )}
              <div className="security-card">
                <h3>Change administrator email</h3>
                <p>
                  We’ll send a confirmation code to the new address. The current
                  email stays active until confirmed.
                </p>
                <form
                  className="stack-form"
                  onSubmit={(event) => void requestEmailChange(event)}
                >
                  <label>
                    New email
                    <input type="email" name="email" required />
                  </label>
                  <label>
                    Current password
                    <input
                      type="password"
                      name="currentPassword"
                      autoComplete="current-password"
                      required
                    />
                  </label>
                  <button className="button button-outline">
                    Send confirmation code
                  </button>
                </form>
                <div className="security-inline">
                  <input
                    aria-label="New email confirmation code"
                    inputMode="numeric"
                    maxLength={6}
                    value={emailChangeCode}
                    onChange={(event) => setEmailChangeCode(event.target.value)}
                    placeholder="6-digit code"
                  />
                  <button
                    type="button"
                    className="button button-dark"
                    disabled={emailChangeCode.length !== 6}
                    onClick={() => void confirmEmailChange()}
                  >
                    Confirm new email
                  </button>
                </div>
              </div>
              <div className="security-card">
                <h3>Change password</h3>
                <p>
                  Changing the password signs out your current session and
                  requires a fresh sign-in.
                </p>
                <form
                  className="stack-form"
                  onSubmit={(event) => void changeAdminPassword(event)}
                >
                  <label>
                    Current password
                    <input
                      type="password"
                      name="currentPassword"
                      autoComplete="current-password"
                      required
                    />
                  </label>
                  <label>
                    New password
                    <input
                      type="password"
                      name="newPassword"
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                  </label>
                  <button className="button button-outline">
                    Update password
                  </button>
                </form>
              </div>
              <div className="security-card">
                <h3>Email-code two-factor authentication</h3>
                <p>
                  Sign-ins require a one-time code delivered to your verified
                  administrator email. Codes expire after 10 minutes.
                </p>
                {adminProfile.data?.twoFactorEnabled ? (
                  <form
                    className="stack-form"
                    onSubmit={(event) => void disableTwoFactor(event)}
                  >
                    <label>
                      Current password to disable
                      <input
                        type="password"
                        name="currentPassword"
                        autoComplete="current-password"
                        required
                      />
                    </label>
                    <button className="button button-danger">
                      Disable two-factor authentication
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      className="button button-outline"
                      disabled={!adminProfile.data?.emailVerified}
                      onClick={() => void startTwoFactorSetup()}
                    >
                      Send setup code
                    </button>
                    <div className="security-inline">
                      <input
                        aria-label="Two-factor setup code"
                        inputMode="numeric"
                        maxLength={6}
                        value={twoFactorCode}
                        onChange={(event) =>
                          setTwoFactorCode(event.target.value)
                        }
                        placeholder="6-digit code"
                      />
                      <button
                        type="button"
                        className="button button-dark"
                        disabled={twoFactorCode.length !== 6}
                        onClick={() => void enableTwoFactor()}
                      >
                        Enable 2FA
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        )}
        {activeSection === "settings" && (
          <section
            className="admin-panel store-settings-panel"
            id="store-settings"
          >
            <div className="panel-heading">
              <div>
                <div className="eyebrow">PUBLIC STORE</div>
                <h2>Store settings</h2>
              </div>
              <Globe2 size={18} />
            </div>
            {settings.isLoading ? (
              <p>Loading settings…</p>
            ) : settings.error ? (
              <div className="inline-error">
                {(settings.error as Error).message}
              </div>
            ) : (
              <form
                className="stack-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const logoUrl = String(form.get("logoUrl") || "");
                  const faviconUrl = String(form.get("faviconUrl") || "");
                  try {
                    await api("/admin/settings", {
                      method: "PUT",
                      body: JSON.stringify({
                        storeName: form.get("storeName"),
                        storeDescription: form.get("storeDescription"),
                        contactEmail: form.get("contactEmail"),
                        supportUrl: form.get("supportUrl") || undefined,
                        footerText: form.get("footerText"),
                        logo: logoUrl
                          ? { key: logoUrl, url: logoUrl }
                          : undefined,
                        favicon: faviconUrl
                          ? { key: faviconUrl, url: faviconUrl }
                          : undefined,
                        socialLinks: {
                          github: form.get("github"),
                          twitter: form.get("twitter"),
                          discord: form.get("discord"),
                          youtube: form.get("youtube"),
                        },
                        seoDefaults: {
                          title: form.get("seoTitle"),
                          description: form.get("seoDescription"),
                          keywords: [],
                        },
                      }),
                    });
                    setSettingsMessage("Store settings saved.");
                    void client.invalidateQueries({
                      queryKey: ["admin-settings"],
                    });
                    void client.invalidateQueries({
                      queryKey: ["public-settings"],
                    });
                  } catch (error) {
                    setSettingsMessage((error as Error).message);
                  }
                }}
              >
                <div className="form-two">
                  <label>
                    Store name
                    <input
                      name="storeName"
                      defaultValue={settings.data.storeName}
                    />
                  </label>
                  <label>
                    Contact email
                    <input
                      name="contactEmail"
                      type="email"
                      defaultValue={settings.data.contactEmail}
                    />
                  </label>
                </div>
                <label>
                  Store description
                  <textarea
                    name="storeDescription"
                    defaultValue={settings.data.storeDescription}
                    rows={2}
                  />
                </label>
                <div className="form-two">
                  <label>
                    Logo HTTPS URL
                    <input
                      name="logoUrl"
                      type="url"
                      defaultValue={settings.data.logo?.url}
                    />
                  </label>
                  <label>
                    Favicon HTTPS URL
                    <input
                      name="faviconUrl"
                      type="url"
                      defaultValue={settings.data.favicon?.url}
                    />
                  </label>
                </div>
                <div className="form-two">
                  <label>
                    Support URL
                    <input
                      name="supportUrl"
                      type="url"
                      defaultValue={settings.data.supportUrl}
                    />
                  </label>
                  <label>
                    Footer text
                    <input
                      name="footerText"
                      defaultValue={settings.data.footerText}
                    />
                  </label>
                </div>
                <div className="form-two">
                  <label>
                    GitHub link
                    <input
                      name="github"
                      type="url"
                      defaultValue={settings.data.socialLinks?.github}
                    />
                  </label>
                  <label>
                    Twitter/X link
                    <input
                      name="twitter"
                      type="url"
                      defaultValue={settings.data.socialLinks?.twitter}
                    />
                  </label>
                </div>
                <div className="form-two">
                  <label>
                    Discord link
                    <input
                      name="discord"
                      type="url"
                      defaultValue={settings.data.socialLinks?.discord}
                    />
                  </label>
                  <label>
                    YouTube link
                    <input
                      name="youtube"
                      type="url"
                      defaultValue={settings.data.socialLinks?.youtube}
                    />
                  </label>
                </div>
                <div className="form-two">
                  <label>
                    Default SEO title
                    <input
                      name="seoTitle"
                      defaultValue={settings.data.seoDefaults?.title}
                    />
                  </label>
                  <label>
                    Default SEO description
                    <input
                      name="seoDescription"
                      defaultValue={settings.data.seoDefaults?.description}
                    />
                  </label>
                </div>
                {settingsMessage && (
                  <div
                    className={
                      settingsMessage.includes("saved")
                        ? "admin-message"
                        : "inline-error"
                    }
                  >
                    {settingsMessage}
                  </div>
                )}
                <button className="button button-dark">
                  Save store settings <Check size={15} />
                </button>
              </form>
            )}
          </section>
        )}
        {activeSection === "applications" && (
          <div className="admin-footer-note">
            <ShieldCheck size={16} /> Uploads stay in private staging. Publish
            the application and release before publishing an installer;
            disabling or unpublishing moves it back to staging. Only download
            clicks are counted—not completed installs.
          </div>
        )}
      </div>
    </div>
  );
}

function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [version, setVersion] = useState(0);
  const profile = useQuery({
    queryKey: ["admin-profile", version],
    queryFn: async () => api("/admin/auth/me"),
    retry: false,
  });
  useEffect(() => {
    if (!profile.isLoading) setAuthenticated(!profile.isError);
  }, [profile.isLoading, profile.isError]);
  if (authenticated === null)
    return (
      <main className="admin-login-wrap">
        <span className="spinner" />
      </main>
    );
  return authenticated ? (
    <AdminDashboard
      onLogout={() => {
        setAuthenticated(false);
        setVersion((value) => value + 1);
      }}
    />
  ) : (
    <AdminLogin
      onSuccess={() => {
        setAuthenticated(true);
        setVersion((value) => value + 1);
      }}
    />
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppearanceProvider>
        <StoreMeta />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/software" element={<CatalogPage />} />
          <Route path="/software/:slug" element={<SoftwarePage />} />
          {Object.keys(infoPages).map((page) => (
            <Route
              key={page}
              path={`/${page}`}
              element={<InfoPage page={page} />}
            />
          ))}
          <Route path="/admin/*" element={<AdminPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppearanceProvider>
    </BrowserRouter>
  );
}

export default App;
