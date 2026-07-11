import { Component, ErrorInfo, ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Application render failed", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="min-h-[100dvh] bg-slate-50 flex items-center justify-center p-6">
        <section className="w-full max-w-sm rounded-3xl border bg-white p-6 text-center shadow-sm">
          <p className="mb-3 text-4xl">🛠️</p>
          <h1 className="text-lg font-black">화면을 불러오지 못했어요</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            잠시 연결이 불안정했어요. 아래 버튼을 눌러 다시 시작해 주세요.
          </p>
          <button
            className="mt-5 w-full rounded-xl bg-violet-500 py-3 font-bold text-white"
            onClick={() => window.location.reload()}
          >
            다시 불러오기
          </button>
          <button
            className="mt-2 w-full rounded-xl bg-gray-100 py-3 font-bold text-gray-700"
            onClick={() => window.location.assign("/child/missions")}
          >
            미션 목록으로 이동
          </button>
        </section>
      </main>
    );
  }
}
