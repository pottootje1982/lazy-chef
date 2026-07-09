'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import PicnicProductSearch from '@/components/PicnicProductSearch';
import AddToCartButton from '@/components/AddToCartButton';
import {
  markIngredientUnavailable,
  markIngredientAvailable,
  setIngredientQuantity,
} from '@/lib/ingredient-actions';

export type LinkedProduct = {
  mappingId: string;
  picnicId: string;
  name: string;
  imageId: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  unitQuantity: string | null;
};

export type IngredientItem = {
  raw: string;
  ingredientKey: string; // normalized key, used to flag (un)available
  product: LinkedProduct | null;
  unavailable: boolean;
  quantity: number; // effective order qty (override ?? parsed)
  defaultQuantity: number; // parsed from the line
};

function euro(cents: number | null): string | null {
  if (cents == null) return null;
  return '€' + (cents / 100).toFixed(2).replace('.', ',');
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.5" y2="16.5" />
    </svg>
  );
}

function UnlinkIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18.84 12.25l1.72-1.71a4 4 0 0 0-5.66-5.66l-1.71 1.72" />
      <path d="M5.17 11.75l-1.72 1.71a4 4 0 0 0 5.66 5.66l1.71-1.72" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

function NotAvailableIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

const ingredientIconBtn =
  'flex h-8 w-8 flex-none items-center justify-center rounded border border-stone-200 text-stone-500 hover:bg-stone-100';

// Compact per-ingredient order quantity (persisted as a per-recipe override).
// Number + tiny up/down arrows; also editable by typing.
function QtySpinner({
  recipeId,
  ingredientKey,
  initial,
  defaultQuantity,
}: {
  recipeId: string;
  ingredientKey: string;
  initial: number;
  defaultQuantity: number;
}) {
  const t = useTranslations('ingredientList');
  const [qty, setQty] = useState(initial);
  const [draft, setDraft] = useState(String(initial));
  const qtyRef = useRef(initial);

  function commit(value: number) {
    const next = Math.max(1, Math.min(99, value));
    setDraft(String(next));
    if (next === qtyRef.current) return;
    qtyRef.current = next;
    setQty(next);
    void setIngredientQuantity(recipeId, ingredientKey, next).catch(() => {});
  }

  function bump(delta: number) {
    commit(qtyRef.current + delta);
  }

  const overridden = qty !== defaultQuantity;
  return (
    <div
      title={
        overridden
          ? t('orderQtyTooltipOverride', { default: defaultQuantity })
          : t('orderQtyTooltip')
      }
      className="flex h-8 flex-none items-center gap-1 rounded border border-stone-200 px-2"
    >
      <span
        className={`text-sm ${overridden ? 'font-semibold text-brand-700' : 'text-stone-700'}`}
      >
        ×
      </span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onFocus={(e) => e.target.select()}
        onBlur={() => {
          const parsed = parseInt(draft, 10);
          commit(Number.isNaN(parsed) ? qtyRef.current : parsed);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            bump(1);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            bump(-1);
          }
        }}
        aria-label={t('orderQtyTooltip')}
        className={`w-6 bg-transparent text-center text-sm tabular-nums outline-none ${overridden ? 'font-semibold text-brand-700' : 'text-stone-700'}`}
      />
      <span className="flex flex-col leading-none">
        <button
          onClick={() => bump(1)}
          disabled={qty >= 99}
          className="text-[9px] text-stone-400 hover:text-stone-700 disabled:opacity-30"
          aria-label={t('increaseQuantity')}
        >
          ▲
        </button>
        <button
          onClick={() => bump(-1)}
          disabled={qty <= 1}
          className="text-[9px] text-stone-400 hover:text-stone-700 disabled:opacity-30"
          aria-label={t('decreaseQuantity')}
        >
          ▼
        </button>
      </span>
    </div>
  );
}

