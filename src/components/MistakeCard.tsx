interface MistakeCardProps {
  errorSentence: string;
  correctSentence: string;
  explanation?: string;
  showAnswer: boolean;
  onShowAnswer: () => void;
  onCorrect: () => void;
  onIncorrect: () => void;
}

export default function MistakeCard({
  errorSentence,
  correctSentence,
  explanation,
  showAnswer,
  onShowAnswer,
  onCorrect,
  onIncorrect,
}: MistakeCardProps) {
  if (!showAnswer) {
    return (
      <div className="text-center">
        <div className="text-4xl mb-2">❌</div>
        <h2 className="text-lg font-semibold text-red-600 mb-4">
          What&apos;s wrong with this sentence?
        </h2>
        <p className="text-2xl text-gray-800 leading-relaxed">
          {errorSentence}
        </p>
        <div className="mt-8">
          <button
            onClick={onShowAnswer}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Show Answer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="text-4xl mb-2">✅</div>
      <h2 className="text-lg font-semibold text-green-600 mb-4">Correct Answer:</h2>
      <p className="text-2xl text-gray-800 leading-relaxed mb-6">
        {correctSentence}
      </p>

      {explanation && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 text-left">
          <p className="text-gray-700">
            <strong className="text-blue-800">Explanation:</strong> {explanation}
          </p>
        </div>
      )}

      <div className="text-sm text-gray-500 mb-6">
        <span className="bg-red-100 px-3 py-1 rounded-full text-red-700">
          ❌ Mistake
        </span>
      </div>

      <div className="flex justify-center space-x-4">
        <button
          onClick={onIncorrect}
          className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium"
        >
          Need More Practice
        </button>
        <button
          onClick={onCorrect}
          className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
        >
          Got It!
        </button>
      </div>
    </div>
  );
}
