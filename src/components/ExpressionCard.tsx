interface ExpressionCardProps {
  originalExpression: string;
  improvedExpression: string;
  explanation?: string;
  showAnswer: boolean;
}

export default function ExpressionCard({
  originalExpression,
  improvedExpression,
  explanation,
  showAnswer,
}: ExpressionCardProps) {
  if (!showAnswer) {
    return (
      <div className="text-center">
        <div className="mb-2 text-3xl md:text-4xl">💡</div>
        <h2 className="mb-4 text-base font-semibold text-violet-600 md:text-lg">
          你会怎么把它说得更自然？
        </h2>
        <p className="text-xl leading-relaxed text-slate-800 md:text-2xl">
          {originalExpression}
        </p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="mb-2 text-3xl md:text-4xl">✨</div>
      <h2 className="mb-4 text-base font-semibold text-violet-600 md:text-lg">更自然的表达</h2>
      <p className="mb-6 text-xl leading-relaxed text-slate-900 md:text-2xl">
        {improvedExpression}
      </p>

      <div className="mx-auto mb-4 max-w-2xl rounded-2xl bg-slate-50 p-4 text-left">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">原表达</div>
        <div className="text-sm text-slate-700 md:text-base">{originalExpression}</div>
      </div>

      {explanation && (
        <div className="mb-4 rounded-2xl border border-violet-100 bg-violet-50 p-4 text-left">
          <p className="text-sm text-slate-700 md:text-base">
            <strong className="text-violet-800">说明：</strong> {explanation}
          </p>
        </div>
      )}

      <div className="text-sm text-slate-500">
        <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-700">
          表达优化
        </span>
      </div>
    </div>
  );
}
