import Link from "next/link";
import { SORTS, isFilteredList, type CatalogueState } from "@/features/products/catalogue-params";
import type { CategoryFacet } from "@/features/products/queries";
import { CATALOGUE_PATH } from "@/lib/seo/site-url";

const label = "block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground";
const control =
  "mt-2 block h-12 w-full min-w-0 rounded-sm border border-charcoal/40 bg-white px-3 text-base text-charcoal focus-visible:border-charcoal";

/** Plain GET form: works without JavaScript; results are server-rendered. */
export function SearchForm({ state, categories }: { state: CatalogueState; categories: CategoryFacet[] }) {
  const options = categories.some((c) => c.slug === state.category) || !state.category
    ? categories
    : [{ slug: state.category, name: state.category, count: 0 }, ...categories];

  return (
    <form
      // Remount on every URL change so defaultValues follow client navigations.
      key={JSON.stringify(state)}
      method="get"
      action={CATALOGUE_PATH}
      role="search"
      aria-label="Catalogue"
      className="grid gap-5 border border-charcoal bg-white p-5 sm:p-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
    >
      <div className="min-w-0">
        <label htmlFor="catalogue-q" className={label}>
          Search the catalogue
        </label>
        <input
          id="catalogue-q"
          type="search"
          name="q"
          defaultValue={state.q}
          maxLength={200}
          autoComplete="off"
          spellCheck={false}
          aria-describedby="catalogue-q-hint"
          className={`${control} font-mono`}
        />
        <p id="catalogue-q-hint" className="mt-2 text-xs text-muted-foreground">
          Product name, product code or CAS number (with or without hyphens).
        </p>
      </div>
      <div className="min-w-0 md:pb-6">
        <label htmlFor="catalogue-category" className={label}>
          Category
        </label>
        <select id="catalogue-category" name="category" defaultValue={state.category} className={control}>
          <option value="">All categories</option>
          {options.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.count > 0 ? `${c.name} (${c.count})` : c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-0 md:pb-6">
        <label htmlFor="catalogue-sort" className={label}>
          Sort by
        </label>
        <select id="catalogue-sort" name="sort" defaultValue={state.sort} className={control}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 md:pb-6">
        <button
          type="submit"
          className="h-12 rounded-sm bg-charcoal px-7 text-sm font-medium tracking-wide text-ivory transition-colors hover:bg-bronze-text"
        >
          Search
        </button>
        {isFilteredList(state) ? (
          <Link href={CATALOGUE_PATH} className="text-sm text-bronze-text underline underline-offset-4 decoration-1 hover:decoration-2">
            Clear filters
          </Link>
        ) : null}
      </div>
    </form>
  );
}
