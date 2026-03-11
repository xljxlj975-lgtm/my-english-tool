interface MistakeCardProps {
  errorSentence: string;
  correctSentence: string;
  explanation?: string;
  showAnswer: boolean;
}

export default function MistakeCard({
  errorSentence,
  correctSentence,
  explanation,
  showAnswer,
}: MistakeCardProps) {
  if (!showAnswer) {
    return (
      <div className="text-center">
        <div className="mb-2 text-3xl md:text-4xl">❌</div>
        <h2 className="mb-4 text-base font-semibold text-red-600 md:text-lg">
          这句话哪里不对？
        </h2>
        <p className="text-xl leading-relaxed text-slate-800 md:text-2xl">
          {errorSentence}
        </p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="mb-2 text-3xl md:text-4xl">✅</div>
      <h2 className="mb-4 text-base font-semibold text-emerald-600 md:text-lg">正确表达</h2>
      <p className="mb-6 text-xl leading-relaxed text-slate-900 md:text-2xl">
        {correctSentence}
      </p>

      <div className="mx-auto mb-4 max-w-2xl rounded-2xl bg-slate-50 p-4 text-left">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">原句</div>
        <div className="text-sm text-slate-700 md:text-base">{errorSentence}</div>
      </div>

      {explanation && (
        <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-left">
          <p className="text-sm text-slate-700 md:text-base">
            <strong className="text-blue-800">说明：</strong> {explanation}
          </p>
        </div>
      )}

      <div className="text-sm text-slate-500">
        <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">
          错误纠正
        </span>
      </div>
    </div>
  );
}
