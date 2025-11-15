/**
 * Content Type Configuration for v2.0
 *
 * Supports two types of content:
 * 1. Mistake: Error sentences that need correction
 * 2. Expression: Alternative expressions for improvement
 */

export type ContentType = 'mistake' | 'expression';

export interface ContentTypeConfig {
  label: string;
  icon: string;
  errorLabel: string; // Label for the "wrong" or "original" field
  correctLabel: string; // Label for the "correct" or "improved" field
  reviewPrompt: string; // Prompt shown during review
  answerPrompt: string; // Prompt shown when answer is revealed
  placeholder: {
    error: string;
    correct: string;
    explanation: string;
  };
}

export const CONTENT_TYPE_CONFIG: Record<ContentType, ContentTypeConfig> = {
  mistake: {
    label: 'Mistake',
    icon: '❌',
    errorLabel: 'Error Sentence',
    correctLabel: 'Correct Sentence',
    reviewPrompt: "What's wrong with this sentence?",
    answerPrompt: 'Correct Answer:',
    placeholder: {
      error: 'Enter the incorrect sentence...',
      correct: 'Enter the correct sentence...',
      explanation: 'Optional: Explain the mistake...',
    },
  },
  expression: {
    label: 'Expression',
    icon: '💡',
    errorLabel: 'Original Expression',
    correctLabel: 'Improved Expression',
    reviewPrompt: 'Can you improve this expression?',
    answerPrompt: 'Better Expression:',
    placeholder: {
      error: 'Enter the original expression...',
      correct: 'Enter the improved expression...',
      explanation: 'Optional: Why is this better?',
    },
  },
};

/**
 * Get configuration for a specific content type
 */
export function getContentTypeConfig(type: ContentType = 'mistake'): ContentTypeConfig {
  return CONTENT_TYPE_CONFIG[type] || CONTENT_TYPE_CONFIG.mistake;
}

/**
 * Validate if a string is a valid content type
 */
export function isValidContentType(type: string): type is ContentType {
  return type === 'mistake' || type === 'expression';
}
