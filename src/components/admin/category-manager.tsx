"use client";

import { useActionState } from "react";
import { manageCategory } from "@/features/categories/actions";
import type { CategoryRow } from "@/features/categories/queries";
import { buttonCls, inputCls, labelCls, secondaryButtonCls } from "./ui";

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const [state, action, pending] = useActionState(manageCategory, null);
  return (
    <div className="mt-6 max-w-3xl">
      <p aria-live="polite" className="min-h-6 text-sm">
        {state ? <span className={state.ok ? "text-olive-deep" : "font-medium text-destructive"}>{state.message}</span> : null}
      </p>

      <form action={action} className="mt-2 flex flex-wrap items-end gap-3">
        <input type="hidden" name="intent" value="create" />
        <div className="w-full min-w-0 sm:w-80">
          <label htmlFor="category-new" className={labelCls}>
            New category
          </label>
          <input id="category-new" name="name" maxLength={100} required className={inputCls} />
        </div>
        <button type="submit" disabled={pending} className={buttonCls}>
          Add category
        </button>
      </form>

      {categories.length === 0 ? (
        <p className="mt-6 border border-charcoal/20 bg-white p-4 text-sm">There are no categories yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-charcoal/10 border border-charcoal/15 bg-white">
          {categories.map((c, index) => (
            <li key={c.id} className="flex flex-wrap items-end gap-x-4 gap-y-3 p-3">
              <form action={action} className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
                <input type="hidden" name="intent" value="rename" />
                <input type="hidden" name="id" value={c.id} />
                <div className="min-w-0 flex-1 basis-56">
                  <label htmlFor={`category-${c.id}`} className={labelCls}>
                    Name <span className="sr-only">of category {c.name}</span>
                  </label>
                  <input id={`category-${c.id}`} name="name" defaultValue={c.name} maxLength={100} required className={inputCls} />
                </div>
                <button type="submit" disabled={pending} className={secondaryButtonCls}>
                  Rename<span className="sr-only"> {c.name}</span>
                </button>
              </form>
              <p className="text-xs text-muted-foreground">
                {c.productCount} {c.productCount === 1 ? "product" : "products"}
              </p>
              <div className="flex gap-1.5">
                {(["up", "down"] as const).map((direction) => (
                  <form action={action} key={direction}>
                    <input type="hidden" name="intent" value="move" />
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="direction" value={direction} />
                    <button
                      type="submit"
                      disabled={pending || (direction === "up" ? index === 0 : index === categories.length - 1)}
                      className={secondaryButtonCls}
                    >
                      Move {direction}
                      <span className="sr-only"> {c.name}</span>
                    </button>
                  </form>
                ))}
                <form action={action}>
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" disabled={pending} className={secondaryButtonCls}>
                    Delete<span className="sr-only"> {c.name}</span>
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