function Row({
  item,
  picnicLinked,
  readOnly,
  lang,
  recipeId,
}: {
  item: IngredientItem;
  picnicLinked: boolean;
  readOnly: boolean;
  lang?: string;
  recipeId: string;
}) {
  const t = useTranslations('ingredientList');
  const tErr = useTranslations('errors');
  const [product, setProduct] = useState<LinkedProduct | null>(item.product);
  const [open, setOpen] = useState(false);
  const [unavailable, setUnavailable] = useState(item.unavailable);

  async function unlink() {
    if (!product) return;
    const prev = product;
    setProduct(null);
    try {
      await fetch(`/api/mappings/${prev.mappingId}`, { method: 'DELETE' });
    } catch {
      setProduct(prev); // restore on failure
    }
  }

  async function setUnavail(next: boolean) {
    setUnavailable(next); // optimistic
    if (next) setOpen(false);
    try {
      if (next) await markIngredientUnavailable(item.ingredientKey);
      else await markIngredientAvailable(item.ingredientKey);
    } catch {
      setUnavailable(!next); // revert on failure
    }
  }

  return (
    <li
      className={`rounded-lg border p-3 ${
        unavailable ? 'border-amber-300 bg-amber-50' : 'border-stone-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-2">
          <span className="mt-0.5 text-brand-500">•</span>
          <span className="text-sm">{item.raw}</span>
        </div>
        {readOnly ? null : (
          <div className="flex flex-none items-center gap-1.5">
            {unavailable ? (
              <button
                onClick={() => setUnavail(false)}
                className="text-xs font-medium text-amber-700 hover:underline"
              >
                {t('markAvailable')}
              </button>
            ) : !product ? (
              picnicLinked ? (
                <button
                  onClick={() => setOpen(true)}
                  title={open ? t('searching') : t('linkProduct')}
                  aria-label={t('linkProduct')}
                  className={`${ingredientIconBtn} hover:text-brand-600`}
                >
                  <SearchIcon />
                </button>
              ) : (
                <Link
                  href="/settings"
                  className="text-xs font-medium text-stone-400 hover:text-brand-600"
                >
                  {t('connectPicnic')}
                </Link>
              )
            ) : null}
          </div>
        )}
      </div>

      {unavailable ? (
        <p className="mt-2 text-xs text-amber-700">{t('notAvailableNote')}</p>
      ) : null}

      {/* Linked product summary. Click the image/name to change the product. */}
      {!unavailable && product ? (
        <div className="mt-2 flex items-center gap-3 rounded-lg bg-stone-50 p-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={readOnly}
            title={readOnly ? undefined : t('change')}
            className="flex min-w-0 flex-1 items-center gap-3 text-left enabled:hover:opacity-80 disabled:cursor-default"
          >
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-12 w-12 flex-none rounded object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded bg-stone-200 text-lg">
                🛒
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{product.name}</p>
              <p className="text-xs text-stone-500">
                {[product.unitQuantity, euro(product.priceCents)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </button>
          {readOnly ? null : (
            <div className="flex flex-none items-center gap-1.5">
              <QtySpinner
                recipeId={recipeId}
                ingredientKey={item.ingredientKey}
                initial={item.quantity}
                defaultQuantity={item.defaultQuantity}
              />
              <AddToCartButton
                label={t('addToCart')}
                sizeClass="h-8 w-8"
                items={[
                  {
                    picnicId: product.picnicId,
                    name: product.name,
                    imageId: product.imageId,
                    priceCents: product.priceCents,
                    unitQuantity: product.unitQuantity,
                    quantity: item.quantity,
                  },
                ]}
              />
            </div>
          )}
        </div>
      ) : null}

      {/* Search panel */}
      {open ? (
        <div className="mt-2 rounded-lg border border-stone-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-500">{t('searchHint')}</span>
            <button
              onClick={() => setOpen(false)}
              title={t('close')}
              aria-label={t('close')}
              className="flex h-6 w-6 items-center justify-center rounded text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Secondary actions for this ingredient, below the search hint. */}
          <div className="mb-2 mt-1 flex items-center gap-4 border-b border-stone-100 pb-2 text-xs">
            {product ? (
              <button
                onClick={() => {
                  void unlink();
                  setOpen(false);
                }}
                className="flex items-center gap-1 font-medium text-stone-500 hover:text-red-600"
              >
                <UnlinkIcon />
                {t('unlink')}
              </button>
            ) : null}
            <button
              onClick={() => setUnavail(true)}
              className="flex items-center gap-1 font-medium text-stone-500 hover:text-amber-700"
            >
              <NotAvailableIcon />
              {t('notAvailable')}
            </button>
          </div>

          <PicnicProductSearch
            ingredient={item.raw}
            autoSearch
            lang={lang}
            action={{
              label: t('select'),
              onPick: async (p, query) => {
                const res = await fetch('/api/mappings', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    rawIngredient: item.raw,
                    translated: query,
                    product: p,
                  }),
                });
                const data = await res.json();
                if (!res.ok) return data.error ?? tErr('saveMappingFailed');
                setProduct({
                  mappingId: data.mapping.id,
                  picnicId: p.picnicId,
                  name: p.name,
                  imageId: p.imageId,
                  imageUrl: p.imageUrl,
                  priceCents: p.priceCents,
                  unitQuantity: p.unitQuantity,
                });
                setOpen(false);
              },
            }}
          />
        </div>
      ) : null}
    </li>
  );
}

export default function IngredientList({
  items,
  picnicLinked,
  readOnly = false,
  lang,
  recipeId,
}: {
  items: IngredientItem[];
  picnicLinked: boolean;
  readOnly?: boolean;
  lang?: string;
  recipeId: string;
}) {
  const t = useTranslations('ingredientList');
  if (items.length === 0) {
    return <p className="text-sm text-stone-400">{t('noIngredients')}</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <Row
          key={i}
          item={item}
          picnicLinked={picnicLinked}
          readOnly={readOnly}
          lang={lang}
          recipeId={recipeId}
        />
      ))}
    </ul>
  );
}
