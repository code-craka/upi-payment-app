'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

// Shared type for HTML element components with className
type ComponentWithClassName<T extends keyof React.JSX.IntrinsicElements> = {
  className?: string
} & React.ComponentProps<T>

function Table({ className, ...props }: ComponentWithClassName<'table'>) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn('[&_tr]:border-b', className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        'bg-muted/50 border-t font-medium [&>tr]:last:border-b-0',
        className,
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors',
        className,
      )}
      {...props}
    />
  )
}

// Helper function to create table cell components
function createTableCellComponent<T extends 'th' | 'td'>(
  element: T,
  dataSlot: string,
  baseClassName: string
) {
  return ({ className, ...props }: React.ComponentProps<T>) => {
    const Element = element as any
    return (
      <Element
        data-slot={dataSlot}
        className={cn(baseClassName, className)}
        {...props}
      />
    )
  }
}

// Table header cell component for column headers
const TableHead = createTableCellComponent(
  'th',
  'table-head',
  'text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]'
)

// Table data cell component for row content
const TableCell = createTableCellComponent(
  'td',
  'table-cell',
  'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]'
)

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.ComponentProps<'caption'>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    data-slot="table-caption"
    className={cn('text-muted-foreground mt-4 text-sm', className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
