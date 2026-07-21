import type { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  /** 右側の補助情報パネル。画面幅が狭い場合はメインの下に回り込む */
  aside?: ReactNode;
}

/**
 * メインコンテンツの共通コンテナ。
 * 1440px前後を最優先に、右パネルありの2カラム構成をとる。
 */
export function PageContainer({ children, aside }: PageContainerProps) {
  if (!aside) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6">
        {children}
      </div>
    );
  }
  return (
    <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-6 px-4 py-6 md:px-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">{children}</div>
      <aside aria-label="補助情報" className="min-w-0 space-y-4">
        {aside}
      </aside>
    </div>
  );
}
