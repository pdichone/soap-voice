'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { IntakeQuestion, IntakeQuestionType } from '@/lib/types-intake';

const QUESTION_TYPES: { value: IntakeQuestionType; label: string; description: string }[] = [
  { value: 'section', label: 'Section Header', description: 'Group questions together' },
  { value: 'text', label: 'Short Text', description: 'Single line input' },
  { value: 'textarea', label: 'Long Text', description: 'Multi-line input' },
  { value: 'yesno', label: 'Yes/No', description: 'Simple yes or no question' },
  { value: 'select', label: 'Single Choice', description: 'Pick one option' },
  { value: 'multiselect', label: 'Multiple Choice', description: 'Pick multiple options' },
  { value: 'scale', label: 'Scale (1-10)', description: 'Numeric rating' },
  { value: 'date', label: 'Date', description: 'Date picker' },
];

interface QuestionBuilderProps {
  questions: IntakeQuestion[];
  onChange: (questions: IntakeQuestion[]) => void;
}

export function QuestionBuilder({ questions, onChange }: QuestionBuilderProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const generateId = () => `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addQuestion = (type: IntakeQuestionType) => {
    const newQuestion: IntakeQuestion = {
      id: generateId(),
      type,
      label: type === 'section' ? 'New Section' : 'New Question',
      required: type !== 'section',
      options: type === 'select' || type === 'multiselect' ? ['Option 1', 'Option 2'] : undefined,
      min: type === 'scale' ? 1 : undefined,
      max: type === 'scale' ? 10 : undefined,
    };
    onChange([...questions, newQuestion]);
    setEditingId(newQuestion.id);
  };

  const updateQuestion = (id: string, updates: Partial<IntakeQuestion>) => {
    onChange(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const deleteQuestion = (id: string) => {
    onChange(questions.filter(q => q.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;

    const newQuestions = [...questions];
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
    onChange(newQuestions);
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    const question = questions.find(q => q.id === questionId);
    if (!question?.options) return;

    const newOptions = [...question.options];
    newOptions[optionIndex] = value;
    updateQuestion(questionId, { options: newOptions });
  };

  const addOption = (questionId: string) => {
    const question = questions.find(q => q.id === questionId);
    if (!question?.options) return;

    updateQuestion(questionId, { options: [...question.options, `Option ${question.options.length + 1}`] });
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    const question = questions.find(q => q.id === questionId);
    if (!question?.options || question.options.length <= 2) return;

    updateQuestion(questionId, { options: question.options.filter((_, i) => i !== optionIndex) });
  };

  return (
    <div className="space-y-4">
      {/* Add Question Dropdown */}
      <div className="flex gap-2 flex-wrap">
        <Select onValueChange={(value: IntakeQuestionType) => addQuestion(value)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Add a question..." />
          </SelectTrigger>
          <SelectContent>
            {QUESTION_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <div className="flex flex-col">
                  <span>{type.label}</span>
                  <span className="text-xs text-gray-500">{type.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Questions List */}
      {questions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-gray-500">
            <p>No questions yet. Add your first question above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {questions.map((question, index) => (
            <Card
              key={question.id}
              className={`${question.type === 'section' ? 'bg-gray-50 border-gray-300' : ''} ${editingId === question.id ? 'ring-2 ring-primary' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Move Buttons */}
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveQuestion(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <ChevronUpIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveQuestion(index, 'down')}
                      disabled={index === questions.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <ChevronDownIcon className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Question Content */}
                  <div className="flex-1 min-w-0">
                    {editingId === question.id ? (
                      <div className="space-y-3">
                        {/* Label */}
                        <Input
                          value={question.label}
                          onChange={(e) => updateQuestion(question.id, { label: e.target.value })}
                          placeholder={question.type === 'section' ? 'Section title' : 'Question text'}
                          className="font-medium"
                        />

                        {/* Placeholder (for text/textarea) */}
                        {(question.type === 'text' || question.type === 'textarea') && (
                          <Input
                            value={question.placeholder || ''}
                            onChange={(e) => updateQuestion(question.id, { placeholder: e.target.value })}
                            placeholder="Placeholder text (optional)"
                            className="text-sm"
                          />
                        )}

                        {/* Help Text */}
                        {question.type !== 'section' && (
                          <Input
                            value={question.helpText || ''}
                            onChange={(e) => updateQuestion(question.id, { helpText: e.target.value })}
                            placeholder="Help text (optional)"
                            className="text-sm"
                          />
                        )}

                        {/* Options (for select/multiselect) */}
                        {(question.type === 'select' || question.type === 'multiselect') && question.options && (
                          <div className="space-y-2">
                            <p className="text-xs text-gray-500">Options:</p>
                            {question.options.map((option, optIndex) => (
                              <div key={optIndex} className="flex gap-2">
                                <Input
                                  value={option}
                                  onChange={(e) => updateOption(question.id, optIndex, e.target.value)}
                                  className="text-sm"
                                />
                                {question.options!.length > 2 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeOption(question.id, optIndex)}
                                    className="px-2"
                                  >
                                    <XIcon className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            ))}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addOption(question.id)}
                            >
                              Add Option
                            </Button>
                          </div>
                        )}

                        {/* Required Toggle */}
                        {question.type !== 'section' && (
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={question.required || false}
                              onChange={(e) => updateQuestion(question.id, { required: e.target.checked })}
                              className="rounded border-gray-300"
                            />
                            Required
                          </label>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingId(null)}
                        >
                          Done
                        </Button>
                      </div>
                    ) : (
                      <div
                        className="cursor-pointer"
                        onClick={() => setEditingId(question.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`${question.type === 'section' ? 'font-semibold text-gray-700' : 'font-medium text-gray-900'}`}>
                            {question.label}
                          </span>
                          {question.required && (
                            <span className="text-red-500 text-sm">*</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {QUESTION_TYPES.find(t => t.value === question.type)?.label}
                          {question.options && ` (${question.options.length} options)`}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Delete Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteQuestion(question.id)}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
