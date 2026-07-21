"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconSearch } from "./icons";

interface SearchInputProps {
  placeholder: string;
  paramKey?: string;
  label?: string;
}

/** URLの検索パラメータと連動する検索入力（Enterで確定） */
export function SearchInput({
  placeholder,
  paramKey = "q",
  label = "検索",
}: SearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const submit = (formData: FormData) => {
    const value = String(formData.get(paramKey) ?? "").trim();
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(paramKey, value);
    } else {
      params.delete(paramKey);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <form action={submit} role="search" className="relative">
      <label className="sr-only" htmlFor={`search-${paramKey}`}>
        {label}
      </label>
      <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
      <input
        id={`search-${paramKey}`}
        type="search"
        name={paramKey}
        defaultValue={searchParams.get(paramKey) ?? ""}
        placeholder={placeholder}
        className="min-h-11 w-full rounded-full border border-line bg-page py-2 pl-9 pr-4 text-[15px] text-ink placeholder:text-ink-soft/70 focus:border-primary focus:bg-surface"
      />
    </form>
  );
}
