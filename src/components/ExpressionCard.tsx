import { useState } from 'react';

interface ExpressionCardProps {
  originalExpression: string;
  improvedExpression: string;
  explanation?: string;
  showAnswer: boolean;
  onShowAnswer: () => void;
  onScore: (score: 0 | 1 | 2 | 3) => void;  // v3.0: 4-level scoring
  onRetire: () => void;
  // Legacy support
  onAcknowledge?: () => void;
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
  const [showOriginal, setShowOriginal] = useState(false);
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

      {!showOriginal && (
        <button
          onClick={() => setShowOriginal(true)}
          className="text-xs text-blue-500 underline mb-4 hover:text-blue-700 transition-colors"
        >
          显示原句
        </button>
      )}

      {showOriginal && (
        <div className="mb-4 text-left max-w-2xl mx-auto">
          <div className="bg-gray-50 border-l-4 border-gray-300 p-4">
            <div className="font-semibold text-sm text-gray-600 mb-2">原句：</div>
            <div className="text-sm text-gray-700">{originalExpression}</div>
          </div>
          <button
            onClick={() => setShowOriginal(false)}
            className="text-xs text-blue-500 underline mt-2 hover:text-blue-700 transition-colors"
          >
            隐藏原句
          </button>
        </div>
      )}

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

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onScore(0)}
          className="bg-red-600 text-white px-4 py-4 rounded-lg hover:bg-red-700 transition-colors flex flex-col items-center"
        >
          <div className="text-2xl mb-1">😰</div>
          <div className="font-semibold text-sm">完全忘了</div>
          <div className="text-xs opacity-80">Forgot</div>
        </button>

        <button
          onClick={() => onScore(1)}
          className="bg-orange-500 text-white px-4 py-4 rounded-lg hover:bg-orange-600 transition-colors flex flex-col items-center"
        >
          <div className="text-2xl mb-1">🤔</div>
          <div className="font-semibold text-sm">勉强想起</div>
          <div className="text-xs opacity-80">Hard</div>
        </button>

        <button
          onClick={() => onScore(2)}
          className="bg-green-600 text-white px-4 py-4 rounded-lg hover:bg-green-700 transition-colors flex flex-col items-center"
        >
          <div className="text-2xl mb-1">✅</div>
          <div className="font-semibold text-sm">熟练</div>
          <div className="text-xs opacity-80">Good</div>
        </button>

        <button
          onClick={() => onScore(3)}
          className="bg-blue-600 text-white px-4 py-4 rounded-lg hover:bg-blue-700 transition-colors flex flex-col items-center"
        >
          <div className="text-2xl mb-1">🚀</div>
          <div className="font-semibold text-sm">非常熟练</div>
          <div className="text-xs opacity-80">Perfect</div>
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
