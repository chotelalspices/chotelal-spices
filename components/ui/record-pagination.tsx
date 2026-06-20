'use client';

import { Fragment, useCallback, useMemo, useState, type SetStateAction } from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { cn } from '@/libs/utils';

export const RECORDS_PER_PAGE = 30;

const itemIdentity = new WeakMap<object, number>();
let nextItemIdentity = 1;

function getItemsKey<T>(items: readonly T[]) {
  return items.map((item) => {
    if ((typeof item === "object" && item !== null) || typeof item === "function") {
      const object = item as object;
      let id = itemIdentity.get(object);
      if (!id) { id = nextItemIdentity++; itemIdentity.set(object, id); }
      return `o:${id}`;
    }
    return `${typeof item}:${String(item)}`;
  }).join("|");
}

export function usePaginatedRecords<T>(items: readonly T[], pageSize = RECORDS_PER_PAGE) {
  const itemsKey = getItemsKey(items);
  const [pageState, setPageState] = useState({ page: 1, itemsKey, pageSize });
  const page = pageState.itemsKey === itemsKey && pageState.pageSize === pageSize ? pageState.page : 1;
  const setPage = useCallback(
    (nextPage: SetStateAction<number>) => {
      setPageState((current) => {
        const currentPage = current.itemsKey === itemsKey && current.pageSize === pageSize ? current.page : 1;
        return {
          page: typeof nextPage === 'function' ? nextPage(currentPage) : nextPage,
          itemsKey,
          pageSize,
        };
      });
    },
    [itemsKey, pageSize],
  );
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRecords = useMemo(
    () => items.slice(startIndex, startIndex + pageSize),
    [items, pageSize, startIndex],
  );

  return {
    currentPage,
    pageCount,
    pageSize,
    paginatedRecords,
    onPageChange: setPage,
    setPage,
    startRecord: items.length === 0 ? 0 : startIndex + 1,
    endRecord: Math.min(startIndex + pageSize, items.length),
    totalRecords: items.length,
  };
}

function getVisiblePages(currentPage: number, pageCount: number) {
  const pages = new Set<number>([1, pageCount, currentPage, currentPage - 1, currentPage + 1]);
  return Array.from(pages)
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((a, b) => a - b);
}

export function RecordPagination({
  currentPage,
  pageCount,
  pageSize = RECORDS_PER_PAGE,
  totalRecords,
  onPageChange,
  itemLabel = 'records',
  className,
}: {
  currentPage: number;
  pageCount: number;
  pageSize?: number;
  totalRecords: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  className?: string;
}) {
  if (totalRecords <= pageSize) return null;

  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalRecords);
  const visiblePages = getVisiblePages(currentPage, pageCount);

  const goToPage = (page: number) => {
    onPageChange(Math.min(Math.max(page, 1), pageCount));
  };

  return (
    <div className={cn('flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <p className="text-sm text-muted-foreground">
        Showing {startRecord}-{endRecord} of {totalRecords} {itemLabel}
      </p>
      <Pagination className="mx-0 w-auto justify-start sm:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              aria-disabled={currentPage === 1}
              className={cn(currentPage === 1 && 'pointer-events-none opacity-50')}
              onClick={(event) => {
                event.preventDefault();
                goToPage(currentPage - 1);
              }}
            />
          </PaginationItem>
          {visiblePages.map((page, index) => {
            const previousPage = visiblePages[index - 1];
            const showEllipsis = previousPage !== undefined && page - previousPage > 1;
            return (
              <Fragment key={page}>
                {showEllipsis && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    isActive={page === currentPage}
                    onClick={(event) => {
                      event.preventDefault();
                      goToPage(page);
                    }}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              </Fragment>
            );
          })}
          <PaginationItem>
            <PaginationNext
              href="#"
              aria-disabled={currentPage === pageCount}
              className={cn(currentPage === pageCount && 'pointer-events-none opacity-50')}
              onClick={(event) => {
                event.preventDefault();
                goToPage(currentPage + 1);
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
