interface ExpressionCardProps {
  originalExpression: string;
  improvedExpression: string;
  explanation?: string;
  showAnswer: boolean;
  onShowAnswer: () => void;
  onAcknowledge: () => void;
  onRetire: () => void;
}

export default function ExpressionCard({
  originalExpression,
  improvedExpression,
  explanation,
  showAnswer,
  onShowAnswer,
  onAcknowledge,
  onRetire,
}: ExpressionCardProps) {
  if (!showAnswer) {
    return (
      <div className="text-center">
        <div className="text-4xl mb-2">💡</div>
        <h2 className="text-lg font-semibold text-purple-600 mb-4">
          Can you improve this expression?
        </h2>
        <p className="text-2xl text-gray-800 leading-relaxed">
          {originalExpression}
        </p>
        <div className="mt-8">
          <button
            onClick={onShowAnswer}
            className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            Show Better Expression
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="text-4xl mb-2">✨</div>
      <h2 className="text-lg font-semibold text-purple-600 mb-4">Better Expression:</h2>
      <p className="text-2xl text-gray-800 leading-relaxed mb-6">
        {improvedExpression}
      </p>

      {explanation && (
        <div className="bg-purple-50 border-l-4 border-purple-400 p-4 mb-6 text-left">
          <p className="text-gray-700">
            <strong className="text-purple-800">Why this is better:</strong> {explanation}
          </p>
        </div>
      )}

      <div className="text-sm text-gray-500 mb-6">
        <span className="bg-purple-100 px-3 py-1 rounded-full text-purple-700">
          💡 Expression
        </span>
      </div>

      <div className="flex justify-center">
        <button
          onClick={onAcknowledge}
          className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium"
        >
          Got It! Next
        </button>
      </div>

      <div className="mt-6">
        <button
          onClick={() => {
            if (window.confirm('确定不再复习这条内容吗？')) {
              onRetire();
            }
          }}
          className="text-gray-500 text-sm px-4 py-2 rounded hover:bg-gray-100 transition-colors"
        >
          不再复习
        </button>
      </div>
    </div>
  );
}
